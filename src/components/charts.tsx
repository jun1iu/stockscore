import type { Outcome } from '@/lib/engine/stats';
import type { CSSProperties } from 'react';
import { pct } from '@/lib/format';
import { Roll } from './Roll';

/** The score as a ring: a neutral colour on purpose, because a high score is not a "buy". */
export function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  return (
    <div className="ring" data-anim style={{ width: size }} role="img" aria-label={`Score ${Math.round(score)} out of 100`}>
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" r="70" className="ring__track" />
        <circle cx="84" cy="84" r="70" pathLength="100" className="ring__value" strokeDasharray={`${score} 100`} transform="rotate(-90 84 84)" />
      </svg>
      <span className="ring__label" aria-hidden="true">
        <span className="ring__n"><Roll>{String(Math.round(score))}</Roll></span>
        <span className="ring__of">/100</span>
      </span>
    </div>
  );
}

/** Share that beat the benchmark, by score range, against the 50% a coin flip would give. Plain HTML, so labels stay readable on a phone. */
export function BeatChart({ rows, highlight }: { rows: { label: string; outcome: Outcome; range?: [number, number] }[]; highlight?: string }) {
  const max = 0.75;
  const h = (v: number) => `${(Math.min(v, max) / max) * 100}%`;
  return (
    <figure className="beat" data-anim>
      <div
        className="beat__plot"
        role="img"
        aria-label={rows.map((r) => `${r.label}: ${pct(r.outcome.beat, 0)} beat the S&P 500${r.range ? `, likely between ${pct(r.range[0], 0)} and ${pct(r.range[1], 0)}` : ''}`).join('; ')}
      >
        {[0, 0.25, 0.5, 0.75].map((t) => (
          <span key={t} className={t === 0.5 ? 'beat__tick is-coin' : 'beat__tick'} style={{ bottom: h(t) }}><i>{t * 100}%</i></span>
        ))}
        <div className="beat__cols">
          {rows.map((r, i) => (
            <div key={r.label} className={r.label === highlight ? 'beat__col is-on' : 'beat__col'} style={{ '--i': i } as CSSProperties}>
              <span className="beat__bar" style={{ height: h(r.outcome.beat) }}><b>{pct(r.outcome.beat, 0)}</b></span>
              {r.range && <span className="beat__range" style={{ bottom: h(r.range[0]), height: `${((Math.min(r.range[1], max) - r.range[0]) / max) * 100}%` }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="beat__labels" aria-hidden="true">
        {rows.map((r) => <span key={r.label} className={r.label === highlight ? 'is-on' : undefined}>{r.label}</span>)}
      </div>
      <figcaption className="chart__legend">
        <i aria-hidden="true" /> 50%: what a coin flip would give
        {rows.some((r) => r.range) && <><b className="chart__legend-range" aria-hidden="true" /> 95% range</>}
      </figcaption>
    </figure>
  );
}

/** A 0-100 bar with the group middle marked. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  return (
    <span className="meter" data-anim role="img" aria-label={value === null ? `${label}: no data` : `${label}: better than ${Math.round(value)}% of the group`}>
      <span className="meter__fill" style={{ width: `${value ?? 0}%` }} />
      <span className="meter__mid" />
    </span>
  );
}
