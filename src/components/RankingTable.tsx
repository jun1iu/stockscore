'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { FactorKey } from '@/lib/engine/types';

export interface Row {
  ticker: string;
  name: string;
  sector: string;
  rank: number;
  score: number;
  factors: Record<FactorKey, number | null>;
}

const COLS: { key: 'score' | FactorKey; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'profitability', label: 'Profit' },
  { key: 'growth', label: 'Growth' },
  { key: 'value', label: 'Value' },
  { key: 'balanceSheet', label: 'Balance' },
  { key: 'momentum', label: 'Momentum' },
];

export function RankingTable({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<'score' | FactorKey>('score');
  const [sector, setSector] = useState('All');
  const sectors = useMemo(() => ['All', ...Array.from(new Set(rows.map((r) => r.sector))).sort()], [rows]);
  const value = (r: Row) => (sort === 'score' ? r.score : r.factors[sort] ?? -1);
  const shown = rows.filter((r) => sector === 'All' || r.sector === sector).sort((a, b) => value(b) - value(a));

  return (
    <div className="panel">
      <div className="filters" role="group" aria-label="Sector">
        {sectors.map((s) => (
          <button key={s} type="button" className="chip" aria-pressed={sector === s} onClick={() => setSector(s)}>{s}</button>
        ))}
      </div>
      <div className="tablewrap">
        <table className="table">
          <caption className="sr-only">Companies sorted by {COLS.find((c) => c.key === sort)!.label}</caption>
          <thead>
            <tr>
              <th scope="col" className="num">Rank</th>
              <th scope="col">Company</th>
              {COLS.map((c) => (
                <th key={c.key} scope="col" className="num" aria-sort={sort === c.key ? 'descending' : 'none'}>
                  <button type="button" onClick={() => setSort(c.key)}>{c.label}{sort === c.key ? ' ↓' : ''}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.ticker}>
                <td className="num muted">{r.rank}</td>
                <th scope="row">
                  <Link href={`/stocks/${r.ticker}`}><b>{r.ticker}</b> <span className="muted">{r.name}</span></Link>
                </th>
                <td className="num"><span className="pill">{Math.round(r.score)}</span></td>
                {COLS.slice(1).map((c) => (
                  <td key={c.key} className="num">{r.factors[c.key as FactorKey] === null ? '—' : Math.round(r.factors[c.key as FactorKey]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
