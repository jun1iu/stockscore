'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties } from 'react';
import { flushSync } from 'react-dom';
import { filterRows, sortRows, type Row, type SortDir, type SortKey } from '@/lib/rankings';

const COLS: { key: SortKey; label: string; long: string }[] = [
  { key: 'score', label: 'Score', long: 'score' },
  { key: 'delta', label: 'Change', long: 'change since the previous month-end' },
  { key: 'profitability', label: 'Profit', long: 'profitability' },
  { key: 'growth', label: 'Growth', long: 'growth' },
  { key: 'value', label: 'Value', long: 'value' },
  { key: 'balanceSheet', label: 'Balance', long: 'balance sheet' },
  { key: 'momentum', label: 'Momentum', long: 'momentum' },
];
const FACTOR_COLS = COLS.slice(2);

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;

/** Rows glide to their new places when the order or the filter changes, where the browser can do it. */
function move(update: () => void) {
  const root = document.documentElement;
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) return update();
  root.setAttribute('data-flip', '');
  document.startViewTransition(() => flushSync(update)).finished.finally(() => root.removeAttribute('data-flip'));
}

export function RankingTable({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<SortKey>('score');
  const [dir, setDir] = useState<SortDir>('desc');
  const [sector, setSector] = useState('All');
  const [query, setQuery] = useState('');
  const sectors = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.sector))).sort()], [rows]);
  const shown = useMemo(() => sortRows(filterRows(rows, sector, query), sort, dir), [rows, sector, query, sort, dir]);
  const col = COLS.find((c) => c.key === sort)!;

  const sortBy = (key: SortKey) => move(() => {
    if (key === sort) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSort(key); setDir('desc'); }
  });

  return (
    <div className="panel rankings">
      <div className="rankings__tools">
        <div className="filters" role="group" aria-label="Sector">
          {sectors.map((s) => (
            <button key={s} type="button" className="chip" aria-pressed={sector === s} onClick={() => move(() => setSector(s))}>{s}</button>
          ))}
        </div>
        <input
          className="rankings__find"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or ticker"
          aria-label="Filter by name or ticker"
        />
      </div>
      <p className="muted small rankings__count" role="status">
        {shown.length === rows.length ? `All ${rows.length} companies` : `${shown.length} of ${rows.length} companies`}, by {col.long}, {dir === 'desc' ? 'highest first' : 'lowest first'}.
      </p>
      {shown.length === 0 ? (
        <p className="rankings__empty">
          Nothing matches.{' '}
          <button type="button" className="linkish" onClick={() => move(() => { setSector('All'); setQuery(''); })}>Clear the filters</button>
        </p>
      ) : (
        <div className="tablewrap">
          <table className="table table--rank">
            <caption className="sr-only">Companies sorted by {col.long}, {dir === 'desc' ? 'highest first' : 'lowest first'}</caption>
            <thead>
              <tr>
                <th scope="col" className="num">Rank</th>
                <th scope="col" className="table__sticky">Company</th>
                {COLS.map((c) => (
                  <th key={c.key} scope="col" className="num" aria-sort={sort === c.key ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
                    <button type="button" onClick={() => sortBy(c.key)} title={`Sort by ${c.long}`}>
                      {c.label}<span className="table__arrow" aria-hidden="true">{sort === c.key ? (dir === 'desc' ? '↓' : '↑') : '↕'}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const d = r.delta === null ? null : Math.round(r.delta);
                return (
                  <tr key={r.ticker} style={{ '--vt': `row-${r.ticker.replace(/[^A-Za-z0-9]/g, '-')}` } as CSSProperties}>
                    <td className="num muted">{r.rank}</td>
                    <th scope="row" className="table__sticky">
                      <Link href={`/stocks/${r.ticker}`}><b>{r.ticker}</b> <span className="muted">{r.name}</span></Link>
                    </th>
                    <td className="num"><span className="pill">{Math.round(r.score)}</span></td>
                    <td className={`num ${d === null || Math.abs(d) < 3 ? 'muted' : d > 0 ? 'up' : 'down'}`}>{d === null ? '—' : signed(d)}</td>
                    {FACTOR_COLS.map((c) => {
                      const v = r.factors[c.key as keyof Row['factors']];
                      return (
                        <td key={c.key} className={sort === c.key ? 'num cellbar is-sorted' : 'num cellbar'}>
                          {v === null ? '—' : <>{Math.round(v)}<i aria-hidden="true" style={{ width: `${v}%` }} /></>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
