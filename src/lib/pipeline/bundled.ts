import companies from '@/data/generated/companies.json';
import history from '@/data/generated/history.json';
import prices from '@/data/generated/prices.json';
import track from '@/data/generated/track-record.json';
import { BENCHMARK } from '@/data/universe';
import type { TrackRecord } from '../engine/backtest';
import type { Company, PriceHistory } from '../engine/types';
import { ENGINE_VERSION, type Snapshot } from './snapshot';

/** The snapshot shipped with the code. Used until the first live refresh, and if storage is down. */
export function bundledSnapshot(): Snapshot {
  const p = prices as Record<string, PriceHistory>;
  return {
    version: 1,
    engineVersion: ENGINE_VERSION,
    asOf: p[BENCHMARK.ticker].points.at(-1)!.date,
    builtAt: (track as { builtAt: string }).builtAt,
    source: 'bundled',
    companies: companies as Company[],
    prices: p,
    trackRecord: track as unknown as TrackRecord,
    history: history as Snapshot['history'],
    runs: [],
  };
}
