/** Average rank of each value, 1-based, with ties sharing the mean of their ranks. */
export function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(xs.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const r = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = r;
    i = j + 1;
  }
  return out;
}

/**
 * Percentile of each value within the group: 0 for the lowest, 100 for the highest.
 * Missing values stay missing. A group of one scores 50.
 */
export function percentiles(values: (number | null)[]): (number | null)[] {
  const present = values.map((v, i) => [v, i] as const).filter((p): p is readonly [number, number] => p[0] !== null);
  const out: (number | null)[] = values.map(() => null);
  if (present.length === 1) out[present[0][1]] = 50;
  if (present.length < 2) return out;
  const r = ranks(present.map((p) => p[0]));
  present.forEach(([, i], k) => (out[i] = (100 * (r[k] - 1)) / (present.length - 1)));
  return out;
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2) return 0;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Spearman rank correlation: Pearson correlation of the ranks. */
export function spearman(a: number[], b: number[]): number {
  return pearson(ranks(a), ranks(b));
}

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** Value at quantile q (0-1) with linear interpolation. */
export function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export interface Outcome {
  n: number;
  /** Share that beat the benchmark. */
  beat: number;
  median: number;
  p10: number;
  p90: number;
}

export function summarize(excess: number[]): Outcome {
  const s = [...excess].sort((a, b) => a - b);
  return {
    n: s.length,
    beat: s.filter((x) => x > 0).length / s.length,
    median: quantile(s, 0.5),
    p10: quantile(s, 0.1),
    p90: quantile(s, 0.9),
  };
}
