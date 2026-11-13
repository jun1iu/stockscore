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
import type { Company, PriceHistory } from '../src/lib/engine/types';
import { extractFacts, type RawFacts } from '../src/lib/pipeline/sec-facts';
import { BENCHMARK, UNIVERSE } from '../src/data/universe';

const RAW = join(process.cwd(), 'data/raw');
const OUT = join(process.cwd(), 'src/data/generated');

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
