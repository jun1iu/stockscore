import type { RunLog } from './pipeline/snapshot';

export interface Health {
  ok: boolean;
  asOf: string;
  dataAgeDays: number;
  lastRun: Pick<RunLog, 'startedAt' | 'ok' | 'dataChanged' | 'error'> | null;
  problems: string[];
}

const DAY = 86_400_000;

/**
 * Healthy when the latest prices are at most five days old (a weekend plus a market holiday),
 * the last refresh succeeded, and one ran in the last four days. Before the first refresh the
 * bundled snapshot is reported as stale, which is the point: the job should have run by then.
 */
export function evaluateHealth(meta: { asOf: string; runs: RunLog[] }, now: Date): Health {
  const problems: string[] = [];
  const dataAgeDays = Math.floor((now.getTime() - Date.parse(meta.asOf + 'T00:00:00Z')) / DAY);
  if (dataAgeDays > 5) problems.push(`Latest prices are ${dataAgeDays} days old.`);
  const last = meta.runs[0] ?? null;
  if (!last) problems.push('No refresh has run yet.');
  else {
    if (!last.ok) problems.push(`The last refresh failed: ${last.error ?? 'unknown error'}.`);
    const since = (now.getTime() - Date.parse(last.startedAt)) / DAY;
    if (since > 4) problems.push(`No refresh for ${Math.floor(since)} days.`);
  }
  return {
    ok: problems.length === 0,
    asOf: meta.asOf,
    dataAgeDays,
    lastRun: last && { startedAt: last.startedAt, ok: last.ok, dataChanged: last.dataChanged, error: last.error },
    problems,
  };
}
