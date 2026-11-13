import { describe, expect, it } from 'vitest';
import { evaluateHealth } from './health';
import type { RunLog } from './pipeline/snapshot';

const run = (startedAt: string, ok = true): RunLog => ({
  startedAt, finishedAt: startedAt, durationMs: 1000, trigger: 'cron', ok, dataChanged: true, latestTradingDay: null,
  pricesUpdated: 71, monthsClosed: [], newSplits: [], dividendsApplied: 0, newFilings: [], pendingFilings: [],
  requests: { massive: 5, sec: 70 }, warnings: [], ...(ok ? {} : { error: 'Massive 500' }),
});

describe('health', () => {
  const monday = new Date('2026-11-16T09:00:00Z');
  it('is healthy after a weekend with Friday prices', () => {
    expect(evaluateHealth({ asOf: '2026-11-13', runs: [run('2026-11-14T07:17:00Z')] }, monday).ok).toBe(true);
  });
  it('flags stale prices, a failed run, and no runs', () => {
    expect(evaluateHealth({ asOf: '2026-11-06', runs: [run('2026-11-14T07:17:00Z')] }, monday).problems[0]).toMatch(/10 days old/);
    expect(evaluateHealth({ asOf: '2026-11-13', runs: [run('2026-11-16T07:17:00Z', false)] }, monday).problems[0]).toMatch(/failed: Massive 500/);
    expect(evaluateHealth({ asOf: '2026-11-13', runs: [] }, monday).ok).toBe(false);
  });
});
