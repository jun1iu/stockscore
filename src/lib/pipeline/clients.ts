/**
 * The two outside services the refresh job talks to. Each is an interface so tests can pass fakes.
 *
 * Massive (formerly Polygon.io) free plan: end-of-day data, about 5 requests a minute. The job is
 * built around its market-wide endpoints, so one request covers all 70 companies.
 * SEC EDGAR: free, asks for a named User-Agent with a contact address and under 10 requests a second.
 */
import type { RawFacts } from './sec-facts';
import type { Dividend } from './prices';
import type { Split } from '../engine/types';

export interface MarketData {
  /** Closing prices for every US stock on `date`, or null if the market was shut or data isn't out yet. */
  dailyCloses(date: string): Promise<Map<string, number> | null>;
  /** Splits executed in [from, to], market-wide. */
  splits(from: string, to: string): Promise<(Split & { ticker: string })[]>;
  /** Cash dividends going ex in [from, to], market-wide. */
  dividends(from: string, to: string): Promise<Dividend[]>;
  requests(): number;
}

export interface Filings {
  /** The company's most recent original annual report (10-K), from its filing index. */
  latestAnnualReport(cik: number): Promise<{ accn: string; filed: string } | null>;
  companyFacts(cik: number): Promise<RawFacts>;
  requests(): number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Spaces requests out and retries politely when a service says "too many". */
class Pacer {
  private last = 0;
  private count = 0;
  constructor(private gapMs: number, private retryMs: number) {}
  async fetch(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const wait = this.last + this.gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.last = Date.now();
      this.count++;
      const res = await fetch(url, init);
      if (res.status !== 429 || attempt >= 3) return res;
      await sleep(this.retryMs * attempt);
    }
  }
  get requests() {
    return this.count;
  }
}

export function massiveClient(opts: { apiKey: string; gapMs?: number; base?: string }): MarketData {
  const base = opts.base ?? 'https://api.massive.com';
  const pacer = new Pacer(opts.gapMs ?? 12_500, 60_000);
  const headers = { Authorization: `Bearer ${opts.apiKey}`, Accept: 'application/json' };

  async function json(url: string) {
    const res = await pacer.fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`Massive ${res.status} for ${new URL(url).pathname}`);
    return res.json();
  }
  async function all<T>(first: string, maxPages = 10): Promise<T[]> {
    const out: T[] = [];
    let url: string | undefined = first;
    for (let pages = 0; url; pages++) {
      // Better to fail the run than to quietly miss records.
      if (pages >= maxPages) throw new Error(`Massive returned more than ${maxPages} pages for ${new URL(first).pathname}`);
      const j = (await json(url)) as { results?: T[]; next_url?: string };
      out.push(...(j.results ?? []));
      url = j.next_url;
    }
    return out;
  }

  return {
    async dailyCloses(date) {
      const res = await pacer.fetch(`${base}/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`, { headers, cache: 'no-store' });
      // The free plan answers 403 for a day that isn't available to it yet.
      if (res.status === 403 || res.status === 404) return null;
      if (!res.ok) throw new Error(`Massive ${res.status} for daily closes on ${date}`);
      const j = (await res.json()) as { resultsCount?: number; results?: { T: string; c: number }[] };
      if (!j.resultsCount || !j.results?.length) return null;
      return new Map(j.results.map((r) => [r.T, r.c]));
    },
    async splits(from, to) {
      const rows = await all<{ ticker: string; execution_date: string; split_from: number; split_to: number }>(
        `${base}/v3/reference/splits?execution_date.gte=${from}&execution_date.lte=${to}&limit=1000`,
      );
      return rows.filter((r) => r.split_from > 0).map((r) => ({ ticker: r.ticker, date: r.execution_date, ratio: r.split_to / r.split_from }));
    },
    async dividends(from, to) {
      const rows = await all<{ ticker: string; ex_dividend_date: string; cash_amount: number; currency?: string }>(
        `${base}/v3/reference/dividends?ex_dividend_date.gte=${from}&ex_dividend_date.lte=${to}&limit=1000`,
        25,
      );
      return rows.filter((r) => (r.currency ?? 'USD') === 'USD' && r.cash_amount > 0).map((r) => ({ ticker: r.ticker, exDate: r.ex_dividend_date, amount: r.cash_amount }));
    },
    requests: () => pacer.requests,
  };
}

export function secClient(opts: { userAgent: string; gapMs?: number }): Filings {
  const pacer = new Pacer(opts.gapMs ?? 150, 10_000);
  const headers = { 'User-Agent': opts.userAgent, Accept: 'application/json' };
  const cik10 = (cik: number) => String(cik).padStart(10, '0');
  async function json(url: string) {
    const res = await pacer.fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) throw new Error(`SEC ${res.status} for ${new URL(url).pathname}`);
    return res.json();
  }
  return {
    async latestAnnualReport(cik) {
      const j = (await json(`https://data.sec.gov/submissions/CIK${cik10(cik)}.json`)) as {
        filings: { recent: { accessionNumber: string[]; form: string[]; filingDate: string[] } };
      };
      const r = j.filings.recent;
      const i = r.form.findIndex((f) => f === '10-K');
      return i < 0 ? null : { accn: r.accessionNumber[i], filed: r.filingDate[i] };
    },
    async companyFacts(cik) {
      return (await json(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10(cik)}.json`)) as RawFacts;
    },
    requests: () => pacer.requests,
  };
}
