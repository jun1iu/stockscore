# StockScore

A stock score that tells you how much to trust it.

StockScore ranks 70 large US companies on five factors taken from their SEC annual reports and share prices. Next to every score it shows the engine's own track record: how often companies with a similar score beat the S&P 500 over the following year, measured by a backtest that only ever uses what was public at the time.

The honest result is that the score barely beats a coin flip. The app is built to say so.

Not investment advice.

## What it does

- **Stock pages** (`/stocks/AAPL`): the score, the trust line for that score range, each factor with its raw figures, formula, rank in the group and a link to the SEC filing, the score's history since 2012, and the track record by score range.
- **Rankings** (`/rankings`): all scored companies, sortable by any factor and filterable by sector.
- **Track record** (`/track-record`): the backtest by score fifth, which factors carried signal, year-by-year rank correlation, and what flatters the numbers.
- **Method** (`/method`): every rule the engine uses.
- **API**: `GET /api/stocks`, `GET /api/stocks/{ticker}`, `GET /api/track-record`.

## Live refresh (the backend)

A scheduled job on Vercel (`/api/cron/refresh`, weekdays at 07:17 UTC) keeps the data current:

1. **Prices** from [Massive](https://massive.com) (formerly Polygon.io). One market-wide call returns every US stock's close for a day, so all 70 companies cost one request. Splits and dividends are fetched market-wide too; dividends only for days not yet checked, kept on the snapshot.
2. **Month-ends.** When a month ends, its last trading day's close becomes that month's price, and the total return adds the dividends paid in the month. Checked against Yahoo for October 2026: closes match exactly; total returns match within 0.05 points for 66 of 71 tickers and within 0.2 for the rest (Yahoo reinvests on the ex-date).
3. **Splits** restate earlier prices in post-split units and extend the list used to convert filing share counts.
4. **Annual reports.** Each company's SEC filing index is checked; only companies with a new 10-K are re-read. A report not yet in the SEC's XBRL feed waits for the next run.
5. **Re-score and re-grade** all 70 companies, then write the snapshot to a private Vercel Blob and invalidate the cached pages.

Design choices: the refresh is a pure function of (old snapshot, data services, clock), so it's tested with fakes (`src/lib/pipeline/refresh.test.ts`); running it twice changes nothing; writes are conditional on the version read, so overlapping runs can't overwrite each other; requests are paced under Massive's free limit (5 a minute); and a time budget saves progress and resumes next run instead of hitting the 300-second limit. `/status` shows what each run did.

Environment variables on Vercel: `MASSIVE_API_KEY`, `CRON_SECRET` (Vercel sends it to the cron route), `SEC_USER_AGENT` (the SEC asks for a name and contact email), and `BLOB_READ_WRITE_TOKEN` (added when a Blob store is connected).

## How the engine works

| Factor | Measures |
| --- | --- |
| Profitability | Return on assets, net margin |
| Growth | Revenue growth and earnings-per-share growth over 3 years |
| Value | Price to earnings (losses rank last), free cash flow yield |
| Balance sheet | Liabilities ÷ assets, current ratio |
| Momentum | Total return over 6 and 12 months |

Each measure is ranked 0–100 across the group, factors average their measures, and the average of the five factors is ranked again so the final score runs from 0 to 100. The weights are equal and were fixed before the first backtest.

The rules that keep the track record honest, each covered by tests in `src/lib/engine/engine.test.ts`:

- **No look-ahead.** Every figure carries the date its filing was published; scoring a date ignores anything filed later.
- **First published version.** Later reports restate earlier years; the engine keeps what investors saw at the time.
- **Splits.** Filing share counts are converted into the units of split-adjusted prices, so market values are right before and after splits.
- **Month-end prices.** A month is scored with its closing price, and the forward return runs from that close.

Known limit: the 70 companies were chosen because they are large today, so the backtest has survivorship bias. The track record page says so.

## Code

```
src/lib/engine/   pointInTime, metrics, score, backtest, stats: pure TypeScript, shared by the app and the pipeline
src/lib/data.ts   loads the data snapshot and scores the group on the server
src/app/          pages and API routes (Next.js App Router)
scripts/          fetch-data.ts (downloads), build-data.ts (extracts, runs the backtest)
src/data/         universe.ts and the generated snapshot
```

## Running it

```bash
npm install
npm test
npm run dev
```

Running the live refresh locally (writes `data/snapshot.json`):

```bash
MASSIVE_API_KEY=... SEC_USER_AGENT="StockScore your@email" npm run data:refresh
```

Rebuilding the bundled snapshot from scratch:

```bash
SEC_USER_AGENT="StockScore your@email" npm run data:fetch   # SEC asks for a contact address; Yahoo is rate-limited, so this is slow
npm run data:build                                           # writes src/data/generated/ and prints the track record
```

Data: [SEC EDGAR](https://www.sec.gov/edgar/sec-api-documentation), [Massive](https://massive.com) daily prices, and Yahoo Finance monthly history before November 2026.
