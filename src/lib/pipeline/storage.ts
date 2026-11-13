/**
 * Where the live snapshot is kept: data/snapshot.json under the working directory (on the home server,
 * a Docker volume mounted at /app/data). Writes are conditional on the version read, so two
 * overlapping refresh runs can't overwrite each other's work, and atomic (temp file + rename), so a
 * reader never sees a half-written file.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Snapshot } from './snapshot';

const LOCAL = join(process.cwd(), 'data/snapshot.json');

export interface Stored {
  snapshot: Snapshot;
  /** Version tag to pass back when writing. */
  etag: string | null;
}

export async function readSnapshot(): Promise<Stored | null> {
  if (!existsSync(LOCAL)) return null;
  return { snapshot: JSON.parse(readFileSync(LOCAL, 'utf8')) as Snapshot, etag: String(statSync(LOCAL).mtimeMs) };
}

export class ConflictError extends Error {}

export async function writeSnapshot(snapshot: Snapshot, etag: string | null): Promise<void> {
  const body = JSON.stringify(snapshot);
  if (etag && existsSync(LOCAL) && String(statSync(LOCAL).mtimeMs) !== etag) throw new ConflictError('Another refresh wrote the snapshot first.');
  if (!etag && existsSync(LOCAL)) throw new ConflictError('Another refresh wrote the snapshot first.');
  mkdirSync(dirname(LOCAL), { recursive: true });
  const tmp = `${LOCAL}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, LOCAL);
}
