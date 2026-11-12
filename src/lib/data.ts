import 'server-only';
import companiesJson from '@/data/generated/companies.json';
import historyJson from '@/data/generated/history.json';
import pricesJson from '@/data/generated/prices.json';
import trackJson from '@/data/generated/track-record.json';
import { BENCHMARK, UNIVERSE } from '@/data/universe';
import type { TrackRecord } from './engine/backtest';
import { band, FACTORS, scoreGroup, scoreLabel } from './engine/score';
import type { Company, Evaluation, PriceHistory } from './engine/types';

const companies = companiesJson as Company[];
const prices = pricesJson as Record<string, PriceHistory>;
const history = historyJson as Record<string, { date: string; score: number }[]>;
export const trackRecord = trackJson as TrackRecord & { builtAt: string };

/** The date of the latest prices in the snapshot. Every live score is "as of" this date. */
export const asOfDate = prices[BENCHMARK.ticker].points.at(-1)!.date;

let cache: Evaluation[] | null = null;
/** Today's scores for the whole group, computed once per server instance. */
export function evaluations(): Evaluation[] {
  return (cache ??= scoreGroup(companies, prices, asOfDate).sort((a, b) => a.rank - b.rank));
}

export function company(ticker: string): Company | undefined {
  return companies.find((c) => c.ticker === ticker);
}

export const universe = UNIVERSE;

export function isCovered(ticker: string): boolean {
  return UNIVERSE.some((u) => u.ticker === ticker);
}

/** One year of price change, for the header. */
export function priceChange(ticker: string): { price: number; date: string; change1m: number | null } | null {
  const p = prices[ticker]?.points;
  if (!p?.length) return null;
  const last = p.at(-1)!;
  const prev = p.at(-2);
  return { price: last.close, date: last.date, change1m: prev ? last.adjClose / prev.adjClose - 1 : null };
}

/** Everything the stock page and the API need about one company. */
export function stockReport(ticker: string) {
  const c = company(ticker);
  if (!c) return null;
  const e = evaluations().find((x) => x.ticker === ticker) ?? null;
  const b = e ? band(e.score) : null;
  return {
    ticker,
    name: c.name,
    sector: c.sector,
    cik: c.cik,
    asOf: asOfDate,
    price: priceChange(ticker),
    evaluation: e,
    label: e ? scoreLabel(e.score) : null,
    trust: b ? { band: b, outcome: trackRecord.bands[b.key], horizonMonths: trackRecord.horizonMonths, since: trackRecord.start } : null,
    history: history[ticker] ?? [],
    factors: FACTORS,
  };
}

export type StockReport = NonNullable<ReturnType<typeof stockReport>>;

export function secFilingUrl(cik: number, accn: string): string {
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${accn.replace(/-/g, '')}/`;
}
