/**
 * How sure we can be about the track record, and whether a different engine would have done better.
 *
 * Uncertainty: twelve-month results that start a month apart share eleven months, and a bad year
 * hits every company at once, so months are not independent. The bootstrap therefore resamples
 * whole calendar years: draw years with replacement, recompute the figure, repeat 2,000 times,
 * and report the middle 95% of the results.
 *
 * Alternatives, all scored only on years the learned engine never saw:
 * - Equal weights across the group (the live engine).
 * - Sector-neutral: each factor is measured against the company's own sector average first, so a
 *   utility isn't marked down for growing slower than a chip maker.
 * - Learned weights, walk-forward: before each year, weights are set from how well each factor
 *   predicted in earlier years only, with a one-year gap so no twelve-month result overlaps.
 */
import { band } from './score';
import { mean, ranks, spearman } from './stats';
import type { FactorKey } from './types';

export interface BacktestRow {
  ticker: string;
  sector: string;
  score: number;
  factors: Record<FactorKey, number | null>;
  /** Next-year return minus the benchmark's. */
  excess: number;
}

export interface BacktestMonth {
  date: string;
  rows: BacktestRow[];
}

export type Range = [number, number];

export interface Uncertainty {
  resamples: number;
  bands: Record<string, Range>;
  quintiles: Range[];
  ic: Range;
}

export interface Variant {
  key: 'equal' | 'sector' | 'learned';
  label: string;
  description: string;
  ic: number;
  icRange: Range;
  topBeat: number;
  topBeatRange: Range;
  bottomBeat: number;
  /** Learned engine only: the weights it would use now, and in each test year. */
  weights?: Record<FactorKey, number>;
  weightsByYear?: { year: number; weights: Record<FactorKey, number> }[];
}

export interface Comparison {
  /** First and last test year, inclusive. */
  years: [number, number];
  months: number;
  variants: Variant[];
}

const FACTOR_KEYS: FactorKey[] = ['profitability', 'growth', 'value', 'balanceSheet', 'momentum'];
const RESAMPLES = 2000;

/** Small, fast, seeded random numbers, so the published ranges are reproducible. */
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Middle 95% of a statistic over year-block resamples. `stat` gets the chosen year indexes. */
function yearBootstrap(years: number, stat: (picks: number[]) => number, seed: number): Range {
  const rand = rng(seed);
  const values: number[] = [];
  for (let i = 0; i < RESAMPLES; i++) {
    const picks = Array.from({ length: years }, () => Math.floor(rand() * years));
    const v = stat(picks);
    if (Number.isFinite(v)) values.push(v);
  }
  values.sort((a, b) => a - b);
  return [values[Math.floor(values.length * 0.025)], values[Math.floor(values.length * 0.975)]];
}

/** Rank rows by a value within the month and put them in fifths, 0 = bottom. */
function fifths(values: number[]): number[] {
  const r = ranks(values);
  return r.map((x) => Math.min(4, Math.floor(((x - 1) * 5) / values.length)));
}

/** Beat counts per year for a set of rows: [beat, total]. */
type Tally = Map<number, [number, number]>;
function tally(t: Tally, year: number, beat: boolean) {
  const v = t.get(year) ?? [0, 0];
  v[0] += beat ? 1 : 0;
  v[1] += 1;
  t.set(year, v);
}
function shareFromPicks(t: Tally, yearList: number[], picks: number[]): number {
  let b = 0, n = 0;
  for (const p of picks) {
    const v = t.get(yearList[p]);
    if (v) { b += v[0]; n += v[1]; }
  }
  return n ? b / n : NaN;
}

const yearOf = (date: string) => Number(date.slice(0, 4));

/** Ranges for the headline figures of the live engine. */
export function uncertainty(months: BacktestMonth[]): Uncertainty {
  const yearList = [...new Set(months.map((m) => yearOf(m.date)))];
  const bandTallies = new Map<string, Tally>();
  const quintileTallies: Tally[] = [new Map(), new Map(), new Map(), new Map(), new Map()];
  const icByYear = new Map<number, number[]>();

  for (const m of months) {
    const y = yearOf(m.date);
    const q = fifths(m.rows.map((r) => r.score));
    m.rows.forEach((r, i) => {
      const key = band(r.score).key;
      if (!bandTallies.has(key)) bandTallies.set(key, new Map());
      tally(bandTallies.get(key)!, y, r.excess > 0);
      tally(quintileTallies[q[i]], y, r.excess > 0);
    });
    (icByYear.get(y) ?? icByYear.set(y, []).get(y)!).push(spearman(m.rows.map((r) => r.score), m.rows.map((r) => r.excess)));
  }

  const n = yearList.length;
  return {
    resamples: RESAMPLES,
    bands: Object.fromEntries([...bandTallies.entries()].sort().map(([k, t], i) => [k, yearBootstrap(n, (p) => shareFromPicks(t, yearList, p), 11 + i)])),
    quintiles: quintileTallies.map((t, i) => yearBootstrap(n, (p) => shareFromPicks(t, yearList, p), 31 + i)),
    ic: yearBootstrap(n, (p) => mean(p.flatMap((i) => icByYear.get(yearList[i]) ?? [])), 47),
  };
}

/** Composite from factors with weights; missing factors are skipped and the rest re-weighted. */
function composite(f: Record<FactorKey, number | null>, w: Record<FactorKey, number>): number | null {
  let s = 0, ws = 0, present = 0;
  for (const k of FACTOR_KEYS) {
    const v = f[k];
    if (v === null) continue;
    present++;
    s += w[k] * v;
    ws += w[k];
  }
  return present >= 4 && ws > 0 ? s / ws : null;
}

const EQUAL: Record<FactorKey, number> = { profitability: 1, growth: 1, value: 1, balanceSheet: 1, momentum: 1 };

/** Factors measured against the sector average within the month (sectors of one are left as they are). */
function sectorNeutral(rows: BacktestRow[]): Record<FactorKey, number | null>[] {
  const sums = new Map<string, Record<FactorKey, [number, number]>>();
  for (const r of rows) {
    const s = sums.get(r.sector) ?? (Object.fromEntries(FACTOR_KEYS.map((k) => [k, [0, 0]])) as Record<FactorKey, [number, number]>);
    for (const k of FACTOR_KEYS) if (r.factors[k] !== null) { s[k][0] += r.factors[k]!; s[k][1]++; }
    sums.set(r.sector, s);
  }
  return rows.map((r) => {
    const s = sums.get(r.sector)!;
    return Object.fromEntries(FACTOR_KEYS.map((k) => {
      const v = r.factors[k];
      if (v === null) return [k, null];
      const [sum, cnt] = s[k];
      return [k, cnt > 1 ? v - sum / cnt + 50 : v];
    })) as Record<FactorKey, number | null>;
  });
}

/** Weights from earlier years: each factor's average monthly rank correlation, negatives set to zero. */
function learnWeights(train: BacktestMonth[]): Record<FactorKey, number> {
  const w = {} as Record<FactorKey, number>;
  for (const k of FACTOR_KEYS) {
    const ics = train.map((m) => {
      const rows = m.rows.filter((r) => r.factors[k] !== null);
      return rows.length >= 20 ? spearman(rows.map((r) => r.factors[k]!), rows.map((r) => r.excess)) : NaN;
    }).filter(Number.isFinite);
    w[k] = Math.max(0, ics.length ? mean(ics) : 0);
  }
  const total = FACTOR_KEYS.reduce((s, k) => s + w[k], 0);
  if (total <= 0) return { ...EQUAL };
  for (const k of FACTOR_KEYS) w[k] = Math.round((w[k] / total) * 1000) / 1000;
  return w;
}

/** Score each variant on the same out-of-sample years. */
export function compareVariants(months: BacktestMonth[], opts: { trainingYears?: number } = {}): Comparison | null {
  const years = [...new Set(months.map((m) => yearOf(m.date)))].sort();
  // Need some history before the first test year, plus a one-year gap.
  const firstTest = years[0] + 1 + (opts.trainingYears ?? 3);
  const testYears = years.filter((y) => y >= firstTest);
  if (testYears.length < 3) return null;

  const weightsByYear = testYears.map((year) => ({
    year,
    // Results for a month end twelve months later, so training stops two calendar years back.
    weights: learnWeights(months.filter((m) => yearOf(m.date) <= year - 2)),
  }));
  const latestWeights = learnWeights(months);

  type Scorer = (m: BacktestMonth) => (number | null)[];
  const scorers: Record<Variant['key'], Scorer> = {
    equal: (m) => m.rows.map((r) => r.score),
    sector: (m) => sectorNeutral(m.rows).map((f) => composite(f, EQUAL)),
    learned: (m) => {
      const w = weightsByYear.find((x) => x.year === yearOf(m.date))!.weights;
      return m.rows.map((r) => composite(r.factors, w));
    },
  };
  const labels: Record<Variant['key'], [string, string]> = {
    equal: ['Equal weights (live)', 'The engine on this site: five factors, equal weights, ranked across the whole group.'],
    sector: ['Sector-neutral', 'Each factor compared with the company’s sector average before ranking.'],
    learned: ['Learned weights', 'Weights set each year from how each factor did in earlier years only (walk-forward).'],
  };

  const test = months.filter((m) => testYears.includes(yearOf(m.date)));
  const variants: Variant[] = (Object.keys(scorers) as Variant['key'][]).map((key, vi) => {
    const top: Tally = new Map();
    const bottom: Tally = new Map();
    const icByYear = new Map<number, number[]>();
    for (const m of test) {
      const scores = scorers[key](m);
      const rows = m.rows.map((r, i) => ({ r, s: scores[i] })).filter((x): x is { r: BacktestRow; s: number } => x.s !== null);
      if (rows.length < 20) continue;
      const y = yearOf(m.date);
      const q = fifths(rows.map((x) => x.s));
      rows.forEach((x, i) => {
        if (q[i] === 4) tally(top, y, x.r.excess > 0);
        if (q[i] === 0) tally(bottom, y, x.r.excess > 0);
      });
      (icByYear.get(y) ?? icByYear.set(y, []).get(y)!).push(spearman(rows.map((x) => x.s), rows.map((x) => x.r.excess)));
    }
    const all = testYears.map((_, i) => i);
    const icOf = (picks: number[]) => mean(picks.flatMap((i) => icByYear.get(testYears[i]) ?? []));
    return {
      key,
      label: labels[key][0],
      description: labels[key][1],
      ic: icOf(all),
      icRange: yearBootstrap(testYears.length, icOf, 101 + vi),
      topBeat: shareFromPicks(top, testYears, all),
      topBeatRange: yearBootstrap(testYears.length, (p) => shareFromPicks(top, testYears, p), 201 + vi),
      bottomBeat: shareFromPicks(bottom, testYears, all),
      ...(key === 'learned' ? { weights: latestWeights, weightsByYear } : {}),
    };
  });

  return { years: [testYears[0], testYears.at(-1)!], months: test.length, variants };
}
