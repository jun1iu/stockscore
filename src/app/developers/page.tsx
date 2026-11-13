import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'API' };

const BASE = 'https://stockscore.jun-liu.net';

const ENDPOINTS = [
  {
    path: '/api/stocks',
    what: 'Today’s ranking: every scored company with its score, rank and five factor scores.',
    example: `{
  "asOf": "2026-11-12",
  "stocks": [
    { "ticker": "MRK", "name": "Merck", "sector": "Health care", "rank": 1, "score": 100,
      "factors": { "profitability": 76, "growth": 61, "value": 74, "balanceSheet": 55, "momentum": 92 } }
  ]
}`,
  },
  {
    path: '/api/stocks/{ticker}',
    what: 'One company: score, every input and its rank, the SEC filing it came from, the track record for its score range with a 95% range, monthly score history, and what changed since the previous month-end.',
    example: `{
  "ticker": "NVDA", "asOf": "2026-11-12",
  "evaluation": { "score": 91.3, "rank": 7, "factors": { … }, "metrics": { "values": { "peRatio": 35.5, … } } },
  "trust": { "band": { "lo": 80, "hi": 100 }, "outcome": { "beat": 0.528, "n": 2195 }, "range": [0.477, 0.585] },
  "change": { "since": "2026-10-31", "scoreFrom": 98.6, "scoreTo": 91.3, "factors": [ … ] },
  "source": { "form": "10-K", "filed": "2026-02-25", "url": "https://www.sec.gov/Archives/…" }
}`,
  },
  {
    path: '/api/track-record',
    what: 'The backtest: results by score fifth and range, 95% ranges, factor signal, and the out-of-sample comparison of alternative engines.',
    example: `{ "start": "2012-01-31", "end": "2025-10-31", "observations": 10771, "ic": 0.032,
  "quintiles": [ … ], "uncertainty": { "ic": [-0.037, 0.097], … }, "comparison": { "variants": [ … ] } }`,
  },
  {
    path: '/api/status',
    what: 'Data freshness and the log of recent refresh runs.',
    example: `{ "asOf": "2026-11-12", "source": "refresh", "runs": [ { "ok": true, "pricesUpdated": 71, … } ] }`,
  },
  {
    path: '/api/health',
    what: '200 when the data is fresh and the last refresh worked, 503 with the reasons otherwise. Never cached.',
    example: `{ "ok": true, "asOf": "2026-11-12", "dataAgeDays": 1, "problems": [] }`,
  },
];

export default function Developers() {
  return (
    <div className="page prose">
      <header className="page__head">
        <p className="eyebrow">For developers</p>
        <h1>API</h1>
        <p className="lede">
          Everything on the site is available as JSON. No key needed, callable from any website (CORS is open), and cached for up to an hour.
          Scores update after each weekday refresh; see <Link href="/status">data status</Link>.
        </p>
      </header>

      {ENDPOINTS.map((e) => (
        <section key={e.path} className="panel endpoint">
          <h2><span className="endpoint__method">GET</span> <code>{e.path}</code></h2>
          <p>{e.what}</p>
          <pre className="code"><code>curl {BASE}{e.path.replace('{ticker}', 'NVDA')}</code></pre>
          <pre className="code"><code>{e.example}</code></pre>
        </section>
      ))}

      <section className="panel">
        <h2>Fair use</h2>
        <p>
          The data comes from SEC EDGAR and Massive and is for education. It is not investment advice. Please cache responses rather than
          polling: the data changes once a weekday.
        </p>
      </section>
    </div>
  );
}
