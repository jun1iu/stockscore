import { describe, expect, it } from 'vitest';
import type { Company, Fact, Facts, PriceHistory } from '../engine/types';
import type { Filings, MarketData } from './clients';
import { applySplit, setClose } from './prices';
import { refreshSnapshot } from './refresh';
import type { RawFacts } from './sec-facts';
import type { Snapshot } from './snapshot';

const hist = (ticker: string, points: [string, number, number][]): PriceHistory => ({
  ticker,
  splits: [],
  points: points.map(([date, close, adjClose]) => ({ date, close, adjClose })),
});

describe('extending a price history', () => {
  const h = hist('X', [['2026-09-30', 100, 50], ['2026-10-31', 110, 55], ['2026-11-12', 112, 56]]);

  it('replaces the partial month and counts dividends since month-end', () => {
    const out = setClose(h, { label: '2026-11-20', tradeDate: '2026-11-20', close: 120 }, [{ ticker: 'X', exDate: '2026-11-14', amount: 2 }]);
    expect(out.points).toHaveLength(3);
    expect(out.points.at(-1)).toEqual({ date: '2026-11-20', close: 120, adjClose: (55 * 122) / 110 });
  });

  it('gives the same answer when run twice', () => {
    const once = setClose(h, { label: '2026-11-20', tradeDate: '2026-11-20', close: 120 }, []);
    expect(setClose(once, { label: '2026-11-20', tradeDate: '2026-11-20', close: 120 }, [])).toEqual(once);
  });

  it('refuses to skip a month-end', () => {
    expect(() => setClose(h, { label: '2027-01-05', tradeDate: '2027-01-05', close: 1 }, [])).toThrow(/month-end/);
  });

  it('puts earlier prices into post-split units', () => {
    const out = applySplit(h, { date: '2026-11-10', ratio: 4 });
    expect(out.points.map((p) => p.close)).toEqual([25, 27.5, 112]);
    expect(out.splits).toEqual([{ date: '2026-11-10', ratio: 4 }]);
    expect(applySplit(out, { date: '2026-11-10', ratio: 4 })).toBe(out);
  });
});

// ---- A whole refresh run against fake services ----------------------------------------------

const fact = (end: string, filed: string, val: number, accn = `a-${end}`): Fact => ({ end, filed, val, accn, form: '10-K' });

function company(i: number): Company {
  const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025];
  const series = (k: number) => years.map((y) => fact(`${y}-12-31`, `${y + 1}-02-10`, (k + i) * (1 + 0.04 * i) ** (y - 2019)));
  const facts: Facts = {
    revenue: series(100), netIncome: series(10), operatingCashFlow: series(14), capex: series(3), equity: series(60),
    assets: series(200), liabilities: series(140), currentAssets: series(50), currentLiabilities: series(30),
    dilutedShares: years.map((y) => fact(`${y}-12-31`, `${y + 1}-02-10`, 10)),
  };
  return { ticker: `T${i}`, name: `Test ${i}`, cik: 1000 + i, sector: 'Test', facts };
}

function months(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(from + 'T00:00:00Z'); ; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0))) {
    const iso = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    if (iso > to) return out;
    out.push(iso);
  }
}

function snapshot(): Snapshot {
  const companies = Array.from({ length: 25 }, (_, i) => company(i));
  const dates = months('2019-01-31', '2026-10-31');
  const prices: Record<string, PriceHistory> = {};
  for (const t of [...companies.map((c) => c.ticker), 'SPY']) {
    const seed = t === 'SPY' ? 7 : Number(t.slice(1));
    prices[t] = hist(t, [...dates.map((d, k) => [d, 50 + seed + k * 0.3, 50 + seed + k * 0.35] as [string, number, number]), ['2026-11-12', 80 + seed, 90 + seed]]);
  }
  return {
    version: 1, asOf: '2026-11-12', builtAt: '2026-11-12T00:00:00Z', source: 'bundled', companies, prices,
    trackRecord: {} as Snapshot['trackRecord'], history: {}, runs: [],
  };
}

function fakeMarket(days: Record<string, number>): MarketData & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async dailyCloses(date) {
      calls.push(date);
      if (!(date in days)) return null;
      const m = new Map<string, number>([['SPY', days[date]]]);
      for (let i = 0; i < 25; i++) m.set(`T${i}`, days[date] + i);
      return m;
    },
    async splits() {
      return [{ ticker: 'T3', date: '2026-11-18', ratio: 2 }];
    },
    async dividends() {
      return [{ ticker: 'T1', exDate: '2026-11-25', amount: 1 }];
    },
    requests: () => calls.length + 2,
  };
}

function fakeFilings(newReport: boolean): Filings {
  let n = 0;
  return {
    async latestAnnualReport(cik) {
      n++;
      return cik === 1000 && newReport ? { accn: 'NEW-2026', filed: '2026-11-20' } : { accn: 'a-2025-12-31', filed: '2026-02-10' };
    },
    async companyFacts(): Promise<RawFacts> {
      n++;
      const row = (y: number, val: number, accn: string, filed: string) => ({ start: `${y}-10-01`, end: `${y + 1}-09-30`, val, accn, form: '10-K', filed });
      return { cik: 1000, entityName: 'Test 0', facts: { 'us-gaap': { Revenues: { units: { USD: [row(2025, 999, 'NEW-2026', '2026-11-20')] } } } } };
    },
    requests: () => n,
  };
}

describe('refresh run', () => {
  it('closes October-to-November, adds the latest day, applies splits, dividends and new reports', async () => {
    const old = snapshot();
    // Friday 27 Nov 2026 has data; the 28th and 29th are a weekend; "today" is the 29th.
    const market = fakeMarket({ '2026-11-27': 100 });
    const { snapshot: s, log } = await refreshSnapshot(old, { market, filings: fakeFilings(true), benchmark: 'SPY', now: new Date('2026-11-29T02:00:00Z'), trigger: 'local' });

    expect(log.ok).toBe(true);
    expect(log.latestTradingDay).toBe('2026-11-27');
    expect(market.calls).toEqual(['2026-11-29', '2026-11-28', '2026-11-27']);
    expect(log.pricesUpdated).toBe(26);
    expect(s.asOf).toBe('2026-11-27');
    expect(s.prices.SPY.points.at(-1)).toMatchObject({ date: '2026-11-27', close: 100 });
    // The split halves earlier T3 prices; the dividend lifts T1's total return.
    expect(log.newSplits).toEqual([{ ticker: 'T3', date: '2026-11-18', ratio: 2 }]);
    expect(s.prices.T3.points[0].close).toBeCloseTo(old.prices.T3.points[0].close / 2);
    const t1 = s.prices.T1;
    const base = t1.points.at(-2)!;
    expect(t1.points.at(-1)!.adjClose).toBeCloseTo((base.adjClose * (101 + 1)) / base.close, 3);
    expect(log.newFilings).toEqual([{ ticker: 'T0', accn: 'NEW-2026', filed: '2026-11-20' }]);
    expect(log.dataChanged).toBe(true);
    expect(s.runs[0]).toBe(log);
    expect(s.trackRecord.companies).toBeGreaterThan(0);
  });

  it('closes a month that ended since the last run', async () => {
    const old = snapshot();
    const market = fakeMarket({ '2026-11-30': 101, '2026-12-02': 104 });
    const { snapshot: s, log } = await refreshSnapshot(old, { market, filings: null, benchmark: 'SPY', now: new Date('2026-12-02T23:00:00Z'), trigger: 'local' });
    expect(log.monthsClosed).toEqual(['2026-11']);
    expect(s.prices.SPY.points.slice(-2).map((p) => [p.date, p.close])).toEqual([['2026-11-30', 101], ['2026-12-02', 104]]);
  });

  it('saves dividend progress when out of time, and finishes on the next run', async () => {
    const old = snapshot();
    const days = { '2026-11-27': 100 };
    const first = await refreshSnapshot(old, { market: fakeMarket(days), filings: null, benchmark: 'SPY', now: new Date('2026-11-29T02:00:00Z'), trigger: 'local', deadline: Date.now() - 1 });
    expect(first.log.ok).toBe(true);
    expect(first.log.pricesUpdated).toBe(0);
    expect(first.log.warnings.some((w) => w.startsWith('Dividends checked through'))).toBe(true);
    const second = await refreshSnapshot(first.snapshot, { market: fakeMarket(days), filings: null, benchmark: 'SPY', now: new Date('2026-11-29T02:00:00Z'), trigger: 'local' });
    expect(second.snapshot.prices.SPY.points.at(-1)!.date).toBe('2026-11-27');
    expect(second.snapshot.dividends?.through).toBe('2026-11-27');
  });

  it('does nothing when there is no newer trading day', async () => {
    const old = snapshot();
    const market = fakeMarket({});
    const { snapshot: s, log } = await refreshSnapshot(old, { market, filings: fakeFilings(false), benchmark: 'SPY', now: new Date('2026-11-13T02:00:00Z'), trigger: 'local' });
    expect(log.dataChanged).toBe(false);
    expect(s.prices).toBe(old.prices);
    expect(s.runs).toHaveLength(1);
  });

  it('waits when the SEC lists a report its data API does not have yet', async () => {
    const old = snapshot();
    const filings = fakeFilings(true);
    filings.companyFacts = async () => ({ cik: 1000, entityName: 'Test 0', facts: { 'us-gaap': {} } });
    const { log } = await refreshSnapshot(old, { market: fakeMarket({}), filings, benchmark: 'SPY', now: new Date('2026-11-13T02:00:00Z'), trigger: 'local' });
    expect(log.pendingFilings).toEqual(['T0 NEW-2026']);
    expect(log.newFilings).toEqual([]);
  });
});
