import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { SNAPSHOT_TAG } from '@/lib/data';
import { ConfigError, runRefresh } from '@/lib/pipeline/run';
import { ConflictError } from '@/lib/pipeline/storage';

/** Compares in constant time, so response timing says nothing about how much of a guess was right. */
function sameSecret(a: string, b: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Paced Massive requests plus the SEC check take a minute or two. */
export const maxDuration = 300;

/**
 * GET /api/cron/refresh: run the live refresh.
 * The home server's weekday cron job calls it with `Authorization: Bearer $CRON_SECRET`; the same header works by hand.
 */
export async function GET(req: Request) {
  // Trimmed on both sides: a pasted secret easily picks up a trailing newline.
  const secret = process.env.CRON_SECRET?.trim();
  const sent = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!secret || !sent || !sameSecret(sent, secret)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const trigger = req.headers.get('user-agent')?.includes('stockscore-cron') ? 'cron' : 'manual';
  try {
    // Leave room under the 300-second limit for the backtest and the write.
    const log = await runRefresh(trigger, { budgetMs: 200_000 });
    // Serve the old pages while the new ones render in the background.
    revalidateTag(SNAPSHOT_TAG, 'max');
    return Response.json(log, { status: log.ok ? 200 : 502 });
  } catch (e) {
    if (e instanceof ConflictError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof ConfigError) return Response.json({ error: e.message }, { status: 500 });
    console.error('Refresh failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
