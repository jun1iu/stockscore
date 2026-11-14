import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BeatChart, Meter, ScoreRing } from '@/components/charts';
import { HistoryChart } from '@/components/HistoryChart';
import { ChangePanel } from '@/components/ChangePanel';
import { Roll } from '@/components/Roll';
import { findCompany, UNIVERSE } from '@/data/universe';
import { getEvaluations, getMeta, secFilingUrl, stockReport } from '@/lib/data';
import { sectorKey } from '@/lib/sector';
import { date, metric, money, monthYear, pct, points, signedPct, usd } from '@/lib/format';

export function generateStaticParams() {
  return UNIVERSE.map((u) => ({ ticker: u.ticker }));
}

export async function generateMetadata({ params }: PageProps<'/stocks/[ticker]'>): Promise<Metadata> {
  const { ticker } = await params;
  const company = findCompany(ticker);
  const r = company && (await stockReport(company.ticker));
  if (!r) return { title: 'Not covered', robots: { index: false } };
  return {
    title: `${r.ticker} ${r.name}`,
    alternates: { canonical: `/stocks/${r.ticker}` },
    description: r.evaluation
      ? `${r.name} scores ${Math.round(r.evaluation.score)}/100 against 70 large US companies, with the engine’s track record for that score.`
      : `${r.name} on StockScore.`,
  };
}

export default async function StockPage({ params }: PageProps<'/stocks/[ticker]'>) {
  const { ticker } = await params;
  // Checked against the list first, so made-up tickers never reach the cached lookup.
  const company = findCompany(ticker);
  const r = company && (await stockReport(company.ticker));
  if (!r) notFound();
  const [{ trackRecord }, all] = await Promise.all([getMeta(), getEvaluations()]);
  const i = all.findIndex((x) => x.ticker === r.ticker);
  const near = i < 0 ? [] : all.slice(Math.max(0, i - 2), i + 3).filter((x) => x.ticker !== r.ticker);
  const sectorOf = Object.fromEntries(UNIVERSE.map((u) => [u.ticker, u.sector]));
  const peers = all.filter((x) => sectorOf[x.ticker] === r.sector);
  const sectorRank = peers.findIndex((x) => x.ticker === r.ticker) + 1;
  const e = r.evaluation;
  const bands = Object.entries(trackRecord.bands).map(([key, outcome]) => ({ label: key.replace('-', '–'), outcome, range: trackRecord.uncertainty?.bands[key] }));
  const since = trackRecord.start.slice(0, 4);

  return (
    <article className="stock" data-sector={sectorKey(r.sector)}>
      <header className="stock__head">
        <div className="stock__id">
          <p className="eyebrow"><i className="dot" aria-hidden="true" />{r.sector}</p>
          <h1><span className="stock__ticker">{r.ticker}</span> <span className="stock__name">{r.name}</span></h1>
        </div>
        {r.price && (
          <dl className="stock__quote">
            <div><dt>Price</dt><dd className="big">{usd(r.price.price)}</dd></div>
            {r.price.changeSinceMonthEnd !== null && (
              <div>
                <dt>This month</dt>
                <dd className={r.price.changeSinceMonthEnd >= 0 ? 'up' : 'down'}>{signedPct(r.price.changeSinceMonthEnd)}</dd>
              </div>
            )}
            {e && <div><dt>Market value</dt><dd>{money(e.metrics.marketCap)}</dd></div>}
            <div><dt>As of</dt><dd>{date(r.price.date)}</dd></div>
          </dl>
        )}
      </header>

      {!e ? (
        <section className="panel">
          <h2>No score yet</h2>
          <p>The latest annual report is missing a figure the engine needs, or prices haven’t been loaded. See the <Link href="/method">method</Link> for what’s required.</p>
        </section>
      ) : (
        <>
          <section className="verdict" aria-label="Score">
            <div className="panel scorecard">
              <h2 className="panel__title">Stock score</h2>
              <ScoreRing score={e.score} />
              <p className="scorecard__label">{r.label}</p>
              <p className="muted">
                Ranks {e.rank} of {e.groupSize}
                {peers.length > 1 && sectorRank > 0 && <span className="scorecard__sector">{sectorRank} of {peers.length} in {r.sector}</span>}
              </p>
            </div>

            {r.trust && r.trust.outcome && (
              <div className="panel trust">
                <h2 className="trust__q">
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2l6 2.5v5c0 4-2.7 6.8-6 8.5-3.3-1.7-6-4.5-6-8.5v-5z" /><path d="M7 10l2 2 4-4" /></svg>
                  How much to trust this score?
                </h2>
                <p className="trust__headline">
                  Since {since}, companies scoring {r.trust.band.lo}–{r.trust.band.hi} beat the S&amp;P 500 over the next year{' '}
                  <strong><Roll>{pct(r.trust.outcome.beat, 0)}</Roll></strong> of the time. A coin flip is 50%.
                  {r.trust.range && (
                    <span className="trust__range"> Allowing for luck, the true rate is likely between {pct(r.trust.range[0], 0)} and {pct(r.trust.range[1], 0)}{r.trust.range[0] <= 0.5 && r.trust.range[1] >= 0.5 ? ', a range that includes the coin flip.' : '.'}</span>
                  )}
                </p>
                <div className="coin" data-anim aria-hidden="true">
                  <div className="coin__row"><span>Scores {r.trust.band.lo}–{r.trust.band.hi}</span><span className="coin__track"><span className="coin__fill is-on" style={{ width: `${r.trust.outcome.beat * 100}%` }} /></span><b>{pct(r.trust.outcome.beat, 0)}</b></div>
                  <div className="coin__row"><span>Coin flip</span><span className="coin__track"><span className="coin__fill" style={{ width: '50%' }} /></span><b>50%</b></div>
                </div>
                <p className="trust__detail">
                  The typical result was {points(r.trust.outcome.median)} against the index, and one in five ended outside{' '}
                  {points(r.trust.outcome.p10, 0)} to {points(r.trust.outcome.p90, 0)}. Based on {r.trust.outcome.n.toLocaleString('en-US')} past
                  company-months. This score summarises public filings; it is not a forecast.
                </p>
              </div>
            )}
          </section>

          {r.change && <ChangePanel change={r.change} />}

          <section className="panel" aria-labelledby="breakdown">
            <div className="panel__head">
              <h2 id="breakdown">Score breakdown</h2>
              <p className="muted">Each measure is ranked against the other {e.groupSize - 1} companies: 100 is the best in the group, 50 the middle. The score ranks the average of the five.</p>
            </div>
            <ol className="factors">
              {r.factors.map((f) => {
                const v = e.factors[f.key];
                return (
                  <li key={f.key} className="factor">
                    <div className="factor__main">
                      <h3>{f.label}</h3>
                      <p className="muted factor__q">{f.question}</p>
                    </div>
                    <div className="factor__nums">
                      {f.metrics.map((m) => (
                        <span key={m.key}><span className="muted">{m.label}</span> <b>{metric(m, e.metrics.values[m.key])}</b></span>
                      ))}
                    </div>
                    <div className="factor__score">
                      <Meter value={v} label={f.label} />
                      <span className="pill">{v === null ? '—' : Math.round(v)}</span>
                    </div>
                    <details className="factor__more">
                      <summary>How it’s worked out</summary>
                      <table>
                        <thead><tr><th>Measure</th><th className="num">Value</th><th className="num">Rank in group</th><th>Formula</th></tr></thead>
                        <tbody>
                          {f.metrics.map((m) => (
                            <tr key={m.key}>
                              <th scope="row">{m.label}</th>
                              <td className="num">{metric(m, e.metrics.values[m.key])}</td>
                              <td className="num">{e.metricScores[m.key] === null ? '—' : Math.round(e.metricScores[m.key]!)}</td>
                              <td>{m.formula}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </li>
                );
              })}
            </ol>
            <p className="source">
              Figures from the {e.metrics.source.periodEnd.slice(0, 4)} annual report ({e.metrics.source.form}), filed {date(e.metrics.source.filed)}.{' '}
              <a href={secFilingUrl(r.cik, e.metrics.source.accn)}>View the filing on SEC.gov ↗</a>
              {e.metrics.returnOnEquity !== null && <> Return on equity, for reference: {pct(e.metrics.returnOnEquity)}.</>}
            </p>
          </section>

          <div className="two">
            <section className="panel" aria-labelledby="history">
              <h2 id="history">Score over time</h2>
              <p className="muted">Each month-end since {monthYear(r.history[0]?.date ?? trackRecord.start)}, using only the filings and prices public that day.</p>
              <HistoryChart ticker={r.ticker} score={r.history} price={r.priceHistory} reports={r.reports} />
            </section>
            <section className="panel" aria-labelledby="record">
              <h2 id="record">Track record by score</h2>
              <p className="muted">Share of companies that beat the S&amp;P 500 over the next year, {since}–{trackRecord.end.slice(0, 4)}. This score’s range is highlighted.</p>
              <BeatChart rows={bands} highlight={r.trust ? `${r.trust.band.lo}–${r.trust.band.hi}` : undefined} />
              <p><Link href="/track-record">Full track record →</Link></p>
            </section>
          </div>

          <nav className="neighbours" data-anim aria-label="Nearby in the rankings">
            <span className="neighbours__label muted small">Nearby in the rankings</span>
            {near.map((n) => (
              <Link key={n.ticker} href={`/stocks/${n.ticker}`}>
                <span className="muted">#{n.rank}</span> <b>{n.ticker}</b> <span className="pill">{Math.round(n.score)}</span>
              </Link>
            ))}
          </nav>
        </>
      )}
    </article>
  );
}
