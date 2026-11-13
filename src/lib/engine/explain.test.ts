import { describe, expect, it } from 'vitest';
import { explainChange, summarize } from './explain';
import type { Evaluation } from './types';

const ev = (score: number, rank: number, accn: string, momentum: number, ret: number): Evaluation => ({
  ticker: 'X', date: '2026-11-12', composite: score, score, rank, groupSize: 70,
  factors: { profitability: 60, growth: 60, value: 40, balanceSheet: 50, momentum },
  metricScores: { returnOnAssets: 60, netMargin: 60, revenueGrowth3y: 60, epsGrowth3y: 60, peRatio: 40, fcfYield: 40, liabilitiesToAssets: 50, currentRatio: 50, return6m: momentum, return12m: momentum },
  metrics: {
    values: { returnOnAssets: 0.1, netMargin: 0.2, revenueGrowth3y: 0.1, epsGrowth3y: 0.1, peRatio: 20, fcfYield: 0.04, liabilitiesToAssets: 0.5, currentRatio: 1.2, return6m: ret, return12m: ret },
    returnOnEquity: 0.2, price: 100, marketCap: 1e11,
    source: { accn, filed: accn === 'new' ? '2026-11-05' : '2026-02-01', periodEnd: '2026-09-30', form: '10-K' },
  },
});

describe('score explanations', () => {
  it('names the factor that moved most and the price cause', () => {
    const c = explainChange(ev(70, 10, 'a', 80, 0.3), ev(52, 30, 'a', 30, -0.1), '2026-10-31')!;
    expect(c.factors[0].key).toBe('momentum');
    expect(c.newReport).toBeNull();
    expect(summarize(c)).toBe('Down 18 points, mainly from price moves (momentum down 50)');
  });

  it('flags a new annual report', () => {
    const c = explainChange(ev(50, 30, 'a', 50, 0.1), ev(60, 20, 'new', 50, 0.1), '2026-10-31')!;
    expect(c.newReport).toEqual({ filed: '2026-11-05', periodEnd: '2026-09-30' });
  });

  it('says when other companies moved the score', () => {
    const c = explainChange(ev(50, 30, 'a', 50, 0.1), ev(40, 38, 'a', 50, 0.101), '2026-10-31')!;
    expect(c.drivenByPeers).toBe(true);
  });
});
