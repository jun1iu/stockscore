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

export function date(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function monthYear(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function metric(def: MetricDef, v: number | null): string {
  if (v === null) return def.key === 'peRatio' ? 'Loss' : '—';
  if (def.format === 'percent') return pct(v);
  if (def.format === 'times') return `${v.toFixed(1)}×`;
  return v.toFixed(2);
}
