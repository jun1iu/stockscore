import type { Metadata } from 'next';
import Link from 'next/link';
import { BeatChart } from '@/components/charts';
import { getMeta } from '@/lib/data';
import { FACTORS } from '@/lib/engine/score';
import { monthYear, pct, points } from '@/lib/format';

export const metadata: Metadata = { title: 'Track record' };

export default async function TrackRecordPage() {
  const t = (await getMeta()).trackRecord;
  const since = t.start.slice(0, 4);
  const top = t.quintiles.at(-1)!;
  const bottom = t.quintiles[0];
  const reliable = Math.abs(t.icTStat) >= 2;
  const maxIc = Math.max(0.1, ...Object.values(t.factorIc).map(Math.abs));

  return (
    <div className="page">
      <header className="page__head">
        <p className="eyebrow">The engine grades itself</p>
        <h1>Track record, {monthYear(t.start)} to {monthYear(t.end)}</h1>
        <p className="lede">
          At every month-end, every company was scored using only the filings and prices public that day. A year later, its total return was
          compared with the S&amp;P 500 (the SPY fund). That gives {t.observations.toLocaleString('en-US')} company-months across{' '}
          {t.companies} companies.
        </p>
      </header>

      <section className="stats" aria-label="Summary">
        <p className="stat"><b>{pct(top.beat, 0)}</b><span>of top-fifth scores beat the S&amp;P 500 over the next year</span></p>
        <p className="stat"><b>{pct(bottom.beat, 0)}</b><span>of bottom-fifth scores did</span></p>
        <p className="stat"><b>{t.ic.toFixed(2)}</b><span>rank correlation between score and next-year result (0 is none, 1 is perfect)</span></p>
        <p className="stat"><b>{t.icTStat.toFixed(1)}</b><span>t-statistic over yearly windows; below 2 means the pattern could be chance</span></p>
      </section>

      <section className="panel verdict-text">
        <h2>{reliable ? 'A weak but measurable signal.' : 'No reliable signal.'}</h2>
        <p>
          {reliable
            ? `Higher scores did somewhat better on average, and the pattern held up across years. It is still small next to the spread of outcomes.`
            : `Higher scores did not reliably lead to better results. In ${pct(t.icPositiveShare, 0)} of months, higher-scoring companies did better on average; a coin flip would give about 50%.`}{' '}
          That matches decades of research: public accounting figures are already in the price. Use the score to read a company quickly, not to
          predict it.
        </p>
      </section>

      <div className="two">
        <section className="panel" aria-labelledby="fifths">
          <h2 id="fifths">By score fifth</h2>
          <p className="muted">Each month, companies were split into five equal groups by score.</p>
          <BeatChart rows={t.quintiles.map((q) => ({ label: q.label.replace(' fifth', ''), outcome: q }))} />
          <div className="tablewrap">
          <table className="table compact">
            <thead><tr><th>Group</th><th className="num">Beat S&amp;P</th><th className="num">Typical result</th><th className="num">Middle 80% of results</th></tr></thead>
            <tbody>
              {t.quintiles.map((q) => (
                <tr key={q.label}><th scope="row">{q.label}</th><td className="num">{pct(q.beat, 0)}</td><td className="num">{points(q.median)}</td><td className="num">{points(q.p10, 0)} to {points(q.p90, 0)}</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>

        <section className="panel" aria-labelledby="factors">
          <h2 id="factors">Which measures carried signal</h2>
          <p className="muted">Average monthly rank correlation of each measure with the next-year result. Bars right of the line did better.</p>
          <ul className="icbars">
            {FACTORS.map((f) => {
              const v = t.factorIc[f.key];
              return (
                <li key={f.key}>
                  <span>{f.label}</span>
                  <span className="icbar" aria-hidden="true">
                    <span className={v >= 0 ? 'icbar__pos' : 'icbar__neg'} style={{ width: `${(Math.abs(v) / maxIc) * 50}%` }} />
                  </span>
                  <b>{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(2)}</b>
                </li>
              );
            })}
          </ul>
          <h3>Year by year</h3>
          <p className="muted small">Scores taken each December, judged against the following twelve months.</p>
          <ul className="icbars">
            {t.icYearly.map((y) => (
              <li key={y.date}>
                <span>{y.date.slice(0, 4)}</span>
                <span className="icbar" aria-hidden="true">
                  <span className={y.ic >= 0 ? 'icbar__pos' : 'icbar__neg'} style={{ width: `${Math.min(50, Math.abs(y.ic) * 100)}%` }} />
                </span>
                <b>{y.ic >= 0 ? '+' : '−'}{Math.abs(y.ic).toFixed(2)}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel" aria-labelledby="limits">
        <h2 id="limits">What flatters or limits these numbers</h2>
        <ul className="list">
          <li><b>Survivorship.</b> The 70 companies were chosen in 2026 because they are large today. Companies that shrank or failed since {since} are missing, which makes every company look better than a real {since} list would have.</li>
          <li><b>Overlapping years.</b> Twelve-month results that start a month apart share eleven months, so monthly figures are not independent. The t-statistic uses one month a year to avoid counting the same move twelve times.</li>
          <li><b>No tuning.</b> The five measures and their equal weights were fixed before the first backtest and were not changed after seeing the results.</li>
          <li><b>Left out.</b> Trading costs, taxes, and the exact timing of dividends. Prices are month-end closes.</li>
        </ul>
        <p><Link href="/method">How the score is worked out →</Link></p>
      </section>
    </div>
  );
}
