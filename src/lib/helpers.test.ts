import { describe, expect, it } from 'vitest';
import { findCompany, UNIVERSE } from '../data/universe';
import { linePath, logTicks, nearestIndex, scale } from './chart';
import { date, metric, money, monthYear, pct, points, signedPct, usd } from './format';
import { filterRows, sortRows, type Row } from './rankings';

describe('format', () => {
  it('formats percentages and treats missing values as a dash', () => {
    expect(pct(0.5284)).toBe('52.8%');
    expect(pct(0.5284, 0)).toBe('53%');
    expect(pct(null)).toBe('—');
    expect(pct(Number.NaN)).toBe('—');
  });
  it('signs points and percentages with a true minus', () => {
    expect(points(0.032)).toBe('+3.2 pts');
    expect(points(-0.27, 0)).toBe('−27 pts');
    expect(points(0)).toBe('0.0 pts');
    expect(signedPct(-0.151)).toBe('−15.1%');
    expect(signedPct(undefined)).toBe('—');
  });
  it('scales money', () => {
    expect(money(4.26e12)).toBe('$4.26T');
    expect(money(312e9)).toBe('$312B');
    expect(money(950e6)).toBe('$950M');
    expect(usd(1173.7)).toBe('$1,173.70');
  });
  it('formats dates the same on the server and in any browser', () => {
    expect(date('2026-11-12')).toBe('12 Nov 2026');
    expect(monthYear('2012-01-31')).toBe('Jan 2012');
    expect(monthYear('2020-09-30')).toBe('Sep 2020');
    expect(date('2026-03-01')).toBe('1 Mar 2026');
  });
  it('shows a loss instead of a negative P/E', () => {
    const pe = { key: 'peRatio', label: '', formula: '', better: 'lower', format: 'times' } as const;
    expect(metric(pe, null)).toBe('Loss');
    expect(metric(pe, 35.46)).toBe('35.5×');
  });
});

describe('findCompany', () => {
  it('accepts any case and surrounding space', () => {
    expect(findCompany(' nvda ')?.name).toBe('Nvidia');
  });
  it('rejects anything outside the group', () => {
    expect(findCompany('ZZZ')).toBeNull();
    expect(findCompany('')).toBeNull();
    expect(findCompany('__proto__')).toBeNull();
  });
  it('has no duplicate tickers', () => {
    expect(new Set(UNIVERSE.map((u) => u.ticker)).size).toBe(UNIVERSE.length);
  });
});

describe('chart helpers', () => {
  it('draws a path', () => {
    expect(linePath([0, 10], [5, 2.25])).toBe('M0.0,5.0L10.0,2.3');
  });
  it('finds the nearest point and clamps outside the plot', () => {
    expect(nearestIndex(50, 0, 100, 11)).toBe(5);
    expect(nearestIndex(-20, 0, 100, 11)).toBe(0);
    expect(nearestIndex(999, 0, 100, 11)).toBe(10);
    expect(nearestIndex(5, 0, 100, 1)).toBe(0);
  });
  it('picks round log ticks inside the range', () => {
    expect(logTicks(0.3, 210, 10)).toEqual([0.5, 1, 2, 5, 10, 20, 50, 100, 200]);
    expect(logTicks(0.3, 210).length).toBeLessThanOrEqual(5);
    expect(logTicks(0.3, 210).every((t) => t >= 0.3 && t <= 210)).toBe(true);
    expect(logTicks(0, 10)).toEqual([]);
  });
  it('scales linearly and logarithmically', () => {
    expect(scale([0, 100], [200, 0])(50)).toBe(100);
    expect(scale([1, 100], [0, 100], true)(10)).toBeCloseTo(50);
    expect(scale([5, 5], [0, 100])(5)).toBe(0);
  });
});

describe('rankings', () => {
  const row = (ticker: string, rank: number, score: number, growth: number | null, sector = 'Technology', delta: number | null = 0): Row => ({
    ticker, name: `${ticker} Corp`, sector, rank, score, delta,
    factors: { profitability: 50, growth, value: 50, balanceSheet: 50, momentum: 50 },
  });
  const rows = [row('AAA', 1, 90, 10), row('BBB', 2, 70, null, 'Energy'), row('CCC', 3, 50, 80, 'Energy', -12)];

  it('filters by sector and by ticker or name', () => {
    expect(filterRows(rows, 'Energy', '').map((r) => r.ticker)).toEqual(['BBB', 'CCC']);
    expect(filterRows(rows, 'All', ' ccc ').map((r) => r.ticker)).toEqual(['CCC']);
    expect(filterRows(rows, 'Energy', 'aaa')).toEqual([]);
  });
  it('sorts both ways and keeps missing values last', () => {
    expect(sortRows(rows, 'growth', 'desc').map((r) => r.ticker)).toEqual(['CCC', 'AAA', 'BBB']);
    expect(sortRows(rows, 'growth', 'asc').map((r) => r.ticker)).toEqual(['AAA', 'CCC', 'BBB']);
    expect(sortRows(rows, 'delta', 'asc')[0].ticker).toBe('CCC');
  });
  it('breaks ties by overall rank and does not mutate its input', () => {
    expect(sortRows(rows, 'value', 'desc').map((r) => r.ticker)).toEqual(['AAA', 'BBB', 'CCC']);
    expect(rows[0].ticker).toBe('AAA');
  });
});
