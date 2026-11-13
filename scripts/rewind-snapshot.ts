/**
 * Writes data/snapshot.json as the bundled snapshot cut back to a date, so a local refresh has
 * something to catch up on. Used to check the refresh against prices already on file.
 *
 *   npx tsx scripts/rewind-snapshot.ts 2026-10-31
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { bundledSnapshot } from '../src/lib/pipeline/bundled';

const to = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(to ?? '')) throw new Error('Usage: rewind-snapshot.ts YYYY-MM-DD');
const s = bundledSnapshot();
const prices = Object.fromEntries(
  Object.entries(s.prices).map(([t, h]) => [t, { ...h, points: h.points.filter((p) => p.date <= to), splits: h.splits.filter((x) => x.date <= to) }]),
);
mkdirSync('data', { recursive: true });
writeFileSync('data/snapshot.json', JSON.stringify({ ...s, asOf: to, prices }));
console.log(`Rewound to ${to}`);
