import type { Outcome } from '@/lib/engine/stats';
import { monthYear, pct } from '@/lib/format';

/** The score as a ring: a neutral colour on purpose, because a high score is not a "buy". */
export function ScoreRing({ score, size = 168 }: { score: number; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" viewBox="0 0 168 168" width={size} height={size} role="img" aria-label={`Score ${Math.round(score)} out of 100`}>
      <circle cx="84" cy="84" r={r} className="ring__track" />
      <circle cx="84" cy="84" r={r} className="ring__value" strokeDasharray={`${(score / 100) * c} ${c}`} transform="rotate(-90 84 84)" />
      <text x="84" y="90" textAnchor="middle" className="ring__n">{Math.round(score)}</text>
      <text x="84" y="116" textAnchor="middle" className="ring__of">/100</text>
    </svg>
  );
}

/** Share that beat the benchmark, by score range, against the 50% a coin flip would give. */
export function BeatChart({ rows, highlight, height = 200 }: { rows: { label: string; outcome: Outcome }[]; highlight?: string; height?: number }) {
  const W = 520;
  const left = 36;
  const top = 24;
  const bottom = 30;
  const H = height;
  const plot = H - top - bottom;
  const max = 0.75;
  const y = (v: number) => top + plot * (1 - v / max);
  const step = (W - left) / rows.length;
  const barW = Math.min(64, step * 0.6);
  return (
    <figure>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rows.map((r) => `${r.label}: ${pct(r.outcome.beat, 0)} beat the S&P 500`).join('; ')}>
        {[0, 0.25, 0.5, 0.75].map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} className="chart__grid" />
            <text x={left - 8} y={y(t) + 4} textAnchor="end" className="chart__axis">{t * 100}%</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = left + i * step + (step - barW) / 2;
          const on = r.label === highlight;
          return (
            <g key={r.label}>
              <rect x={x} y={y(r.outcome.beat)} width={barW} height={y(0) - y(r.outcome.beat)} rx="3" className={on ? 'chart__bar is-on' : 'chart__bar'} />
              <text x={x + barW / 2} y={y(r.outcome.beat) + 18} textAnchor="middle" className={on ? 'chart__val is-on-ink' : 'chart__val'}>{pct(r.outcome.beat, 0)}</text>
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" className="chart__axis">{r.label}</text>
            </g>
          );
        })}
        <line x1={left} x2={W} y1={y(0.5)} y2={y(0.5)} className="chart__coin" />
      </svg>
      <figcaption className="chart__legend"><i aria-hidden="true" /> 50%: what a coin flip would give</figcaption>
    </figure>
  );
}

/** A company's score at every month-end, worked out with what was known then. */
export function ScoreHistory({ points, ticker }: { points: { date: string; score: number }[]; ticker: string }) {
  if (points.length < 2) return <p className="muted">Not enough history yet.</p>;
  const W = 520;
  const H = 180;
  const pad = { l: 28, r: 8, t: 10, b: 26 };
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (s: number) => pad.t + (1 - s / 100) * (H - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join('');
  const years = points.map((p, i) => ({ i, y: p.date.slice(0, 4), m: p.date.slice(5, 7) })).filter((p) => p.m === '01' && Number(p.y) % 2 === 0);
  const last = points.at(-1)!;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ticker} score each month from ${monthYear(points[0].date)} to ${monthYear(last.date)}; now ${Math.round(last.score)}`}>
      {[0, 50, 100].map((s) => (
        <g key={s}>
          <line x1={pad.l} x2={W - pad.r} y1={y(s)} y2={y(s)} className={s === 50 ? 'chart__coin' : 'chart__grid'} />
          <text x="0" y={y(s) + 4} className="chart__axis">{s}</text>
        </g>
      ))}
      <path d={d} className="chart__line" />
      <circle cx={x(points.length - 1)} cy={y(last.score)} r="4.5" className="chart__dot" />
      {years.map((p) => (
        <text key={p.y} x={x(p.i)} y={H - 6} textAnchor="middle" className="chart__axis">{p.y}</text>
      ))}
    </svg>
  );
}

/** A 0-100 bar with the group middle marked. */
export function Meter({ value, label }: { value: number | null; label: string }) {
  return (
    <span className="meter" role="img" aria-label={value === null ? `${label}: no data` : `${label}: better than ${Math.round(value)}% of the group`}>
      <span className="meter__fill" style={{ width: `${value ?? 0}%` }} />
      <span className="meter__mid" />
    </span>
  );
}
