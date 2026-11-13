import Link from 'next/link';

export interface Tile { ticker: string; name: string; score: number; rank: number }

/**
 * Every scored company as one tile, best first. Shading is neutral on purpose:
 * brighter means a higher score, not a recommendation.
 */
export function ScoreGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <figure className="grid70">
      <ol className="grid70__tiles">
        {tiles.map((t) => (
          <li key={t.ticker}>
            <Link href={`/stocks/${t.ticker}`} data-step={Math.min(4, Math.floor(t.score / 20))} title={`${t.name}: ${Math.round(t.score)}, rank ${t.rank}`}>
              <b>{t.ticker}</b>
              <span>{Math.round(t.score)}</span>
              <span className="sr-only">, {t.name}</span>
            </Link>
          </li>
        ))}
      </ol>
      <figcaption className="grid70__legend">
        <span>Lower score</span>
        <span className="grid70__scale" aria-hidden="true">{[0, 1, 2, 3, 4].map((s) => <i key={s} data-step={s} />)}</span>
        <span>Higher score</span>
      </figcaption>
    </figure>
  );
}
