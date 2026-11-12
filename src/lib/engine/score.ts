import { measure } from './metrics';
import { percentiles } from './stats';
import type { Company, Evaluation, FactorKey, MetricKey, PriceHistory } from './types';

export interface MetricDef {
  key: MetricKey;
  label: string;
  formula: string;
  /** Direction that ranks higher. */
  better: 'higher' | 'lower';
  format: 'percent' | 'ratio' | 'times';
}

export interface FactorDef {
  key: FactorKey;
  label: string;
  question: string;
  metrics: MetricDef[];
}

/** The engine's whole rulebook. Weights are equal and were fixed before any backtest was run. */
export const FACTORS: FactorDef[] = [
  {
    key: 'profitability',
    label: 'Profitability',
    question: 'How much does it earn from what it has?',
    metrics: [
      { key: 'returnOnAssets', label: 'Return on assets', formula: 'Net income ÷ total assets', better: 'higher', format: 'percent' },
      { key: 'netMargin', label: 'Net margin', formula: 'Net income ÷ revenue', better: 'higher', format: 'percent' },
    ],
  },
  {
    key: 'growth',
    label: 'Growth',
    question: 'How fast is the business growing?',
    metrics: [
      { key: 'revenueGrowth3y', label: 'Revenue growth, 3 years', formula: 'Yearly rate from revenue three annual reports ago', better: 'higher', format: 'percent' },
      { key: 'epsGrowth3y', label: 'Earnings per share growth, 3 years', formula: 'Yearly rate from earnings per share three reports ago, split-adjusted', better: 'higher', format: 'percent' },
    ],
  },
  {
    key: 'value',
    label: 'Value',
    question: 'How much do you pay for its profit and cash?',
    metrics: [
      { key: 'peRatio', label: 'Price to earnings', formula: 'Market value ÷ net income; ranked lower is better, and a loss ranks last', better: 'lower', format: 'times' },
      { key: 'fcfYield', label: 'Free cash flow yield', formula: '(Operating cash flow − capital spending) ÷ market value', better: 'higher', format: 'percent' },
    ],
  },
  {
    key: 'balanceSheet',
    label: 'Balance sheet',
    question: 'How much could it withstand?',
    metrics: [
      { key: 'liabilitiesToAssets', label: 'Liabilities ÷ assets', formula: 'Total liabilities ÷ total assets; lower is safer', better: 'lower', format: 'percent' },
      { key: 'currentRatio', label: 'Current ratio', formula: 'Current assets ÷ current liabilities', better: 'higher', format: 'ratio' },
    ],
  },
  {
    key: 'momentum',
    label: 'Momentum',
    question: 'How has the share price moved?',
    metrics: [
      { key: 'return6m', label: 'Total return, 6 months', formula: 'Change in price plus dividends over 6 months', better: 'higher', format: 'percent' },
      { key: 'return12m', label: 'Total return, 12 months', formula: 'Change in price plus dividends over 12 months', better: 'higher', format: 'percent' },
    ],
  },
];

export const METRICS = FACTORS.flatMap((f) => f.metrics);

/** A company needs this many of the five factors to get a score. */
export const MIN_FACTORS = 4;

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Top fifth of the group';
  if (score >= 60) return 'Above the middle';
  if (score >= 40) return 'Around the middle';
  if (score >= 20) return 'Below the middle';
  return 'Bottom fifth of the group';
}

/** The score range a score falls in, used to look up the engine's record for it. */
export function band(score: number): { lo: number; hi: number; key: string } {
  const lo = Math.min(80, Math.floor(score / 20) * 20);
  return { lo, hi: lo + 20, key: `${lo}-${lo + 20}` };
}

/** Score every company in the group with what was known on `date`. */
export function scoreGroup(companies: Company[], prices: Record<string, PriceHistory>, date: string): Evaluation[] {
  const measured = companies
    .map((c) => ({ c, m: prices[c.ticker] ? measure(c, prices[c.ticker], date) : null }))
    .filter((x): x is { c: Company; m: NonNullable<ReturnType<typeof measure>> } => x.m !== null);

  const metricScores = new Map<MetricKey, (number | null)[]>();
  for (const def of METRICS) {
    // P/E ranks through earnings yield: same order for profitable companies, and losses rank last.
    const raw = measured.map(({ m }) => (def.key === 'peRatio' ? m.earningsYield : m.values[def.key]));
    const p = percentiles(raw);
    const flip = def.better === 'lower' && def.key !== 'peRatio';
    metricScores.set(def.key, p.map((v) => (v === null ? null : flip ? 100 - v : v)));
  }

  const partial = measured.map(({ c, m }, i) => {
    const ms = Object.fromEntries(METRICS.map((d) => [d.key, metricScores.get(d.key)![i]])) as Evaluation['metricScores'];
    const factors = Object.fromEntries(
      FACTORS.map((f) => {
        const vs = f.metrics.map((d) => ms[d.key]).filter((v): v is number => v !== null);
        return [f.key, vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null];
      }),
    ) as Evaluation['factors'];
    const present = Object.values(factors).filter((v): v is number => v !== null);
    const composite = present.length >= MIN_FACTORS ? present.reduce((a, b) => a + b, 0) / present.length : null;
    const metrics: Evaluation['metrics'] = { values: m.values, returnOnEquity: m.returnOnEquity, price: m.price, marketCap: m.marketCap, source: m.source };
    return { ticker: c.ticker, metrics, metricScores: ms, factors, composite };
  });

  const scored = partial.filter((p): p is typeof p & { composite: number } => p.composite !== null);
  const finalScores = percentiles(scored.map((p) => p.composite)) as number[];
  const evaluations = scored.map((p, i) => ({ ...p, date, score: finalScores[i], rank: 0, groupSize: scored.length }));
  evaluations
    .slice()
    .sort((a, b) => b.composite - a.composite)
    .forEach((e, i) => (e.rank = i + 1));
  return evaluations;
}
