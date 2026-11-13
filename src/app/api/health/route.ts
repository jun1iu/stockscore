import { connection } from 'next/server';
import { getMeta } from '@/lib/data';
import { evaluateHealth } from '@/lib/health';

/**
 * GET /api/health: 200 when the data is fresh and the last refresh worked, 503 otherwise.
 * A scheduled GitHub Action checks it every weekday and fails, which emails the owner, if not.
 */
export async function GET() {
  await connection(); // judged against the time of the request, never prerendered
  const meta = await getMeta();
  const health = evaluateHealth(meta, new Date());
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
