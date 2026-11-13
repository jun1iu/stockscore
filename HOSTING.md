# Hosting notes

Everything StockScore needs outside the code. It runs on the home server (an iMac running Ubuntu), behind Caddy and a Cloudflare Tunnel; the deploy setup lives in the `homeserver` repo.

## Runtime

- Next.js 16 app (App Router, Cache Components) run with `next start` in a Docker container (`app-stockscore`), read-only root filesystem, Next's cache on a `/tmp` tmpfs.
- The image is built from `deploy/dockerfiles/stockscore.Dockerfile` in the homeserver repo. The home server checks `main` every minute and rebuilds on a new commit; a failed build leaves the running version up.
- Pages and API routes read one snapshot (prices, filings, track record). Bundled copy: `src/data/generated/`. Live copy: written by the refresh job.

## Storage

- Live snapshot: one JSON file, about 2.5 MB, at `data/snapshot.json` (`src/lib/pipeline/storage.ts`). On the home server `/app/data` is the Docker volume `stockscore-data`, included in the nightly restic backup.
- Without the file (a fresh volume or a local run) the app serves the bundled copy, and the first refresh writes the live one.

## Scheduled job

- `GET /api/cron/refresh` with `Authorization: Bearer $CRON_SECRET`, weekdays 07:17 UTC.
- Run from the home server's user crontab by `deploy/cron/stockscore-refresh.sh` (homeserver repo), which calls the route inside the container. It takes up to about a minute normally; the route keeps a 300-second budget.

## Environment variables

Kept in `deploy/env/stockscore.env` on the home server (gitignored there).

| Name | What |
| --- | --- |
| `MASSIVE_API_KEY` | Massive (formerly Polygon.io) free plan key |
| `SEC_USER_AGENT` | `StockScore <contact email>`; the SEC requires a name and contact |
| `CRON_SECRET` | Random string; the scheduler sends it to the refresh route |

## Domains

- `stockscore.jun-liu.net`: covered by the proxied `*.jun-liu.net` wildcard to the Cloudflare Tunnel; no record of its own.

## Monitoring

- `/api/health` returns 503 when data is stale or the last refresh failed. Nothing polls it at the moment; point an uptime monitor at it to be told.
- Cloudflare's Bot Fight Mode is on for jun-liu.net and answers scripts calling `/api/*` from servers with a "Just a moment..." challenge, so a monitor outside the home network sees a failure even when the data is fine. Fix: turn Bot Fight Mode off in Cloudflare (Security → Bots); on the free plan it can't be skipped per path. Details in the homeserver repo's `deploy/TUNNEL.md`.

## Usage to watch

- `'use cache'` entries hold the whole snapshot and every stock page's data and are rewritten on each deploy and refresh. Self-hosted they live in the server's memory; cache smaller pieces if memory use grows.
