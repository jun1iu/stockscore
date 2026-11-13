import type { Metadata } from 'next';
import { getMeta } from '@/lib/data';
import { date } from '@/lib/format';

export const metadata: Metadata = { title: 'Data status' };

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' });

export default async function Status() {
  const meta = await getMeta();
  const last = meta.runs[0];
  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">Live refresh</p>
        <h1>Data status</h1>
        <p className="lede">
          Every weekday a scheduled job fetches the latest closing prices, splits and dividends from Massive, checks the SEC for
          new annual reports, re-scores all 70 companies and re-runs the track record. This page shows what each run did.
        </p>
      </header>

      <section className="stats" aria-label="Freshness">
        <p className="stat"><b>{date(meta.asOf)}</b><span>latest closing prices</span></p>
        <p className="stat"><b>{meta.source === 'refresh' ? 'Live' : 'Bundled'}</b><span>{meta.source === 'refresh' ? `snapshot written ${time(meta.builtAt)}` : 'snapshot shipped with the code; the first refresh replaces it'}</span></p>
        <p className="stat"><b>{last ? (last.ok ? 'OK' : 'Failed') : '—'}</b><span>{last ? `last run ${time(last.startedAt)}` : 'no runs yet'}</span></p>
        <p className="stat"><b>{meta.runs.length}</b><span>runs kept in the log</span></p>
      </section>

      <section className="panel" aria-labelledby="runs">
        <h2 id="runs">Recent runs</h2>
        {meta.runs.length === 0 ? (
          <p className="muted">No runs yet.</p>
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Started</th><th>Result</th><th>Prices to</th><th className="num">Tickers updated</th><th>Months closed</th>
                  <th className="num">Dividends</th><th>New reports</th><th className="num">Requests</th><th className="num">Time</th>
                </tr>
              </thead>
              <tbody>
                {meta.runs.map((r) => (
                  <tr key={r.startedAt}>
                    <td>{time(r.startedAt)} <span className="muted small">{r.trigger}</span></td>
                    <td className={r.ok ? 'up' : 'down'}>{r.ok ? (r.dataChanged ? 'Updated' : 'Nothing new') : 'Failed'}</td>
                    <td>{r.latestTradingDay ? date(r.latestTradingDay) : '—'}</td>
                    <td className="num">{r.pricesUpdated}</td>
                    <td>{r.monthsClosed.join(', ') || '—'}</td>
                    <td className="num">{r.dividendsApplied}</td>
                    <td>{r.newFilings.map((f) => f.ticker).join(', ') || '—'}</td>
                    <td className="num">{r.requests.massive + r.requests.sec}</td>
                    <td className="num">{Math.round(r.durationMs / 1000)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {last && (last.error || last.warnings.length > 0 || last.pendingFilings.length > 0 || last.newSplits.length > 0) && (
          <>
            <h3>Notes from the last run</h3>
            <ul className="list">
              {last.error && <li className="down">{last.error}</li>}
              {last.newSplits.map((s) => <li key={s.ticker + s.date}>{s.ticker} split {s.ratio}-for-1 on {date(s.date)}; earlier prices restated.</li>)}
              {last.pendingFilings.map((f) => <li key={f}>{f}: annual report listed, figures not in the SEC data feed yet.</li>)}
              {last.warnings.slice(0, 10).map((w) => <li key={w}>{w}</li>)}
            </ul>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="how">
        <h2 id="how">How the job works</h2>
        <ul className="list">
          <li><b>Few requests.</b> One market-wide call returns every US stock’s close for a day, so 70 companies cost one request. Splits and dividends are also fetched market-wide, and dividends only for days not checked yet.</li>
          <li><b>Month-ends.</b> When a month ends, its last trading day’s close becomes that month’s price; total returns add the cash dividends paid in the month.</li>
          <li><b>Splits.</b> A new split restates earlier prices in post-split units and is added to the list used to convert filing share counts.</li>
          <li><b>Annual reports.</b> Each company’s SEC filing index is checked; only companies with a new 10-K are re-read, and a report whose figures haven’t reached the SEC’s data feed waits for the next run.</li>
          <li><b>Safe to repeat.</b> Prices are rebuilt from the last month-end each time, so running twice changes nothing. Writes are conditional, so two overlapping runs can’t overwrite each other, and a slow catch-up saves its progress and resumes.</li>
        </ul>
      </section>
    </div>
  );
}
