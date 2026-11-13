import type { Metadata } from 'next';
import Link from 'next/link';
import { Roll } from '@/components/Roll';
import { BeatChart } from '@/components/charts';
import { getMeta } from '@/lib/data';
import { FACTORS } from '@/lib/engine/score';
import { monthYear, pct, points } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Track record',
  description: 'How often StockScore’s past scores beat the S&P 500 over the following year, with 95% ranges and what flatters the numbers.',
  alternates: { canonical: '/track-record' },
};

export default async function TrackRecordPage() {
  const t = (await getMeta()).trackRecord;
  const since = t.start.slice(0, 4);
  const top = t.quintiles.at(-1)!;
  const bottom = t.quintiles[0];
  const reliable = Math.abs(t.icTStat) >= 2;
  const u = t.uncertainty;
  const range = (r: [number, number]) => `${pct(r[0], 0)}–${pct(r[1], 0)}`;
  const c = t.comparison;
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
        <p className="stat"><b><Roll>{pct(top.beat, 0)}</Roll></b><span>of top-fifth scores beat the S&amp;P 500 over the next year{u && <> · 95% range {range(u.quintiles[4])}</>}</span></p>
        <p className="stat"><b><Roll>{pct(bottom.beat, 0)}</Roll></b><span>of bottom-fifth scores did{u && <> · 95% range {range(u.quintiles[0])}</>}</span></p>
        <p className="stat"><b><Roll>{t.ic.toFixed(2)}</Roll></b><span>rank correlation between score and next-year result (0 is none, 1 is perfect){u && <> · 95% range {u.ic[0].toFixed(2)} to {u.ic[1].toFixed(2)}</>}</span></p>
        <p className="stat"><b><Roll>{t.icTStat.toFixed(1)}</Roll></b><span>t-statistic over yearly windows; below 2 means the pattern could be chance</span></p>
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
          <BeatChart rows={t.quintiles.map((q, i) => ({ label: q.label.replace(' fifth', ''), outcome: q, range: u?.quintiles[i] }))} />
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
          <ul className="icbars" data-anim>
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
          <ul className="icbars" data-anim>
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

      {u && (
        <section className="panel" aria-labelledby="luck">
          <h2 id="luck">How much is luck?</h2>
          <p>
            A bad year hits every company at once, and twelve-month results a month apart share eleven months, so the {t.observations.toLocaleString('en-US')}{' '}
            company-months are far from independent. The ranges here come from resampling whole calendar years {u.resamples.toLocaleString('en-US')} times
            and keeping the middle 95% of the results. Where a range includes 50%, the result can’t be told apart from a coin flip.
          </p>
        </section>
      )}

      {c && (
        <section className="panel" aria-labelledby="variants">
          <h2 id="variants">Could a different engine do better?</h2>
          <p className="muted">
            Three versions of the engine, each judged only on {c.years[0]}–{c.years[1]} ({c.months} months), years the learned version had not seen
            when its weights were set.
          </p>
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr><th>Engine</th><th className="num">Top fifth beat S&amp;P</th><th className="num">Bottom fifth</th><th className="num">Rank correlation</th></tr>
              </thead>
              <tbody>
                {c.variants.map((v) => (
                  <tr key={v.key}>
                    <th scope="row">{v.label}<span className="muted small variant__desc">{v.description}</span></th>
                    <td className="num"><b>{pct(v.topBeat, 1)}</b><span className="muted small variant__range">{range(v.topBeatRange)}</span></td>
                    <td className="num">{pct(v.bottomBeat, 1)}</td>
                    <td className="num"><b>{v.ic.toFixed(3)}</b><span className="muted small variant__range">{v.icRange[0].toFixed(2)} to {v.icRange[1].toFixed(2)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const learned = c.variants.find((v) => v.key === 'learned');
            const best = [...c.variants].sort((a, b) => b.ic - a.ic)[0];
            const overlap = c.variants.every((v) => v.icRange[0] < best.icRange[1] && best.icRange[0] < v.icRange[1]);
            return (
              <>
                <p>
                  {best.label} did best on these years{overlap ? ', but every range overlaps, so none is reliably better than the others. ' : '. '}
                  The live site keeps equal weights: they were fixed before any testing, so its track record can’t have been tuned to look good.
                </p>
                {learned?.weights && (
                  <p className="muted small">
                    Weights the learned engine would use today:{' '}
                    {FACTORS.map((f) => `${f.label} ${Math.round(learned.weights![f.key] * 100)}%`).join(', ')}.
                  </p>
                )}
              </>
            );
          })()}
        </section>
      )}

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
