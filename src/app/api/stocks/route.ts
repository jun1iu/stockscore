import { UNIVERSE } from '@/data/universe';
import { getEvaluations, getMeta } from '@/lib/data';

/** GET /api/stocks: today's ranking of every scored company. */
export async function GET() {
  const [evaluations, meta] = await Promise.all([getEvaluations(), getMeta()]);
  const names = Object.fromEntries(UNIVERSE.map((u) => [u.ticker, u]));
  return Response.json({
    asOf: meta.asOf,
    builtAt: meta.builtAt,
    note: 'Scores summarise public filings and prices. They are not investment advice.',
    stocks: evaluations.map((e) => ({
      ticker: e.ticker,
      name: names[e.ticker].name,
      sector: names[e.ticker].sector,
      rank: e.rank,
      score: Math.round(e.score * 10) / 10,
      factors: e.factors,
    })),
  });
}
