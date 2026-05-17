import oracledb from 'oracledb';
import { query, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';

export async function getBlacklist(tripId: string): Promise<string[]> {
  const rows = await query<{ TITLE: string }>(
    `SELECT title FROM trip_blacklist WHERE trip_id = :tripId ORDER BY created_at ASC`,
    { tripId: hexToBuffer(tripId) }
  );
  return rows.map(r => r.TITLE);
}

export async function addToBlacklist(tripId: string, title: string): Promise<void> {
  // Idempotent: ignore if already blacklisted
  const existing = await query<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt FROM trip_blacklist
     WHERE trip_id = :tripId AND LOWER(title) = LOWER(:title)`,
    { tripId: hexToBuffer(tripId), title }
  );
  if ((existing[0]?.CNT ?? 0) > 0) return;

  await execute(
    `INSERT INTO trip_blacklist (id, trip_id, title)
     VALUES (SYS_GUID(), :tripId, :title)`,
    { tripId: hexToBuffer(tripId), title: title.substring(0, 300) }
  );
}
