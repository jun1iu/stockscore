/** Small pure helpers for the hand-drawn SVG charts. */

/** An SVG path through the points, one decimal place. */
export function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join('');
}

/** Index of the point nearest to pixel `px`, for `n` points spread evenly from `x0` to `x1`. */
export function nearestIndex(px: number, x0: number, x1: number, n: number): number {
  if (n < 2 || x1 <= x0) return 0;
  const i = Math.round(((px - x0) / (x1 - x0)) * (n - 1));
  return Math.max(0, Math.min(n - 1, i));
}

/** Axis ticks at 1, 2 and 5 times powers of ten that fall inside [min, max]; thinned to at most `limit`. */
export function logTicks(min: number, max: number, limit = 5): number[] {
  if (!(min > 0) || !(max > min)) return [];
  const out: number[] = [];
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e;
      if (v >= min && v <= max) out.push(Number(v.toPrecision(1)));
    }
  }
  let ticks = out;
  while (ticks.length > limit) ticks = ticks.filter((_, i) => i % 2 === (ticks.length - 1) % 2);
  return ticks;
}

/** A position scale: linear, or logarithmic for prices that grew many times over. */
export function scale(domain: [number, number], range: [number, number], log = false): (v: number) => number {
  const f = log ? Math.log : (v: number) => v;
  const [d0, d1] = [f(domain[0]), f(domain[1])];
  const span = d1 - d0 || 1;
  return (v) => range[0] + ((f(v) - d0) / span) * (range[1] - range[0]);
}
