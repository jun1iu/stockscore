import { describe, expect, it } from 'vitest';
import { forwardReturn, monthEnds } from './backtest';
import { measure, monthsBefore } from './metrics';
import { asOf, sharesInTodaysUnits, yearsBefore } from './pointInTime';
import { band, scoreGroup } from './score';
import { percentiles, spearman, summarize } from './stats';
import type { Company, Fact, Facts, PriceHistory } from './types';
import { extractFacts } from '../pipeline/sec-facts';

const fact = (end: string, filed: string, val: number): Fact => ({ end, filed, val, accn: `a-${end}-${filed}`, form: '10-K' });

describe('point in time', () => {
  const revenue = [fact('2020-12-31', '2021-02-10', 100), fact('2021-12-31', '2022-02-10', 120), fact('2022-12-31', '2023-02-09', 150)];

  it('only sees filings published by the date', () => {
    expect(asOf(revenue, '2022-02-09')?.val).toBe(100);
    expect(asOf(revenue, '2022-02-10')?.val).toBe(120);
    expect(asOf(revenue, '2021-01-01')).toBeNull();
  });

  it('finds the year-earlier figure across 52/53-week years', () => {
    const shifted = [fact('2019-12-28', '2020-02-01', 80), fact('2022-12-31', '2023-02-09', 150)];
    expect(yearsBefore(shifted, shifted[1], 3)?.val).toBe(80);
  });

  it('restates share counts into post-split units', () => {
    const splits = [{ date: '2020-08-31', ratio: 4 }, { date: '2024-06-10', ratio: 10 }];
    expect(sharesInTodaysUnits(100, '2019-12-31', splits)).toBe(4000);
    expect(sharesInTodaysUnits(100, '2021-12-31', splits)).toBe(1000);
    expect(sharesInTodaysUnits(100, '2025-01-31', splits)).toBe(100);
  });

  it('does not adjust twice when the split came before the report was filed', () => {
    // Year ends 31 Jan, split 26 Feb, report filed 15 Mar already shows post-split counts.
    const splits = [{ date: '2024-02-26', ratio: 3 }];
    expect(sharesInTodaysUnits(8000, '2024-03-15', splits)).toBe(8000);
  });

  it('moves dates back by months, clamping to month-end', () => {
    expect(monthsBefore('2024-03-31', 1)).toBe('2024-02-29');
    expect(monthsBefore('2024-03-31', 12)).toBe('2023-03-31');
    expect(monthsBefore('2023-01-31', -12)).toBe('2024-01-31');
  });
});

describe('extracting filings', () => {
  it('keeps the first published version of a restated year', () => {
    const row = (end: string, val: number, filed: string) => ({ start: '2021-01-01', end, val, accn: filed, form: '10-K', filed });
    const raw = {
      cik: 1,
      entityName: 'Test',
      facts: { 'us-gaap': { Revenues: { units: { USD: [row('2021-12-31', 500, '2023-02-01'), row('2021-12-31', 480, '2022-02-01')] } } } },
    };
    const facts = extractFacts(raw);
    expect(facts.revenue).toHaveLength(1);
    expect(facts.revenue[0]).toMatchObject({ val: 480, filed: '2022-02-01' });
  });

  it('repairs share counts filed in thousands', () => {
    const row = (y: number, val: number) => ({ start: `${y}-01-01`, end: `${y}-12-31`, val, accn: `a${y}`, form: '10-K', filed: `${y + 1}-02-15` });
    const raw = {
      cik: 1,
      entityName: 'Test',
      facts: { 'us-gaap': { WeightedAverageNumberOfDilutedSharesOutstanding: { units: { shares: [row(2020, 1_300_000_000), row(2021, 1_250_000), row(2022, 1_200_000_000)] } } } },
    };
    expect(extractFacts(raw).dilutedShares.map((f) => f.val)).toEqual([1_300_000_000, 1_250_000_000, 1_200_000_000]);
  });

  it('ignores quarterly figures', () => {
    const raw = {
      cik: 1,
      entityName: 'Test',
      facts: { 'us-gaap': { Revenues: { units: { USD: [{ start: '2021-10-01', end: '2021-12-31', val: 9, accn: 'x', form: '10-K', filed: '2022-02-01' }] } } } },
    };
    expect(extractFacts(raw).revenue).toHaveLength(0);
  });
});

describe('statistics', () => {
  it('ranks to percentiles with ties and gaps', () => {
    expect(percentiles([10, 30, 20, null])).toEqual([0, 100, 50, null]);
    expect(percentiles([5, 5, 1])).toEqual([75, 75, 0]);
    expect(percentiles([7, null])).toEqual([50, null]);
  });

  it('computes rank correlation', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
  });

  it('summarises outcomes', () => {
    expect(summarize([-1, 1, 2, 3]).beat).toBe(0.75);
  });

  it('puts scores in fifths', () => {
    expect(band(0).key).toBe('0-20');
    expect(band(79.9).key).toBe('60-80');
    expect(band(100).key).toBe('80-100');
  });
});

/** A small made-up group whose figures differ only by size. */
function group(n: number, extra?: (i: number, f: Facts) => void) {
  const companies: Company[] = [];
  const prices: Record<string, PriceHistory> = {};
  const dates = monthEnds('2018-01-01', '2024-12-31');
  for (let i = 0; i < n; i++) {
    const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023];
    const series = (k: number) => years.map((y) => fact(`${y}-12-31`, `${y + 1}-02-15`, (k + i) * (1 + 0.05 * i) ** (y - 2017)));
    const facts: Facts = {
      revenue: series(100),
      netIncome: series(10),
      operatingCashFlow: series(15),
      capex: series(3),
      equity: series(50),
      assets: series(200),
      liabilities: series(150 - i),
      currentAssets: series(60),
      currentLiabilities: series(40),
      dilutedShares: years.map((y) => fact(`${y}-12-31`, `${y + 1}-02-15`, 10)),
    };
    extra?.(i, facts);
    companies.push({ ticker: `T${i}`, name: `Test ${i}`, cik: i, sector: 'Test', facts });
    prices[`T${i}`] = { ticker: `T${i}`, splits: [], points: dates.map((date, k) => ({ date, close: 10 + i + k * 0.1 * i, adjClose: 10 + i + k * 0.1 * i })) };
  }
  return { companies, prices };
}

describe('scoring', () => {
  it('scores a group from 0 to 100 and ranks it', () => {
    const { companies, prices } = group(5);
    const evals = scoreGroup(companies, prices, '2022-06-30');
    expect(evals).toHaveLength(5);
    expect(Math.max(...evals.map((e) => e.score))).toBe(100);
    expect(Math.min(...evals.map((e) => e.score))).toBe(0);
    expect(evals.map((e) => e.rank).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is unchanged by anything filed after the date (no look-ahead)', () => {
    const date = '2022-06-30';
    const before = scoreGroup(...Object.values(group(5)) as [Company[], Record<string, PriceHistory>], date);
    // Add a wildly different report for every company, filed after the date.
    const { companies, prices } = group(5, (i, f) => {
      f.revenue.push(fact('2022-03-31', '2022-07-01', 1e9 * (5 - i)));
      f.netIncome.push(fact('2022-03-31', '2022-07-01', -1e9 * i));
    });
    const after = scoreGroup(companies, prices, date);
    expect(after.map((e) => [e.ticker, e.score])).toEqual(before.map((e) => [e.ticker, e.score]));
  });

  it('ranks a loss-maker last on price to earnings', () => {
    const { companies, prices } = group(4, (i, f) => {
      if (i === 3) f.netIncome = f.netIncome.map((x) => ({ ...x, val: -5 }));
    });
    const evals = scoreGroup(companies, prices, '2022-06-30');
    const loser = evals.find((e) => e.ticker === 'T3')!;
    expect(loser.metrics.values.peRatio).toBeNull();
    expect(loser.metricScores.peRatio).toBe(0);
  });

  it('needs a recent price', () => {
    const { companies, prices } = group(1);
    expect(measure(companies[0], prices.T0, '2026-06-30')).toBeNull();
  });
});

describe('backtest returns', () => {
  const h: PriceHistory = { ticker: 'X', splits: [], points: monthEnds('2020-01-01', '2021-12-31').map((date, i) => ({ date, close: 100 + i, adjClose: 100 + i })) };
  it('measures twelve months from an exact month-end', () => {
    expect(forwardReturn(h, '2020-01-31', 12)).toBeCloseTo(112 / 100 - 1);
  });
  it('refuses when the later price does not exist yet', () => {
    expect(forwardReturn(h, '2021-06-30', 12)).toBeNull();
  });
});
