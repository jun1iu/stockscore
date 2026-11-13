import { findCompany } from '@/data/universe';
import { secFilingUrl, stockReport } from '@/lib/data';

/** The same hour the prerendered API routes get, so a CDN or browser can hold this one too. */
const CACHE = { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=82800' };

/** GET /api/stocks/AAPL: one company's score, inputs, sources, history and the track record for its score range. */
export async function GET(_req: Request, ctx: RouteContext<'/api/stocks/[ticker]'>) {
  const { ticker } = await ctx.params;
  // Checked against the list first, so made-up tickers never reach the cached lookup.
  const company = findCompany(ticker);
  const r = company && (await stockReport(company.ticker));
  if (!r) {
    return Response.json(
      { error: `${ticker.slice(0, 12).toUpperCase()} is not one of the 70 companies StockScore covers.` },
      { status: 404, headers: CACHE },
    );
  }
  const { factors, ...rest } = r;
  return Response.json(
    {
      ...rest,
      source: r.evaluation ? { ...r.evaluation.metrics.source, url: secFilingUrl(r.cik, r.evaluation.metrics.source.accn) } : null,
      rules: factors,
    },
    { headers: CACHE },
  );
}
