import type { TrackRecord } from '../engine/backtest';
import type { Company, PriceHistory } from '../engine/types';
import type { Dividend } from './prices';

/** What one refresh run did, kept on the snapshot so the status page can show it. */
export interface RunLog {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  trigger: 'cron' | 'manual' | 'local';
  ok: boolean;
  /** Whether prices or filings changed. A run that finds nothing new is still logged. */
  dataChanged: boolean;
  latestTradingDay: string | null;
  pricesUpdated: number;
  monthsClosed: string[];
  newSplits: { ticker: string; date: string; ratio: number }[];
  dividendsApplied: number;
  newFilings: { ticker: string; accn: string; filed: string }[];
  /** Annual reports listed by the SEC whose figures haven't reached the XBRL API yet. */
  pendingFilings: string[];
  requests: { massive: number; sec: number };
  warnings: string[];
  error?: string;
}

export interface Snapshot {
  version: 1;
  /** ENGINE_VERSION of the code that computed trackRecord and history. */
  engineVersion?: number;
  /** Date of the latest price in the snapshot. */
  asOf: string;
  /** When this snapshot was produced. */
  builtAt: string;
  source: 'bundled' | 'refresh';
  companies: Company[];
  /** Every company plus the benchmark. */
  prices: Record<string, PriceHistory>;
  trackRecord: TrackRecord;
  history: Record<string, { date: string; score: number }[]>;
  /**
   * Dividends for our tickers since the last month-end, and the last ex-date checked. Massive only
   * lists dividends market-wide (thousands a month, mostly funds), so the job fetches only the
   * days since its last run and keeps what it found here.
   */
  dividends?: { through: string; items: Dividend[] };
  runs: RunLog[];
}

export const MAX_RUNS_KEPT = 30;

/** Bump when the backtest's output changes shape, so the next refresh recomputes it even if no data changed. */
export const ENGINE_VERSION = 2;
