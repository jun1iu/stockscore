import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import { BENCHMARK, UNIVERSE } from '@/data/universe';
import { band, FACTORS, scoreGroup, scoreLabel } from './engine/score';
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

/** Dates, track record and refresh history: everything except the bulk data. */
export async function getMeta() {
  'use cache';
  cacheLife('hours');
  cacheTag(SNAPSHOT_TAG);
  const s = await loadSnapshot();
  return { asOf: s.asOf, builtAt: s.builtAt, source: s.source, trackRecord: s.trackRecord, runs: s.runs };
}

export type Meta = Awaited<ReturnType<typeof getMeta>>;

/** Everything the stock page and the API need about one company. */
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
    trust: b ? { band: b, outcome: t.bands[b.key], horizonMonths: t.horizonMonths, since: t.start } : null,
    history: s.history[ticker] ?? [],
    factors: FACTORS,
  };
}

export type StockReport = NonNullable<Awaited<ReturnType<typeof stockReport>>>;

export const universe = UNIVERSE;
export const benchmark = BENCHMARK;

export function secFilingUrl(cik: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, '')}/`;
}
