import type { Metadata } from 'next';
import { FACTORS, MIN_FACTORS } from '@/lib/engine/score';

export const metadata: Metadata = { title: 'Method' };

export default function Method() {
  return (
    <div className="page prose">
      <header className="page__head">
        <h1>How the score is worked out</h1>
        <p className="lede">Every rule the engine uses is on this page. Nothing is hidden in a model.</p>
      </header>

      <section className="panel">
        <h2>1. The group</h2>
        <p>70 of the largest US-listed companies, across technology, consumer, health care, industrials, energy, communication, materials and utilities. Banks, insurers and property companies are left out because their accounts don’t fit these measures.</p>
      </section>

      <section className="panel">
        <h2>2. Ten measures in five factors</h2>
        <p>Each measure is ranked across the group from 0 (worst) to 100 (best). A factor is the average of its measures. A company needs at least {MIN_FACTORS} of the 5 factors to be scored.</p>
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>Factor</th><th>Measure</th><th>Formula</th><th>Better</th></tr></thead>
            <tbody>
              {FACTORS.flatMap((f) =>
                f.metrics.map((m, i) => (
                  <tr key={m.key}>
                    {i === 0 && <th scope="rowgroup" rowSpan={f.metrics.length}>{f.label}</th>}
                    <td>{m.label}</td>
                    <td>{m.formula}</td>
                    <td>{m.better === 'higher' ? 'Higher' : 'Lower'}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p>The five factors count equally. Their average is ranked across the group once more, so the final score spreads from 0 to 100: the best company scores 100 and the middle one 50.</p>
      </section>

      <section className="panel">
        <h2>3. Only what was public at the time</h2>
        <ul className="list">
          <li>Figures come from annual reports (10-K) in the SEC’s XBRL company facts. Each figure carries the date its filing was published, and the engine ignores anything published after the date it is scoring.</li>
          <li>Companies restate earlier years in later reports. The engine keeps the first published version, which is what investors saw then.</li>
          <li>Share counts in filings are before later stock splits, while prices are adjusted for them. Share counts are converted into the same units so market values are right, for example Apple before its 2020 split and Nvidia before 2024.</li>
          <li>Some companies only started tagging diluted share counts recently. Where that’s missing, the count comes from net income ÷ diluted earnings per share in the same report.</li>
        </ul>
      </section>

      <section className="panel">
        <h2>4. The trust check</h2>
        <p>Every month-end since 2012, the whole group is scored as above. Each company’s total return over the next twelve months is compared with the S&amp;P 500 fund SPY. Grouping those results by score gives the figure on every stock page: how often companies with a similar score beat the index.</p>
      </section>

      <section className="panel">
        <h2>5. Code and data</h2>
        <p>The engine is plain TypeScript with tests for the no-look-ahead rule, restatements, splits and ranking. The same code scores today’s companies on the server and runs the backtest. Data is refreshed with <code>npm run data:fetch</code> and <code>npm run data:build</code>.</p>
      </section>
    </div>
  );
}
