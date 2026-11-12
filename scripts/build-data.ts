/**
 * Turns data/raw/ into the compact files the app ships with, then runs the backtest.
 *
 *   npm run data:build
 *
 * Writes src/data/generated/{companies,prices,track-record,history}.json.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runBacktest } from '../src/lib/engine/backtest';
import type { Company, Fact, FactKey, Facts, PriceHistory } from '../src/lib/engine/types';
import { BENCHMARK, UNIVERSE } from '../src/data/universe';

const RAW = join(process.cwd(), 'data/raw');
const OUT = join(process.cwd(), 'src/data/generated');

/** XBRL tags for each figure, in order of preference. Companies switch tags over the years. */
const TAGS: Record<FactKey, string[]> = {
  revenue: [
    'RevenueFromContractWithCustomerExcludingAssessedTax',
    'Revenues',
    'SalesRevenueNet',
    'RevenueFromContractWithCustomerIncludingAssessedTax',
    'SalesRevenueGoodsNet',
  ],
  netIncome: ['NetIncomeLoss', 'ProfitLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic'],
  operatingCashFlow: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets'],
  equity: ['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'],
  assets: ['Assets'],
  liabilities: ['Liabilities'],
  currentAssets: ['AssetsCurrent'],
  currentLiabilities: ['LiabilitiesCurrent'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding'],
};
const FLOWS = new Set<FactKey>(['revenue', 'netIncome', 'operatingCashFlow', 'capex', 'dilutedShares']);
const ANNUAL_FORMS = new Set(['10-K', '10-K/A', '10-KT', '20-F']);

interface RawRow { start?: string; end: string; val: number; accn: string; form: string; filed: string; frame?: string }
type RawFacts = { cik: number; entityName: string; facts: { 'us-gaap'?: Record<string, { units: Record<string, RawRow[]> }> } };

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86_400_000;

/**
 * For each period, keep the figure from the first annual report that published it.
 * Later reports restate earlier years; using the first version keeps the backtest honest.
 */
export function extractFacts(raw: RawFacts): Facts {
  const gaap = raw.facts['us-gaap'] ?? {};
  const out = {} as Facts;
  for (const [key, tags] of Object.entries(TAGS) as [FactKey, string[]][]) {
    // Rank candidates for each period: earliest filing first; within one filing, the value the SEC
    // marks as the standard figure for the period (it carries a `frame`); then the preferred tag.
    const best = new Map<string, { fact: Fact; rank: [string, number, number] }>();
    tags.forEach((tag, priority) => {
      for (const rows of Object.values(gaap[tag]?.units ?? {})) {
        for (const r of rows) {
          if (!ANNUAL_FORMS.has(r.form)) continue;
          if (FLOWS.has(key)) {
            if (!r.start || days(r.start, r.end) < 330 || days(r.start, r.end) > 400) continue;
          } else if (r.start) continue;
          const rank: [string, number, number] = [r.filed, r.frame ? 0 : 1, priority];
          const prev = best.get(r.end);
          if (!prev || compare(rank, prev.rank) < 0) best.set(r.end, { fact: { end: r.end, filed: r.filed, val: r.val, accn: r.accn, form: r.form }, rank });
        }
      }
    });
    out[key] = [...best.values()].map((b) => b.fact).sort((a, b) => a.end.localeCompare(b.end));
  }

  // Every annual report states diluted earnings per share, so net income ÷ EPS implies a share count.
  // It fills gaps (Alphabet only tagged counts from 2022) and catches counts filed in the wrong
  // units (Nvidia's 2011 report gives thousands, Merck's 2012 report millions).
  const eps = new Map<string, RawRow>();
  for (const tag of ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted']) {
    for (const rows of Object.values(gaap[tag]?.units ?? {})) {
      for (const r of rows) {
        if (!ANNUAL_FORMS.has(r.form) || !r.start || days(r.start, r.end) < 330 || days(r.start, r.end) > 400) continue;
        const prev = eps.get(r.end);
        if (!prev || r.filed < prev.filed || (r.filed === prev.filed && r.frame && !prev.frame)) eps.set(r.end, r);
      }
    }
  }
  // Real changes in a company's share count stay well within 100x (Nvidia's splits and buybacks
  // since 2009 come to about 40x), so a count under 1% of its largest was filed in thousands or millions.
  // ConocoPhillips reported in thousands from 2012 to 2021.
  const largest = Math.max(0, ...out.dilutedShares.map((f) => f.val));
  out.dilutedShares = out.dilutedShares.map((f) => {
    let val = f.val;
    while (val > 0 && val < largest / 100) val *= 1000;
    return val === f.val ? f : { ...f, val };
  });

  const byEnd = new Map(out.dilutedShares.map((f) => [f.end, f]));
  for (const ni of out.netIncome) {
    const e = eps.get(ni.end);
    // EPS is rounded to the cent, so it only implies a precise count when it's at least 10 cents.
    if (!e || Math.abs(e.val) < 0.1 || ni.val === 0 || Math.sign(e.val) !== Math.sign(ni.val)) continue;
    const implied: Fact = { end: ni.end, filed: e.filed > ni.filed ? e.filed : ni.filed, val: Math.round(ni.val / e.val), accn: e.accn, form: e.form };
    const tagged = byEnd.get(ni.end);
    if (tagged) {
      const ratio = tagged.val / implied.val;
      // Only override a reported count that is off by a units mistake, not by a judgement call.
      if (ratio > 0.01 && ratio < 100) continue;
    }
    byEnd.set(ni.end, implied);
  }
  out.dilutedShares = [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
  return out;
}


function compare(a: [string, number, number], b: [string, number, number]): number {
  return a[0].localeCompare(b[0]) || a[1] - b[1] || a[2] - b[2];
}

interface RawChart {
  chart: { result: { meta: { regularMarketTime?: number }; timestamp: number[]; events?: { splits?: Record<string, { date: number; numerator: number; denominator: number }> }; indicators: { quote: { close: (number | null)[] }[]; adjclose: { adjclose: (number | null)[] }[] } }[] };
}

const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(0, 10);

/** Yahoo labels each month by its first trading day; the close is the month's last. Label it by month-end. */
export function extractPrices(ticker: string, raw: RawChart): PriceHistory {
  const r = raw.chart.result[0];
  const close = r.indicators.quote[0].close;
  const adj = r.indicators.adjclose[0].adjclose;
  const lastTrade = r.meta.regularMarketTime ? iso(r.meta.regularMarketTime) : null;
  const points: PriceHistory['points'] = [];
  r.timestamp.forEach((ts, i) => {
    const c = close[i];
    const a = adj[i];
    if (c == null || a == null) return;
    const d = new Date((ts + 86_400) * 1000);
    let date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    // The current month isn't over: its "close" is the latest trade.
    if (lastTrade && lastTrade < date) date = lastTrade;
    points.push({ date, close: Math.round(c * 10000) / 10000, adjClose: Math.round(a * 10000) / 10000 });
  });
  const splits = Object.values(r.events?.splits ?? {})
    .map((s) => ({ date: iso(s.date), ratio: s.numerator / s.denominator }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return { ticker, points, splits };
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const companies: Company[] = UNIVERSE.map((u) => {
    const raw = JSON.parse(readFileSync(join(RAW, 'sec', `${u.ticker}.json`), 'utf8')) as RawFacts;
    if (raw.cik !== u.cik) throw new Error(`${u.ticker}: CIK ${raw.cik} does not match ${u.cik}`);
    return { ticker: u.ticker, name: u.name, cik: u.cik, sector: u.sector, facts: extractFacts(raw) };
  });
  const prices: Record<string, PriceHistory> = {};
  const missing: string[] = [];
  for (const t of [...UNIVERSE.map((u) => u.ticker), BENCHMARK.ticker]) {
    try {
      prices[t] = extractPrices(t, JSON.parse(readFileSync(join(RAW, 'prices', `${t}.json`), 'utf8')) as RawChart);
    } catch {
      missing.push(t);
    }
  }
  if (missing.includes(BENCHMARK.ticker)) throw new Error('Benchmark prices are missing; run npm run data:fetch');
  if (missing.length) console.warn(`No prices yet for ${missing.join(', ')}; they are left out. Run npm run data:fetch.`);
  const { [BENCHMARK.ticker]: benchmark, ...stockPrices } = prices;
  const latest = benchmark.points.at(-1)!.date;

  console.time('backtest');
  const { record, history } = runBacktest(companies, stockPrices, benchmark, { start: '2012-01-01', end: latest });
  console.timeEnd('backtest');

  const write = (name: string, data: unknown) => writeFileSync(join(OUT, name), JSON.stringify(data));
  write('companies.json', companies);
  write('prices.json', prices);
  write('track-record.json', { ...record, builtAt: latest });
  write('history.json', history);
  console.log(JSON.stringify({ ...record, icYearly: record.icYearly.length }, null, 1));
}

if (process.argv[1]?.endsWith('build-data.ts')) main();
