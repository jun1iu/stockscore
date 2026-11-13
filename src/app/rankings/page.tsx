import type { Metadata } from 'next';
import { RankingTable } from '@/components/RankingTable';
import type { Row } from '@/lib/rankings';
import { UNIVERSE } from '@/data/universe';
import { getChanges, getEvaluations, getMeta } from '@/lib/data';
import { date } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Rankings',
  description: 'All 70 companies ranked by score, sortable by profitability, growth, value, balance sheet and momentum.',
  alternates: { canonical: '/rankings' },
};

export default async function Rankings() {
  const [evaluations, meta, { since, changes }] = await Promise.all([getEvaluations(), getMeta(), getChanges()]);
  const info = Object.fromEntries(UNIVERSE.map((u) => [u.ticker, u]));
  const rows: Row[] = evaluations.map((e) => ({
    ticker: e.ticker,
    name: info[e.ticker].name,
    sector: info[e.ticker].sector,
    rank: e.rank,
    score: e.score,
    delta: changes[e.ticker]?.delta ?? null,
    factors: e.factors,
  }));
  const unscored = UNIVERSE.filter((u) => !rows.some((r) => r.ticker === u.ticker));
  return (
    <div className="page">
      <header className="page__head">
        <h1>Rankings</h1>
        <p className="lede">All {rows.length} scored companies as of {date(meta.asOf)}. Select a column to sort (again to reverse), or a sector to narrow the list. Change is since {date(since)}.</p>
      </header>
      <RankingTable rows={rows} />
      {unscored.length > 0 && (
        <p className="muted small">Not scored today, because a figure is missing: {unscored.map((u) => u.ticker).join(', ')}.</p>
      )}
    </div>
  );
}
