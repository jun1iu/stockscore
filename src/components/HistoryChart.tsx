'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { linePath, logTicks, nearestIndex, scale } from '@/lib/chart';
import { monthYear, usd } from '@/lib/format';

type Mode = 'score' | 'price';

interface Props {
  ticker: string;
  /** The score at each month-end, worked out with what was known then. */
  score: { date: string; score: number }[];
  /** Split-adjusted month-end closes over the same period. */
  price: { date: string; close: number }[];
  /** Dates annual reports were filed, marked on the score line. */
  reports?: string[];
}

const H = 220;
const PAD = { l: 34, r: 10, t: 12, b: 26 };

/** Score or share price over time. Hover, touch or use the arrow keys to read any month. */
export function HistoryChart({ ticker, score, price, reports = [] }: Props) {
  const [mode, setMode] = useState<Mode>('score');
  const [width, setWidth] = useState(560);
  const [at, setAt] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Draw at the real width so axis text is the same size on a phone as on a desktop.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(
    () => (mode === 'score' ? score.map((p) => ({ date: p.date, v: p.score })) : price.map((p) => ({ date: p.date, v: p.close }))),
    [mode, score, price],
  );
  if (points.length < 2) return <p className="muted">Not enough history yet.</p>;

  const n = points.length;
  const x0 = PAD.l;
  const x1 = width - PAD.r;
  const x = (i: number) => x0 + (i / (n - 1)) * (x1 - x0);
  const lo = Math.min(...points.map((p) => p.v));
  const hi = Math.max(...points.map((p) => p.v));
  const y = mode === 'score' ? scale([0, 100], [H - PAD.b, PAD.t]) : scale([lo * 0.9, hi * 1.1], [H - PAD.b, PAD.t], true);
  const ticks = mode === 'score' ? [0, 50, 100] : logTicks(lo * 0.9, hi * 1.1);
  const xs = points.map((_, i) => x(i));
  const ys = points.map((p) => y(p.v));
  const line = linePath(xs, ys);
  const area = `${line}L${xs[n - 1].toFixed(1)},${H - PAD.b}L${xs[0].toFixed(1)},${H - PAD.b}Z`;
  const every = width < 420 ? 4 : 2;
  const years = points
    .map((p, i) => ({ i, y: Number(p.date.slice(0, 4)), m: p.date.slice(5, 7) }))
    .filter((p) => p.m === '01' && p.y % every === 0);
  const last = points[n - 1];
  const shown = at === null ? null : points[Math.min(at, n - 1)];
  const shownX = at === null ? 0 : x(Math.min(at, n - 1));
  const fmt = (v: number) => (mode === 'score' ? `${Math.round(v)} / 100` : usd(v));
  const label = mode === 'score' ? 'score' : 'share price';

  return (
    <div className="history">
      <div className="seg" role="group" aria-label="What to plot">
        <button type="button" aria-pressed={mode === 'score'} onClick={() => { setMode('score'); setAt(null); }}>Score</button>
        <button type="button" aria-pressed={mode === 'price'} onClick={() => { setMode('price'); setAt(null); }}>Share price</button>
      </div>
      <div
        ref={box}
        className="history__plot"
        tabIndex={0}
        role="group"
        aria-label={`${ticker} ${label} each month from ${monthYear(points[0].date)} to ${monthYear(last.date)}; now ${fmt(last.v)}. Use the left and right arrow keys to read each month.`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); setAt((a) => Math.max(0, (a ?? n - 1) - 1)); }
          if (e.key === 'ArrowRight') { e.preventDefault(); setAt((a) => Math.min(n - 1, (a ?? n - 2) + 1)); }
          if (e.key === 'Escape') setAt(null);
        }}
        onBlur={() => setAt(null)}
      >
        <svg
          className="chart"
          viewBox={`0 0 ${width} ${H}`}
          aria-hidden="true"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setAt(nearestIndex(((e.clientX - r.left) / r.width) * width, x0, x1, n));
          }}
          onPointerLeave={() => setAt(null)}
        >
          <defs>
            <linearGradient id={`fill-${ticker}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" className="chart__fill-top" />
              <stop offset="1" className="chart__fill-bottom" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} className={mode === 'score' && t === 50 ? 'chart__coin' : 'chart__grid'} />
              <text x={x0 - 6} y={y(t) + 4} textAnchor="end" className="chart__axis">{mode === 'price' ? `$${t}` : t}</text>
            </g>
          ))}
          {mode === 'score' && reports.map((r) => {
            const i = points.findIndex((p) => p.date >= r);
            return i < 0 ? null : <line key={r} x1={x(i)} x2={x(i)} y1={PAD.t} y2={H - PAD.b} className="chart__report" />;
          })}
          <path d={area} fill={`url(#fill-${ticker})`} />
          <path d={line} className="chart__line" />
          {shown ? (
            <>
              <line x1={shownX} x2={shownX} y1={PAD.t} y2={H - PAD.b} className="chart__cross" />
              <circle cx={shownX} cy={y(shown.v)} r="5" className="chart__dot" />
            </>
          ) : (
            <circle cx={xs[n - 1]} cy={ys[n - 1]} r="4.5" className="chart__dot" />
          )}
          {years.map((p) => (
            <text key={p.y} x={x(p.i)} y={H - 6} textAnchor="middle" className="chart__axis">{p.y}</text>
          ))}
        </svg>
        <p className="history__tip" role="status" style={shown ? { left: `${Math.max(12, Math.min(88, (shownX / width) * 100))}%` } : { visibility: 'hidden' }}>
          {shown && <><span>{monthYear(shown.date)}</span> <b>{fmt(shown.v)}</b></>}
        </p>
      </div>
      <p className="chart__legend">
        {mode === 'score'
          ? <><i className="chart__legend-report" aria-hidden="true" /> Annual report filed <i aria-hidden="true" /> 50: the middle of the group</>
          : <>Month-end closes, adjusted for splits, on a ratio scale: equal distances are equal percentage moves.</>}
      </p>
    </div>
  );
}
