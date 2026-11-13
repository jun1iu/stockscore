/**
 * Extending a stored month-end price history with new daily closes.
 *
 * The history holds one point per month, labelled with the calendar month-end, plus at most one
 * "partial" point for the month in progress, labelled with its latest trading day. `close` is in
 * today's share units (adjusted for every split so far); `adjClose` is a total-return index, so the
 * ratio between two points is the return including dividends.
 */
import { splitFactor } from '../engine/pointInTime';
import type { PriceHistory, PricePoint, Split } from '../engine/types';

export interface Dividend {
  ticker: string;
  exDate: string;
  /** Cash per share on the ex-date, in the share units of that date. */
  amount: number;
}

export const monthEnd = (iso: string) => {
  const d = new Date(iso + 'T00:00:00Z');
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};
export const isMonthEnd = (iso: string) => monthEnd(iso) === iso;
export const sameMonth = (a: string, b: string) => a.slice(0, 7) === b.slice(0, 7);

/** The last point that closes a month. Partial points sit after it. */
export function lastFinal(h: PriceHistory): PricePoint {
  for (let i = h.points.length - 1; i >= 0; i--) if (isMonthEnd(h.points[i].date)) return h.points[i];
  throw new Error(`${h.ticker}: no month-end price to build on`);
}

/**
 * Records a split that happened after the history was stored. New closes arrive in post-split
 * units, so every earlier price is divided by the ratio; the split is added to the list so filing
 * share counts are converted to the same units.
 */
export function applySplit(h: PriceHistory, split: Split): PriceHistory {
  if (h.splits.some((s) => s.date === split.date)) return h;
  return {
    ...h,
    points: h.points.map((p) => (p.date < split.date ? { ...p, close: p.close / split.ratio, adjClose: p.adjClose / split.ratio } : p)),
    splits: [...h.splits, split].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Sets the price for `label` from a close on `tradeDate`, building the total return from the last
 * month-end point: (close + dividends paid in between) ÷ previous close. Any partial point for an
 * earlier day is replaced, so running the same update twice gives the same result.
 */
export function setClose(
  h: PriceHistory,
  point: { label: string; tradeDate: string; close: number },
  dividends: Dividend[],
): PriceHistory {
  const base = lastFinal(h);
  if (point.label <= base.date) return h; // already closed
  if (monthsBetween(base.date, point.label) > 1) {
    throw new Error(`${h.ticker}: month-end before ${point.label} hasn't been recorded`);
  }
  const paid = dividends
    .filter((d) => d.ticker === h.ticker && d.exDate > base.date && d.exDate <= point.tradeDate)
    // A dividend declared before a later split is per pre-split share.
    .reduce((sum, d) => sum + d.amount / splitFactor(h.splits, d.exDate, '9999-12-31'), 0);
  const adjClose = (base.adjClose * (point.close + paid)) / base.close;
  const kept = h.points.filter((p) => p.date <= base.date);
  return { ...h, points: [...kept, { date: point.label, close: round(point.close), adjClose: round(adjClose) }] };
}

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
}

const round = (x: number) => Math.round(x * 10000) / 10000;
