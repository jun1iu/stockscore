/**
 * The live refresh: bring a snapshot up to date with the latest prices and annual reports,
 * then re-score every company and re-run the backtest.
 *
 * It is a pure function of the old snapshot, the two data services and the clock, so it can be
 * tested with fakes and run twice without harm: prices are rebuilt from the last month-end each
 * time, and filings are only re-read when the SEC lists a report the snapshot doesn't have.
 */
import { runBacktest } from '../engine/backtest';
import type { Company, PriceHistory } from '../engine/types';
import type { Filings, MarketData } from './clients';
import { applySplit, lastFinal, monthEnd, setClose, type Dividend } from './prices';
import { extractFacts } from './sec-facts';
import { ENGINE_VERSION, MAX_RUNS_KEPT, type RunLog, type Snapshot } from './snapshot';

export interface RefreshOptions {
  market: MarketData;
  filings: Filings | null;
  benchmark: string;
  now: Date;
  trigger: RunLog['trigger'];
  /** How many days back to look for the latest trading day. */
  lookbackDays?: number;
  /** Concurrent SEC requests. */
  secConcurrency?: number;
  /** Epoch ms after which no new slow work is started; unfinished work resumes next run. */
  deadline?: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(new Date(Date.parse(date + 'T00:00:00Z') + n * 86_400_000));

export async function refreshSnapshot(old: Snapshot, opts: RefreshOptions): Promise<{ snapshot: Snapshot; log: RunLog }> {
  const started = Date.now();
  const log: RunLog = {
    startedAt: opts.now.toISOString(),
    finishedAt: '',
    durationMs: 0,
    trigger: opts.trigger,
    ok: true,
    dataChanged: false,
    latestTradingDay: null,
    pricesUpdated: 0,
    monthsClosed: [],
    newSplits: [],
    dividendsApplied: 0,
    newFilings: [],
    pendingFilings: [],
    requests: { massive: 0, sec: 0 },
    warnings: [],
  };

  let prices = old.prices;
  let companies = old.companies;
  let dividendState = old.dividends;
  let changed = false;

  try {
    // ---- Prices -------------------------------------------------------------------------------
    const bench = prices[opts.benchmark];
    const latestKnown = bench.points.at(-1)!.date;
    const baseDate = lastFinal(bench).date;
    const today = iso(opts.now);

    // Most recent trading day with data, newest first, never earlier than what we have.
    let latest: { date: string; closes: Map<string, number> } | null = null;
    for (let i = 0; i < (opts.lookbackDays ?? 6); i++) {
      const d = addDays(today, -i);
      if (d <= latestKnown) break;
      const closes = await opts.market.dailyCloses(d);
      if (closes?.has(opts.benchmark)) {
        latest = { date: d, closes };
        break;
      }
    }

    if (latest) {
      log.latestTradingDay = latest.date;
      const tickers = Object.keys(prices);

      // Splits since the last month-end, up to today (closes arrive adjusted for all of them).
      const splits = (await opts.market.splits(addDays(baseDate, 1), today)).filter((s) => tickers.includes(s.ticker));
      for (const s of splits) {
        const h = prices[s.ticker];
        if (h.splits.some((x) => x.date === s.date)) continue;
        prices = { ...prices, [s.ticker]: applySplit(h, { date: s.date, ratio: s.ratio }) };
        log.newSplits.push(s);
      }

      // Only ask for ex-dates not checked yet, a week at a time, and keep what earlier runs found.
      // If time runs short the progress is saved and the next run carries on.
      const known = old.dividends && old.dividends.through >= baseDate ? old.dividends : { through: baseDate, items: [] };
      let dividends: Dividend[] = known.items.filter((d) => d.exDate > baseDate);
      let through = known.through;
      while (through < latest.date) {
        if (opts.deadline && Date.now() > opts.deadline) break;
        const to = addDays(through, 7) < latest.date ? addDays(through, 7) : latest.date;
        const fresh = (await opts.market.dividends(addDays(through, 1), to)).filter((d) => tickers.includes(d.ticker));
        const seen = new Set(dividends.map((d) => `${d.ticker}:${d.exDate}`));
        dividends = [...dividends, ...fresh.filter((d) => !seen.has(`${d.ticker}:${d.exDate}`))];
        through = to;
      }
      dividendState = { through, items: dividends };
      const dividendsComplete = through >= latest.date;
      if (!dividendsComplete) log.warnings.push(`Dividends checked through ${through}; prices wait until the next run catches up.`);

      // Close any months that ended since the last month-end, using their last trading day.
      const monthEnds: { label: string; tradeDate: string; closes: Map<string, number> }[] = [];
      for (let m = monthEnd(addDays(baseDate, 1)); dividendsComplete && m < latest.date.slice(0, 7) + '-01'; m = monthEnd(addDays(m, 1))) {
        if (monthEnds.length >= 3) {
          log.warnings.push(`More than three months to catch up; stopped at ${m}. Run again to continue.`);
          break;
        }
        let found: { day: string; closes: Map<string, number> } | null = null;
        for (let back = 0; back < 6; back++) {
          const day = addDays(m, -back);
          if (day <= baseDate) break;
          const closes = await opts.market.dailyCloses(day);
          if (closes?.has(opts.benchmark)) {
            found = { day, closes };
            break;
          }
        }
        if (!found) {
          log.warnings.push(`No closing prices found for the end of ${m.slice(0, 7)}.`);
          break;
        }
        monthEnds.push({ label: m, tradeDate: found.day, closes: found.closes });
      }

      const steps = dividendsComplete ? [...monthEnds, { label: latest.date, tradeDate: latest.date, closes: latest.closes }] : [];
      const appliedDividends = new Set<string>();
      for (const t of tickers) {
        let h = prices[t];
        for (const step of steps) {
          const close = step.closes.get(t);
          if (close === undefined) {
            log.warnings.push(`${t}: no close on ${step.tradeDate}.`);
            continue;
          }
          if (lastFinal(h).date >= step.label) continue;
          try {
            h = setClose(h, { label: step.label, tradeDate: step.tradeDate, close }, dividends);
          } catch (e) {
            log.warnings.push((e as Error).message);
          }
        }
        dividends.filter((d) => d.ticker === t && d.exDate <= latest!.date).forEach((d) => appliedDividends.add(`${d.ticker}:${d.exDate}`));
        if (h !== prices[t]) {
          prices = { ...prices, [t]: h };
          log.pricesUpdated++;
        }
      }
      log.monthsClosed = monthEnds.map((m) => m.label.slice(0, 7));
      log.dividendsApplied = appliedDividends.size;
      changed = log.pricesUpdated > 0 || log.newSplits.length > 0;
    }

    // ---- Annual reports -----------------------------------------------------------------------
    if (opts.filings) {
      const filings = opts.filings;
      const known = new Map(companies.map((c) => [c.ticker, new Set(Object.values(c.facts).flat().map((f) => f.accn))]));
      const updated = new Map<string, Company>();
      await pool(companies, opts.secConcurrency ?? 4, async (c) => {
        try {
          const latestReport = await filings.latestAnnualReport(c.cik);
          if (!latestReport || known.get(c.ticker)!.has(latestReport.accn)) return;
          const raw = await filings.companyFacts(c.cik);
          const hasIt = Object.values(raw.facts['us-gaap'] ?? {}).some((t) => Object.values(t.units).some((rows) => rows.some((r) => r.accn === latestReport.accn)));
          if (!hasIt) {
            log.pendingFilings.push(`${c.ticker} ${latestReport.accn}`);
            return;
          }
          updated.set(c.ticker, { ...c, facts: extractFacts(raw) });
          log.newFilings.push({ ticker: c.ticker, accn: latestReport.accn, filed: latestReport.filed });
        } catch (e) {
          log.warnings.push(`${c.ticker}: ${(e as Error).message}`);
        }
      });
      if (updated.size) {
        companies = companies.map((c) => updated.get(c.ticker) ?? c);
        changed = true;
      }
    } else {
      log.warnings.push('SEC check skipped: no SEC_USER_AGENT set.');
    }
  } catch (e) {
    log.ok = false;
    log.error = (e as Error).message;
  }

  log.requests = { massive: opts.market.requests(), sec: opts.filings?.requests() ?? 0 };

  let snapshot: Snapshot = old;
  const outdated = old.engineVersion !== ENGINE_VERSION;
  if (log.ok && (changed || outdated)) {
    const { [opts.benchmark]: benchmark, ...stockPrices } = prices;
    const asOf = benchmark.points.at(-1)!.date;
    const { record, history } = runBacktest(companies, stockPrices as Record<string, PriceHistory>, benchmark, { start: '2012-01-01', end: asOf });
    // Dividends before the new month-end are now part of the stored prices.
    const base = lastFinal(benchmark).date;
    const dividends = dividendState && { through: dividendState.through, items: dividendState.items.filter((d) => d.exDate > base) };
    snapshot = { ...old, engineVersion: ENGINE_VERSION, asOf, builtAt: opts.now.toISOString(), source: 'refresh', companies, prices, trackRecord: record, history, dividends };
    log.dataChanged = changed;
  }
  log.finishedAt = new Date(opts.now.getTime() + (Date.now() - started)).toISOString();
  log.durationMs = Date.now() - started;
  // Dividend progress is kept even when nothing else changed, so a slow catch-up isn't repeated.
  if (log.ok && !log.dataChanged && dividendState !== old.dividends) snapshot = { ...snapshot, dividends: dividendState };
  snapshot = { ...snapshot, runs: [log, ...old.runs].slice(0, MAX_RUNS_KEPT) };
  return { snapshot, log };
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}
