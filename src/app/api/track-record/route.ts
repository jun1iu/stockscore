import { getMeta } from '@/lib/data';

/** GET /api/track-record: how the engine's past scores did against the S&P 500. */
export async function GET() {
  const { trackRecord, asOf, builtAt } = await getMeta();
  return Response.json({ asOf, builtAt, ...trackRecord });
}
