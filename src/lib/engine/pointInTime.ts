import type { Fact, Split } from './types';

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(iso + 'T00:00:00Z');

/**
 * The latest figure that had been published on `date`.
 * Only filings filed on or before `date` count, so a backtest never sees the future.
 */
export function asOf(series: Fact[], date: string): Fact | null {
  let best: Fact | null = null;
  for (const f of series) {
    if (f.filed > date) continue;
    if (!best || f.end > best.end) best = f;
  }
  return best;
}

/**
 * The same figure for the period `years` earlier, as known when `current` was filed.
 * Matches period ends within 40 days to allow for 52/53-week fiscal years.
 */
export function yearsBefore(series: Fact[], current: Fact, years: number): Fact | null {
  const target = toTime(current.end) - years * 365.25 * DAY;
  let best: Fact | null = null;
  for (const f of series) {
    if (f.filed > current.filed) continue;
    if (Math.abs(toTime(f.end) - target) > 40 * DAY) continue;
    if (!best || Math.abs(toTime(f.end) - target) < Math.abs(toTime(best.end) - target)) best = f;
  }
  return best;
}

/** The figure for exactly the same period end, if published by `date`. */
export function samePeriod(series: Fact[], end: string, date: string): Fact | null {
  return series.find((f) => f.end === end && f.filed <= date) ?? null;
}

/**
 * How many of today's shares one share counted on `since` became by `until`.
 * Filings report share counts before later splits; prices are adjusted for all of them.
 */
export function splitFactor(splits: Split[], since: string, until: string): number {
  let factor = 1;
  for (const s of splits) if (s.date > since && s.date <= until) factor *= s.ratio;
  return factor;
}

/**
 * A share count published on `published`, restated in today's share units.
 * Pass the filing date, not the period end: when a split happens after the year ends but before
 * the report is filed, accounting rules require the report to show post-split counts already.
 * (Walmart's 3-for-1 split in February 2024 is the case in this group.)
 * Split-adjusted prices are quoted in today's units at every date, so the two multiply to
 * the true market value at the time. This only converts units: the value itself is unchanged,
 * so using later splits here does not leak information into a backtest.
 */
export function sharesInTodaysUnits(shares: number, published: string, splits: Split[]): number {
  return shares * splitFactor(splits, published, '9999-12-31');
}
