/**
 * Runs the live refresh locally against data/snapshot.json (or Blob, if BLOB_READ_WRITE_TOKEN is set).
 *
 *   MASSIVE_API_KEY=... SEC_USER_AGENT="StockScore you@example.com" npm run data:refresh
 *
 * Optional: --now=2026-11-14T02:00:00Z to pretend it's another day.
 */
import { runRefresh } from '../src/lib/pipeline/run';

const nowArg = process.argv.find((a) => a.startsWith('--now='))?.slice(6);
runRefresh('local', { now: nowArg ? new Date(nowArg) : undefined })
  .then((log) => {
    console.log(JSON.stringify(log, null, 1));
    process.exit(log.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
