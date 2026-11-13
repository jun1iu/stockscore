import { getMeta } from '@/lib/data';

/** GET /api/status: data freshness and the latest refresh runs. */
export async function GET() {
  const { asOf, builtAt, source, runs } = await getMeta();
  return Response.json({ asOf, builtAt, source, runs });
}
