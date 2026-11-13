# Hosting notes

Everything StockScore needs outside the code, for moving it to another host.

## Runtime

- Next.js 16 app (App Router, Cache Components). Needs a Node.js server or a platform that runs Next.js route handlers and `'use cache'`.
- Pages and API routes read one snapshot (prices, filings, track record). Bundled copy: `src/data/generated/`. Live copy: written by the refresh job.

## Storage

- Live snapshot: one JSON file, about 2.5 MB, at `stockscore/snapshot.json` in a private Vercel Blob store (`stockscore-snapshot`, iad1).
- Replaceable: `src/lib/pipeline/storage.ts` is the only file that knows about Blob. Without `BLOB_READ_WRITE_TOKEN` it uses `data/snapshot.json` on disk. Any object store with conditional writes (S3, R2) fits the same two functions.

## Scheduled job

- `GET /api/cron/refresh` with `Authorization: Bearer $CRON_SECRET`, weekdays 07:17 UTC (`vercel.json`).
- Takes up to about a minute normally; set a 300-second limit. Elsewhere, any scheduler that can send that header works (GitHub Actions, Cloudflare Cron Triggers).

## Environment variables

| Name | What |
| --- | --- |
| `MASSIVE_API_KEY` | Massive (formerly Polygon.io) free plan key |
| `SEC_USER_AGENT` | `StockScore <contact email>`; the SEC requires a name and contact |
| `CRON_SECRET` | Random string; the scheduler sends it to the refresh route |
| `BLOB_READ_WRITE_TOKEN` | Set by Vercel when the Blob store is connected |

## Domains

- `stockscore.jun-liu.net`: CNAME in Cloudflare DNS (zone jun-liu.net), DNS only, pointing at the host. Currently `0fdb5f29e684c556.vercel-dns-017.com`.
- `*.jun-liu.net` is a proxied wildcard to a Cloudflare Tunnel; a specific record overrides it.

## Monitoring

- `/api/health` returns 503 when data is stale or the last refresh failed. `.github/workflows/health.yml` checks it each weekday and needs the site's URL updated if the host changes.

## Usage to watch

- November 2026: the Vercel Hobby account was disabled for exceeding a usage limit after a day of many deploys and refreshes. Suspect: `'use cache'` entries holding the whole snapshot and every stock page's data, rewritten on each deploy and refresh. Cache smaller pieces before relying on a free tier again.
