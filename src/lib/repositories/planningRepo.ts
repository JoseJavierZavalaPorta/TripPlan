// src/lib/repositories/planningRepo.ts
import oracledb from 'oracledb';
import { query, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbPlanningConversation } from '@/types/db';
import { PlanningMessage } from '@/types';

function mapMessage(row: DbPlanningConversation): PlanningMessage {
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    role: row.ROLE as 'user' | 'agent',
    content: row.CONTENT,
    createdAt: row.CREATED_AT.toISOString(),
  };
}

export async function getPlanningHistory(tripId: string): Promise<PlanningMessage[]> {
  const rows = await query<DbPlanningConversation>(
    `SELECT id, trip_id, role, content, created_at
     FROM planning_conversations
     WHERE trip_id = :tripId
     ORDER BY created_at ASC`,
    { tripId: hexToBuffer(tripId) }
  );
  return rows.map(mapMessage);
}

export async function savePlanningMessage(
  tripId: string,
  role: 'user' | 'agent',
  content: string,
): Promise<PlanningMessage> {
  const result = await execute(
    `INSERT INTO planning_conversations (id, trip_id, role, content)
     VALUES (SYS_GUID(), :tripId, :role, :content)
     RETURNING id, created_at INTO :newId, :createdAt`,
    {
      tripId: hexToBuffer(tripId),
      role,
      content,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
      createdAt: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_TIMESTAMP, maxSize: 50 },
    }
  );
  const out = result.outBinds as { newId: Buffer[]; createdAt: Date[] };
  return {
    id: rawToHex(out.newId[0]),
    tripId,
    role,
    content,
    createdAt: out.createdAt[0].toISOString(),
  };
}

export async function clearPlanningHistory(tripId: string): Promise<void> {
  await execute(
    `DELETE FROM planning_conversations WHERE trip_id = :tripId`,
    { tripId: hexToBuffer(tripId) }
  );
}
