import Link from 'next/link';
import { BeatChart } from '@/components/charts';
import { Search } from '@/components/Search';
import { UNIVERSE } from '@/data/universe';
import { getChanges, getEvaluations, getMeta } from '@/lib/data';
import { summarize } from '@/lib/engine/explain';
import { date, pct } from '@/lib/format';

export default async function Home() {
  const [evaluations, meta, { since: changesSince, changes }] = await Promise.all([getEvaluations(), getMeta(), getChanges()]);
  const movers = Object.entries(changes)
    .sort((a, b) => Math.abs(b[1].delta) - Math.abs(a[1].delta))
    .slice(0, 5);
  const top = evaluations.slice(0, 5);
  const t = meta.trackRecord;
  const topFifth = t.quintiles.at(-1)!;
  const bottomFifth = t.quintiles[0];
  const since = t.start.slice(0, 4);
  const names = Object.fromEntries(UNIVERSE.map((u) => [u.ticker, u.name]));

  return (
    <div className="home">
      <section className="home__hero">
        <p className="eyebrow">Scores from SEC filings, with their track record attached</p>
        <h1>A stock score that tells you how much to trust it.</h1>
        <p className="lede">
          StockScore ranks 70 large US companies on profitability, growth, value, balance sheet and momentum, using their annual reports.
          Next to every score it shows how scores like it have done since {since}.
        </p>
        <Search options={UNIVERSE.map((u) => ({ ticker: u.ticker, name: u.name }))} large />
      </section>

      <section className="panel home__honest" aria-labelledby="honest">
        <div>
          <h2 id="honest">{Math.abs(t.icTStat) >= 2 ? 'The honest answer: a small edge, and a wide spread.' : 'The honest answer: not much better than a coin flip.'}</h2>
          <p>
            Since {since}, companies in the top fifth by score beat the S&amp;P 500 over the next year <strong>{pct(topFifth.beat, 0)}</strong> of
            the time. The bottom fifth did so {pct(bottomFifth.beat, 0)} of the time. A score helps you read a company’s filings quickly; it
            doesn’t tell you what the share price will do.
          </p>
          <p><Link href="/track-record">See the full track record →</Link></p>
        </div>
        <BeatChart rows={t.quintiles.map((q, i) => ({ label: q.label.replace(' fifth', ''), outcome: q, range: t.uncertainty?.quintiles[i] }))} height={210} />
      </section>

      <section className="panel" aria-labelledby="top">
        <div className="panel__head row">
          <h2 id="top">Highest scores today</h2>
          <Link href="/rankings">All 70 →</Link>
        </div>
        <ol className="toplist">
          {top.map((e) => (
            <li key={e.ticker}>
              <Link href={`/stocks/${e.ticker}`}>
                <span className="muted">{e.rank}</span>
                <b>{e.ticker}</b>
                <span className="toplist__name">{names[e.ticker]}</span>
                <span className="pill">{Math.round(e.score)}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="muted small">Prices as of {date(meta.asOf)}. A high score means strong figures relative to this group, not a reason to buy.</p>
      </section>

      {movers.length > 0 && (
        <section className="panel" aria-labelledby="movers">
          <div className="panel__head row">
            <h2 id="movers">Biggest moves since {date(changesSince)}</h2>
          </div>
          <ol className="movers">
            {movers.map(([t, c]) => (
              <li key={t}>
                <Link href={`/stocks/${t}`}>
                  <b>{t}</b>
                  <span className="why">{summarize(c)}.</span>
                  <span className={c.delta >= 0 ? 'up' : 'down'}>{Math.round(c.scoreFrom)} → {Math.round(c.scoreTo)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
