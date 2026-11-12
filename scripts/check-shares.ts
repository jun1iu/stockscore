/** Flags month-to-month jumps in implied share counts, which point at a split or units error. */
import companies from '../src/data/generated/companies.json';
import prices from '../src/data/generated/prices.json';
import { monthEnds } from '../src/lib/engine/backtest';
import { measure } from '../src/lib/engine/metrics';
import type { Company, PriceHistory } from '../src/lib/engine/types';

const P = prices as Record<string, PriceHistory>;
let flagged = 0;
for (const c of companies as Company[]) {
  let prev: { d: string; s: number } | null = null;
  for (const d of monthEnds('2012-01-01', '2026-10-31')) {
    const m = measure(c, P[c.ticker], d);
    if (!m) continue;
    const s = m.marketCap / m.price;
    if (prev && (s / prev.s > 1.5 || s / prev.s < 0.67)) {
      console.log(`${c.ticker} ${prev.d} → ${d}: shares ${(prev.s / 1e9).toFixed(2)}B → ${(s / 1e9).toFixed(2)}B`);
      flagged++;
    }
    prev = { d, s };
  }
}
console.log(flagged ? `${flagged} jumps` : 'No jumps');
