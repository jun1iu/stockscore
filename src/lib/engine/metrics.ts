import { asOf, samePeriod, sharesInTodaysUnits, yearsBefore } from './pointInTime';
import type { Company, MetricKey, Metrics, PriceHistory, PricePoint } from './types';

/** The last month-end price on or before `date`. */
export function priceAt(history: PriceHistory, date: string): PricePoint | null {
  let best: PricePoint | null = null;
  for (const p of history.points) if (p.date <= date && (!best || p.date > best.date)) best = p;
  return best;
}

/** `date` moved back by whole months, as an ISO date. */
export function monthsBefore(date: string, months: number): string {
  const d = new Date(date + 'T00:00:00Z');
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - months + 1, 0)); // last day of that month
  const day = Math.min(d.getUTCDate(), target.getUTCDate());
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), day)).toISOString().slice(0, 10);
}

function totalReturn(history: PriceHistory, date: string, months: number): number | null {
  const now = priceAt(history, date);
  const then = priceAt(history, monthsBefore(date, months));
  if (!now || !then || then.date === now.date) return null;
  // Require the earlier price to be close to the requested date, so a short history isn't stretched.
  if (then.date < monthsBefore(date, months + 1)) return null;
  return now.adjClose / then.adjClose - 1;
}

const cagr = (now: number, then: number, years: number) => (now > 0 && then > 0 ? (now / then) ** (1 / years) - 1 : null);

/**
 * Everything the engine knows about a company on `date`, from filings published by then.
 * Returns null when the latest annual report lacks the basics.
 */
export function measure(company: Company, prices: PriceHistory, date: string): (Metrics & { earningsYield: number }) | null {
  const F = company.facts;
  const revenue = asOf(F.revenue, date);
  if (!revenue) return null;
  const end = revenue.end;
  const pick = (k: keyof typeof F) => samePeriod(F[k], end, date);
  const netIncome = pick('netIncome');
  const assets = pick('assets');
  const shares = pick('dilutedShares');
  const price = priceAt(prices, date);
  if (!netIncome || !assets || !shares || !price || revenue.val <= 0) return null;
  if (price.date < monthsBefore(date, 1)) return null; // stale or delisted

  const ocf = pick('operatingCashFlow');
  const capex = pick('capex');
  const equity = pick('equity');
  const liabilities = pick('liabilities');
  const currentAssets = pick('currentAssets');
  const currentLiabilities = pick('currentLiabilities');

  const sharesNow = sharesInTodaysUnits(shares.val, shares.filed, prices.splits);
  const marketCap = price.close * sharesNow;
  const fcf = ocf ? ocf.val - (capex?.val ?? 0) : null;
  const totalLiabilities = liabilities?.val ?? (equity ? assets.val - equity.val : null);

  const revenue3 = yearsBefore(F.revenue, revenue, 3);
  let epsGrowth3y: number | null = null;
  if (revenue3) {
    const ni3 = samePeriod(F.netIncome, revenue3.end, revenue.filed);
    const sh3 = samePeriod(F.dilutedShares, revenue3.end, revenue.filed);
    if (ni3 && sh3) {
      const epsNow = netIncome.val / sharesNow;
      const epsThen = ni3.val / sharesInTodaysUnits(sh3.val, sh3.filed, prices.splits);
      epsGrowth3y = cagr(epsNow, epsThen, 3);
    }
  }

  const values: Record<MetricKey, number | null> = {
    returnOnAssets: netIncome.val / assets.val,
    netMargin: netIncome.val / revenue.val,
    revenueGrowth3y: revenue3 ? cagr(revenue.val, revenue3.val, 3) : null,
    epsGrowth3y,
    peRatio: netIncome.val > 0 ? marketCap / netIncome.val : null,
    fcfYield: fcf !== null ? fcf / marketCap : null,
    liabilitiesToAssets: totalLiabilities !== null ? totalLiabilities / assets.val : null,
    currentRatio: currentAssets && currentLiabilities && currentLiabilities.val > 0 ? currentAssets.val / currentLiabilities.val : null,
    return6m: totalReturn(prices, date, 6),
    return12m: totalReturn(prices, date, 12),
  };

  return {
    values,
    // P/E is shown, but ranked through its inverse so loss-makers rank last instead of dropping out.
    earningsYield: netIncome.val / marketCap,
    returnOnEquity: equity && equity.val > 0 ? netIncome.val / equity.val : null,
    price: price.close,
    marketCap,
    source: { accn: revenue.accn, filed: revenue.filed, periodEnd: end, form: revenue.form },
  };
}
