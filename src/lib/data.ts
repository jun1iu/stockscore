import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { BENCHMARK, UNIVERSE } from '@/data/universe';
import { band, FACTORS, scoreGroup, scoreLabel } from './engine/score';
import { explainChange, type ScoreChange } from './engine/explain';
import type { Evaluation } from './engine/types';
import { bundledSnapshot } from './pipeline/bundled';
import type { Snapshot } from './pipeline/snapshot';
import { readSnapshot } from './pipeline/storage';

/** Every cached read below carries this tag; the refresh job invalidates it after writing. */
export const SNAPSHOT_TAG = 'snapshot';

/** The live snapshot written by the refresh job, or the bundled one until there is one. */
async function loadSnapshot(): Promise<Snapshot> {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  try {
    const stored = await readSnapshot();
    if (stored) return stored.snapshot;
  } catch (e) {
    console.error('Reading the live snapshot failed; using the bundled one.', e);
  }
  return bundledSnapshot();
}

/** Today's scores for the whole group, best first. */
export async function getEvaluations(): Promise<Evaluation[]> {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  return scoreGroup(s.companies, s.prices, s.asOf).sort((a, b) => a.rank - b.rank);
}

/** The month-end before the latest prices: the date "what changed" compares against. */
function previousMonthEnd(asOf: string): string {
  const d = new Date(asOf + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 0)).toISOString().slice(0, 10);
}

/** How every score moved since the previous month-end, keyed by ticker. */
export async function getChanges(): Promise<{ since: string; changes: Record<string, ScoreChange> }> {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  const since = previousMonthEnd(s.asOf);
  const before = new Map(scoreGroup(s.companies, s.prices, since).map((e) => [e.ticker, e]));
  const changes: Record<string, ScoreChange> = {};
  for (const e of await getEvaluations()) {
    const c = explainChange(before.get(e.ticker), e, since);
    if (c) changes[e.ticker] = c;
  }
  return { since, changes };
}

/** Dates, track record and refresh history: everything except the bulk data. */
export async function getMeta() {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  return { asOf: s.asOf, builtAt: s.builtAt, source: s.source, trackRecord: s.trackRecord, runs: s.runs };
}

/** Last close and the move since the previous month-end for every company, for the ticker tape. */
export async function getTape() {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  const quotes = UNIVERSE.flatMap((u) => {
    const points = s.prices[u.ticker]?.points ?? [];
    const last = points.at(-1);
    const before = points.at(-2);
    return last ? [{ ticker: u.ticker, price: last.close, change: before ? last.adjClose / before.adjClose - 1 : null }] : [];
  });
  return { asOf: s.asOf, quotes };
}

export type Meta = Awaited<ReturnType<typeof getMeta>>;

/**
 * Everything the stock page and the API need about one company.
 * Pass a ticker from `findCompany`: the result is cached per ticker, so unchecked input would grow the cache.
 */
export async function stockReport(ticker: string) {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  const c = s.companies.find((x) => x.ticker === ticker);
  if (!c) return null;
  const e = (await getEvaluations()).find((x) => x.ticker === ticker) ?? null;
  const b = e ? band(e.score) : null;
  const t = s.trackRecord;
  const points = s.prices[ticker]?.points ?? [];
  const last = points.at(-1);
  const prevMonthEnd = points.at(-2);
  return {
    ticker,
    name: c.name,
    sector: c.sector,
    cik: c.cik,
    asOf: s.asOf,
    price: last ? { price: last.close, date: last.date, changeSinceMonthEnd: prevMonthEnd ? last.adjClose / prevMonthEnd.adjClose - 1 : null } : null,
    evaluation: e,
    label: e ? scoreLabel(e.score) : null,
    trust: b ? { band: b, outcome: t.bands[b.key], range: t.uncertainty?.bands[b.key] ?? null, horizonMonths: t.horizonMonths, since: t.start } : null,
    history: s.history[ticker] ?? [],
    // Month-end closes over the same period as the score history, for the price view of the chart.
    priceHistory: points.filter((p) => p.date >= (s.history[ticker]?.[0]?.date ?? '')).map((p) => ({ date: p.date, close: p.close })),
    change: (await getChanges()).changes[ticker] ?? null,
    // Annual report dates, marked on the score chart.
    reports: c.facts.revenue.filter((f) => f.filed >= (s.history[ticker]?.[0]?.date ?? '2012')).map((f) => f.filed),
    factors: FACTORS,
  };
}

export type StockReport = NonNullable<Awaited<ReturnType<typeof stockReport>>>;

export const universe = UNIVERSE;
export const benchmark = BENCHMARK;

export function secFilingUrl(cik: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, '')}/`;
}
