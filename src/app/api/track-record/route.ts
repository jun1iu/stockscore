import { trackRecord } from '@/lib/data';

/** GET /api/track-record: how the engine's past scores did against the S&P 500. */
export function GET() {
  return Response.json(trackRecord);
}
