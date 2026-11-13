import { monthsBefore, priceAt } from './metrics';
import { band, FACTORS, scoreGroup } from './score';
import { compareVariants, uncertainty, type BacktestMonth, type Comparison, type Uncertainty } from './rigour';
import { mean, spearman, stdev, summarize, type Outcome } from './stats';
import type { Company, FactorKey, PriceHistory } from './types';

/** Last day of each month from `start` to `end`, inclusive. */
export function monthEnds(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + 'T00:00:00Z');
  for (let y = s.getUTCFullYear(), m = s.getUTCMonth(); ; m++) {
    const d = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    if (d > end) break;
    if (d >= start) out.push(d);
  }
  return out;
}

/** Total return from the month-end `date` to the month-end `months` later, or null if unknown. */
export function forwardReturn(history: PriceHistory, date: string, months: number): number | null {
  const later = monthsBefore(date, -months);
  const a = priceAt(history, date);
  const b = priceAt(history, later);
  if (!a || !b || a.date !== date || b.date !== later) return null;
  return b.adjClose / a.adjClose - 1;
}

export interface TrackRecord {
  start: string;
  end: string;
  horizonMonths: number;
  benchmark: string;
  months: number;
  companies: number;
  observations: number;
  /** Average monthly rank correlation between score and next-year result against the benchmark. */
  ic: number;
  icPositiveShare: number;
  /** t-statistic of the rank correlation over non-overlapping yearly windows. */
  icTStat: number;
  icYearly: { date: string; ic: number }[];
  factorIc: Record<FactorKey, number>;
  quintiles: (Outcome & { label: string })[];
  bands: Record<string, Outcome>;
  overall: Outcome;
  /** 95% ranges from resampling whole years. */
  uncertainty?: Uncertainty;
  /** Alternative engines scored on the same unseen years. */
  comparison?: Comparison | null;
}

export interface BacktestResult {
  record: TrackRecord;
  /** Every company's score at every month-end, for the score-over-time charts. */
  history: Record<string, { date: string; score: number }[]>;
}

export function runBacktest(
  companies: Company[],
  prices: Record<string, PriceHistory>,
  benchmark: PriceHistory,
  opts: { start: string; end: string; horizonMonths?: number; yearlyMonth?: number },
): BacktestResult {
  const horizon = opts.horizonMonths ?? 12;
  const yearlyMonth = opts.yearlyMonth ?? 12;
  const history: BacktestResult['history'] = {};
  const obs: { date: string; score: number; excess: number }[] = [];
  const monthly: { date: string; ic: number }[] = [];
  const factorIcs: Record<FactorKey, number[]> = { profitability: [], growth: [], value: [], balanceSheet: [], momentum: [] };
  const byMonth: { score: number; excess: number }[][] = [];
  const months: BacktestMonth[] = [];
  const sectorOf = new Map(companies.map((c) => [c.ticker, c.sector]));

  for (const date of monthEnds(opts.start, opts.end)) {
    const evals = scoreGroup(companies, prices, date);
    for (const e of evals) (history[e.ticker] ??= []).push({ date, score: Math.round(e.score * 10) / 10 });

    const bench = forwardReturn(benchmark, date, horizon);
    if (bench === null) continue;
    const rows = evals
      .map((e) => ({ e, r: forwardReturn(prices[e.ticker], date, horizon) }))
      .filter((x): x is { e: (typeof evals)[number]; r: number } => x.r !== null)
      .map(({ e, r }) => ({ e, excess: r - bench }));
    if (rows.length < 20) continue;

    rows.forEach(({ e, excess }) => obs.push({ date, score: e.score, excess }));
    byMonth.push(rows.map(({ e, excess }) => ({ score: e.score, excess })));
    months.push({ date, rows: rows.map(({ e, excess }) => ({ ticker: e.ticker, sector: sectorOf.get(e.ticker) ?? '', score: e.score, factors: e.factors, excess })) });
    monthly.push({ date, ic: spearman(rows.map((x) => x.e.score), rows.map((x) => x.excess)) });
    for (const f of FACTORS) {
      const fr = rows.filter((x) => x.e.factors[f.key] !== null);
      if (fr.length >= 20) factorIcs[f.key].push(spearman(fr.map((x) => x.e.factors[f.key]!), fr.map((x) => x.excess)));
    }
  }

  // Twelve-month results overlap month to month, so the t-statistic uses one month a year.
  const yearly = monthly.filter((m) => Number(m.date.slice(5, 7)) === yearlyMonth);
  const yearlyIcs = yearly.map((m) => m.ic);

  const quintileBuckets: number[][] = [[], [], [], [], []];
  for (const rows of byMonth) {
    const sorted = [...rows].sort((a, b) => a.score - b.score);
    sorted.forEach((r, i) => quintileBuckets[Math.min(4, Math.floor((i * 5) / sorted.length))].push(r.excess));
  }
  const labels = ['Bottom fifth', 'Second fifth', 'Middle fifth', 'Fourth fifth', 'Top fifth'];

  const bandBuckets: Record<string, number[]> = {};
  for (const o of obs) (bandBuckets[band(o.score).key] ??= []).push(o.excess);

  const record: TrackRecord = {
    start: monthly[0]?.date ?? opts.start,
    end: monthly.at(-1)?.date ?? opts.end,
    horizonMonths: horizon,
    benchmark: benchmark.ticker,
    months: monthly.length,
    companies: Object.keys(history).length,
    observations: obs.length,
    ic: mean(monthly.map((m) => m.ic)),
    icPositiveShare: monthly.filter((m) => m.ic > 0).length / monthly.length,
    icTStat: yearlyIcs.length > 2 ? mean(yearlyIcs) / (stdev(yearlyIcs) / Math.sqrt(yearlyIcs.length)) : 0,
    icYearly: yearly,
    factorIc: Object.fromEntries(Object.entries(factorIcs).map(([k, v]) => [k, v.length ? mean(v) : 0])) as Record<FactorKey, number>,
    quintiles: quintileBuckets.map((b, i) => ({ label: labels[i], ...summarize(b) })),
    bands: Object.fromEntries(Object.entries(bandBuckets).sort().map(([k, v]) => [k, summarize(v)])),
    overall: summarize(obs.map((o) => o.excess)),
    uncertainty: months.length ? uncertainty(months) : undefined,
    comparison: compareVariants(months),
  };
  return { record, history };
}
