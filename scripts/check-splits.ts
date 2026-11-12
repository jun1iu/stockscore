/** Prints market values around known stock splits, to check share counts line up with prices. */
import companies from '../src/data/generated/companies.json';
import prices from '../src/data/generated/prices.json';
import { scoreGroup } from '../src/lib/engine/score';
import type { Company, PriceHistory } from '../src/lib/engine/types';

const C = companies as Company[];
const P = prices as Record<string, PriceHistory>;
for (const d of ['2019-12-31', '2023-12-31', '2024-12-31', P.SPY.points.at(-1)!.date]) {
  const e = scoreGroup(C, P, d);
  const pick = (t: string) => {
    const x = e.find((v) => v.ticker === t);
    return x ? `${t} $${(x.metrics.marketCap / 1e9).toFixed(0)}B P/E ${x.metrics.values.peRatio?.toFixed(1)} score ${x.score.toFixed(0)}` : `${t} -`;
  };
  console.log(d, e.length, '|', ['NVDA', 'AAPL', 'TSLA', 'GOOGL', 'WMT'].map(pick).join(' | '));
}
