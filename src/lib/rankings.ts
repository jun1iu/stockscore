import type { FactorKey } from './engine/types';

export interface Row {
  ticker: string;
  name: string;
  sector: string;
  rank: number;
  score: number;
  /** Score change since the previous month-end; null when the company wasn't scored then. */
  delta: number | null;
  factors: Record<FactorKey, number | null>;
}

export type SortKey = 'score' | 'delta' | FactorKey;
export type SortDir = 'desc' | 'asc';

const value = (r: Row, key: SortKey): number | null => (key === 'score' ? r.score : key === 'delta' ? r.delta : r.factors[key]);

/** Rows in one sector (or 'All') whose ticker or name contains the query. */
export function filterRows(rows: Row[], sector: string, query: string): Row[] {
  const q = query.trim().toLowerCase();
  return rows.filter(
    (r) => (sector === 'All' || r.sector === sector) && (!q || r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)),
  );
}

/** Sorted copy. Missing values go last in either direction; ties keep the overall rank order. */
export function sortRows(rows: Row[], key: SortKey, dir: SortDir): Row[] {
  const sign = dir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const [va, vb] = [value(a, key), value(b, key)];
    if (va === null || vb === null) return va === vb ? a.rank - b.rank : va === null ? 1 : -1;
    return sign * (va - vb) || a.rank - b.rank;
  });
}
