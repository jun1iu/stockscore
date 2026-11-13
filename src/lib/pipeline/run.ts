import { BENCHMARK } from '@/data/universe';
import { bundledSnapshot } from './bundled';
import { massiveClient, secClient } from './clients';
import { refreshSnapshot } from './refresh';
import type { RunLog } from './snapshot';
import { readSnapshot, writeSnapshot } from './storage';

export class ConfigError extends Error {}

/** Read the stored snapshot, bring it up to date, and write it back. */
export async function runRefresh(trigger: RunLog['trigger'], opts: { now?: Date; massiveGapMs?: number; budgetMs?: number } = {}): Promise<RunLog> {
  const apiKey = process.env.MASSIVE_API_KEY;
  if (!apiKey) throw new ConfigError('MASSIVE_API_KEY is not set.');
  const ua = process.env.SEC_USER_AGENT;

  const stored = await readSnapshot();
  const old = stored?.snapshot ?? bundledSnapshot();
  const { snapshot, log } = await refreshSnapshot(old, {
    market: massiveClient({ apiKey, gapMs: opts.massiveGapMs }),
    filings: ua ? secClient({ userAgent: ua }) : null,
    benchmark: BENCHMARK.ticker,
    now: opts.now ?? new Date(),
    trigger,
    deadline: opts.budgetMs ? Date.now() + opts.budgetMs : undefined,
  });
  // Always written, so a run that found nothing still shows up on the status page.
  await writeSnapshot(snapshot, stored?.etag ?? null);
  return log;
}
