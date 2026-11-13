import { summarize, type ScoreChange } from '@/lib/engine/explain';
import { date } from '@/lib/format';
import { metric } from '@/lib/format';
import { METRICS } from '@/lib/engine/score';

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`;

/** "What changed": the score move since the previous month-end, and the figures behind it. */
export function ChangePanel({ change }: { change: ScoreChange }) {
  const moved = change.factors.filter((f) => Math.abs(f.delta) >= 1);
  const big = Math.abs(change.delta) >= 3;
  return (
    <section className="panel change" aria-labelledby="change">
      <div className="panel__head row">
        <h2 id="change">What changed since {date(change.since)}</h2>
        <p className={`change__delta ${change.delta >= 3 ? 'up' : change.delta <= -3 ? 'down' : 'muted'}`}>
          {Math.round(change.scoreFrom)} → {Math.round(change.scoreTo)} <span>({signed(change.delta)})</span>
        </p>
      </div>
      <p className="change__summary">
        {summarize(change)}.{' '}
        {change.rankFrom !== change.rankTo && <>Rank {change.rankFrom} → {change.rankTo}. </>}
        {change.newReport && <>New annual report for the year to {date(change.newReport.periodEnd)}, filed {date(change.newReport.filed)}. </>}
        {change.drivenByPeers && <>Its own figures barely moved; because scores are ranks, it shifted as other companies’ figures changed. </>}
      </p>
      {big && moved.length > 0 && (
        <ul className="change__list">
          {moved.slice(0, 3).map((f) => (
            <li key={f.key}>
              <b>{f.label}</b>{' '}
              <span className={f.delta >= 0 ? 'up' : 'down'}>{signed(f.delta)}</span>
              <span className="muted"> ({Math.round(f.from ?? 0)} → {Math.round(f.to ?? 0)})</span>
              <span className="change__metrics">
                {f.metrics.map((m) => {
                  const def = METRICS.find((d) => d.key === m.key)!;
                  return (
                    <span key={m.key}>
                      {m.label}: {metric(def, m.from)} → {metric(def, m.to)}
                    </span>
                  );
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
