import type { Metadata } from 'next';
import { RankingTable, type Row } from '@/components/RankingTable';
import { UNIVERSE } from '@/data/universe';
import { asOfDate, evaluations } from '@/lib/data';
import { date } from '@/lib/format';

export const metadata: Metadata = { title: 'Rankings' };

export default function Rankings() {
  const info = Object.fromEntries(UNIVERSE.map((u) => [u.ticker, u]));
  const rows: Row[] = evaluations().map((e) => ({
    ticker: e.ticker,
    name: info[e.ticker].name,
    sector: info[e.ticker].sector,
    rank: e.rank,
    score: e.score,
    factors: e.factors,
  }));
  const unscored = UNIVERSE.filter((u) => !rows.some((r) => r.ticker === u.ticker));
  return (
    <div className="page">
      <header className="page__head">
        <h1>Rankings</h1>
        <p className="lede">All {rows.length} scored companies as of {date(asOfDate)}. Select a column to sort, or a sector to narrow the list.</p>
      </header>
      <RankingTable rows={rows} />
      {unscored.length > 0 && (
        <p className="muted small">Not scored today, because a figure is missing: {unscored.map((u) => u.ticker).join(', ')}.</p>
      )}
    </div>
  );
}
