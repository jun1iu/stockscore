/** Shows which inputs a company has on a date: npx tsx scripts/explain.ts GOOGL 2024-12-31 */
import companies from '../src/data/generated/companies.json';
import prices from '../src/data/generated/prices.json';
import { measure, priceAt } from '../src/lib/engine/metrics';
import { asOf, samePeriod } from '../src/lib/engine/pointInTime';
import type { Company, FactKey, PriceHistory } from '../src/lib/engine/types';

const [ticker, date] = process.argv.slice(2);
const c = (companies as Company[]).find((x) => x.ticker === ticker)!;
const p = (prices as Record<string, PriceHistory>)[ticker];
const rev = asOf(c.facts.revenue, date);
console.log('latest revenue', rev);
for (const k of Object.keys(c.facts) as FactKey[]) {
  const same = rev ? samePeriod(c.facts[k], rev.end, date) : null;
  console.log(k.padEnd(20), same ? same.val : '—', ' periods:', c.facts[k].slice(-4).map((f) => `${f.end}@${f.filed}`).join(' '));
}
console.log('price', p ? priceAt(p, date) : 'no prices');
console.log('measure', JSON.stringify(p ? measure(c, p, date) : null)?.slice(0, 300));
