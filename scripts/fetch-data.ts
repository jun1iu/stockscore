/**
 * Downloads raw SEC company facts and monthly Yahoo Finance prices into data/raw/.
 *
 *   SEC_USER_AGENT="StockScore you@example.com" npm run data:fetch
 *
 * The SEC asks every client to name itself and a contact address in the User-Agent and to stay
 * under 10 requests a second. Yahoo rate-limits hard, so prices are fetched one at a time and a
 * refused request waits longer before each retry. Files already downloaded are kept, so a run
 * that stops part-way can simply be started again.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BENCHMARK, UNIVERSE } from '../src/data/universe';

const RAW = join(process.cwd(), 'data/raw');
const UA = process.env.SEC_USER_AGENT ?? 'StockScore research tool';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const force = process.argv.includes('--force');

function valid(path: string, check: (json: unknown) => boolean): boolean {
  try {
    return check(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return false;
  }
}

async function get(url: string, tries = 6): Promise<string> {
  for (let i = 1; ; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.ok) return res.text();
    if (i >= tries || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
    const wait = 60_000 * i;
    console.log(`  ${res.status}, waiting ${wait / 1000}s`);
    await sleep(wait);
  }
}

async function main() {
  mkdirSync(join(RAW, 'sec'), { recursive: true });
  mkdirSync(join(RAW, 'prices'), { recursive: true });

  for (const c of UNIVERSE) {
    const path = join(RAW, 'sec', `${c.ticker}.json`);
    if (!force && valid(path, (j) => typeof (j as { cik?: unknown }).cik === 'number')) continue;
    const cik = String(c.cik).padStart(10, '0');
    console.log(`SEC ${c.ticker}`);
    writeFileSync(path, await get(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`));
    await sleep(200);
  }

  const now = Math.floor(Date.now() / 1000);
  for (const t of [...UNIVERSE.map((c) => c.ticker), BENCHMARK.ticker]) {
    const path = join(RAW, 'prices', `${t}.json`);
    const ok = (j: unknown) => Array.isArray((j as { chart?: { result?: { timestamp?: unknown }[] } }).chart?.result?.[0]?.timestamp);
    if (!force && existsSync(path) && valid(path, ok)) continue;
    console.log(`Prices ${t}`);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${t}?period1=1230768000&period2=${now}&interval=1mo&events=split%7Cdiv`;
    writeFileSync(path, await get(url));
    await sleep(20_000);
  }
  console.log('Done');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
