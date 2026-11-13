import type { MetricDef } from './engine/score';

export function pct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

/** Signed percentage points, e.g. "+3.2 pts". */
export function points(x: number, digits = 1): string {
  const v = x * 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)} pts`;
}

export function signedPct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined) return '—';
  const v = x * 100;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(digits)}%`;
}

export function money(x: number): string {
  if (x >= 1e12) return `$${(x / 1e12).toFixed(2)}T`;
  if (x >= 1e9) return `$${(x / 1e9).toFixed(0)}B`;
  return `$${(x / 1e6).toFixed(0)}M`;
}

export function usd(x: number): string {
  return `$${x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * "12 Nov 2026" from an ISO date. Spelled out by hand rather than with toLocaleDateString: Node and
 * browsers disagree on some month names ("Sep" / "Sept"), which would break hydration in client charts.
 */
export function date(iso: string): string {
  return `${Number(iso.slice(8, 10))} ${monthYear(iso)}`;
}

export function monthYear(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

export function metric(def: MetricDef, v: number | null): string {
  if (v === null) return def.key === 'peRatio' ? 'Loss' : '—';
  if (def.format === 'percent') return pct(v);
  if (def.format === 'times') return `${v.toFixed(1)}×`;
  return v.toFixed(2);
}
