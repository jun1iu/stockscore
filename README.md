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

Refreshing the data:

```bash
SEC_USER_AGENT="StockScore your@email" npm run data:fetch   # SEC asks for a contact address; Yahoo is rate-limited, so this is slow
npm run data:build                                           # writes src/data/generated/ and prints the track record
```

Data: [SEC EDGAR company facts](https://www.sec.gov/edgar/sec-api-documentation) and Yahoo Finance monthly prices.
