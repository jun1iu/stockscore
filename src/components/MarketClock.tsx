'use client';

import { useSyncExternalStore } from 'react';
import { session } from '@/lib/market';

function subscribe(onTick: () => void) {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
}
const second = () => Math.floor(Date.now() / 1000);
const noClock = () => null;

/**
 * New York time and whether the market is trading, ticking once a second.
 * The server renders a blank face of the same width; the time appears on hydration.
 */
export function MarketClock() {
  const now = useSyncExternalStore(subscribe, second, noClock);
  const s = now === null ? null : session(new Date(now * 1000));
  return (
    <p className="clock" data-open={s?.open ?? undefined}>
      <span className="clock__lamp" aria-hidden="true" />
      <span className="clock__city">New York</span>
      <time className="clock__time" suppressHydrationWarning>{s ? s.time : '--:--:--'}</time>
      <span className="clock__state">{s ? (s.open ? 'Market open' : 'Market closed') : ''}</span>
      <span className="clock__next">{s?.next}</span>
    </p>
  );
}
