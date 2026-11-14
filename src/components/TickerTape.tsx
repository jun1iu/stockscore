import Link from 'next/link';
import { MarketClock } from './MarketClock';
import { getTape } from '@/lib/data';
import { date, signedPct } from '@/lib/format';

/**
 * The tape that runs under the header on every page: New York time, then every company's
 * last close and its move this month. Closing prices, not live quotes, and the tape says so.
 * The list is rendered twice so the loop has no seam; the copy is hidden from assistive tech.
 */
export async function TickerTape() {
  const { asOf, quotes } = await getTape();
  const run = (copy: boolean) => (
    <ul className="tape__run" aria-hidden={copy || undefined}>
      {quotes.map((q) => (
        <li key={q.ticker}>
          <Link href={`/stocks/${q.ticker}`} tabIndex={copy ? -1 : undefined}>
            <b>{q.ticker}</b>
            <span>{q.price.toFixed(2)}</span>
            {q.change !== null && (
              <span className={q.change >= 0 ? 'up' : 'down'}>
                <i aria-hidden="true">{q.change >= 0 ? '▲' : '▼'}</i> {signedPct(q.change)}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="tape">
      <MarketClock />
      <p className="tape__note">Close {date(asOf).slice(0, -5)} · change this month</p>
      <div className="tape__window" role="region" aria-label={`Closing prices on ${date(asOf)} and change this month`} tabIndex={0}>
        {run(false)}
        {run(true)}
      </div>
    </div>
  );
}
