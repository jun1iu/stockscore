/**
 * Where the live snapshot is kept: a private Vercel Blob when BLOB_READ_WRITE_TOKEN is set
 * (on Vercel), otherwise data/snapshot.json (local runs). Writes are conditional on the version
 * read, so two overlapping refresh runs can't overwrite each other's work.
 */
import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from '@vercel/blob';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Snapshot } from './snapshot';

const PATH = 'stockscore/snapshot.json';
const LOCAL = join(process.cwd(), 'data/snapshot.json');

export const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

export interface Stored {
  snapshot: Snapshot;
  /** Version tag to pass back when writing. */
  etag: string | null;
}

export async function readSnapshot(): Promise<Stored | null> {
  if (usingBlob()) {
    // Take the store's version tag first (the download's HTTP ETag is a different value), then the
    // content. If a write lands in between, our content is newer than the tag and our write is
    // refused, which is the safe direction.
    let etag: string;
    try {
      etag = (await head(PATH)).etag;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
    const res = await get(PATH, { access: 'private', useCache: false });
    if (!res) return null;
    const text = await new Response(res.stream).text();
    return { snapshot: JSON.parse(text) as Snapshot, etag };
  }
  if (!existsSync(LOCAL)) return null;
  return { snapshot: JSON.parse(readFileSync(LOCAL, 'utf8')) as Snapshot, etag: String(statSync(LOCAL).mtimeMs) };
}

export class ConflictError extends Error {}

export async function writeSnapshot(snapshot: Snapshot, etag: string | null): Promise<void> {
  const body = JSON.stringify(snapshot);
  if (usingBlob()) {
    try {
      await put(PATH, body, {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
      });
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) throw new ConflictError('Another refresh wrote the snapshot first.');
      throw e;
    }
    return;
  }
  if (etag && existsSync(LOCAL) && String(statSync(LOCAL).mtimeMs) !== etag) throw new ConflictError('Another refresh wrote the snapshot first.');
  mkdirSync(dirname(LOCAL), { recursive: true });
  writeFileSync(LOCAL, body);
}
