import type { CSSProperties } from 'react';
import Link from 'next/link';
import { sectorKey } from '@/lib/sector';

export interface Tile { ticker: string; name: string; sector: string; score: number; rank: number }

/**
 * Every scored company as one tile, best first. The hue is the company's sector and the
 * strength is its score. No tile is red or green: a strong tile is a higher score, not a
 * recommendation.
 */
export function ScoreGrid({ tiles }: { tiles: Tile[] }) {
  const sectors = [...new Set(tiles.map((t) => t.sector))].sort();
  return (
    <figure className="grid70">
      <ol className="grid70__tiles">
        {tiles.map((t, i) => (
          <li key={t.ticker} style={{ '--d': (i % 10) + Math.floor(i / 10) } as CSSProperties}>
            <Link href={`/stocks/${t.ticker}`} data-sector={sectorKey(t.sector)} data-step={Math.min(4, Math.floor(t.score / 20))} title={`${t.name} (${t.sector}): ${Math.round(t.score)}, rank ${t.rank}`}>
              <b>{t.ticker}</b>
              <span>{Math.round(t.score)}</span>
              <span className="sr-only">, {t.name}, {t.sector}</span>
            </Link>
          </li>
        ))}
      </ol>
      <figcaption className="grid70__legend">
        <span>Lower score</span>
        <span className="grid70__scale" aria-hidden="true">{[0, 1, 2, 3, 4].map((s) => <i key={s} data-step={s} />)}</span>
        <span>Higher score</span>
        <ul className="sectors" aria-label="Colour by sector">
          {sectors.map((s) => <li key={s} data-sector={sectorKey(s)}><i className="dot" aria-hidden="true" />{s}</li>)}
        </ul>
      </figcaption>
    </figure>
  );
}
