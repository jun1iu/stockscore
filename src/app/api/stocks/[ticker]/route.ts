import { secFilingUrl, stockReport } from '@/lib/data';

/** GET /api/stocks/AAPL: one company's score, inputs, sources, history and the track record for its score range. */
export async function GET(_req: Request, ctx: RouteContext<'/api/stocks/[ticker]'>) {
  const { ticker } = await ctx.params;
  const r = stockReport(ticker.toUpperCase());
  if (!r) return Response.json({ error: `${ticker.toUpperCase()} is not one of the 70 companies StockScore covers.` }, { status: 404 });
  const { factors, ...rest } = r;
  return Response.json({
    ...rest,
    source: r.evaluation ? { ...r.evaluation.metrics.source, url: secFilingUrl(r.cik, r.evaluation.metrics.source.accn) } : null,
    rules: factors,
  });
}
