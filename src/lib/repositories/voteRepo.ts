// src/lib/repositories/voteRepo.ts
import oracledb from 'oracledb';
import { query, queryOne, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbItemVote, DbVoteResponse } from '@/types/db';
import { ItemVote, VoteResponse } from '@/types';

function mapVote(row: DbItemVote): ItemVote {
  let replacementData: unknown = null;
  if (row.REPLACEMENT_DATA) {
    try { replacementData = JSON.parse(row.REPLACEMENT_DATA); } catch { /* ignore */ }
  }
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    itemId: row.ITEM_ID ? rawToHex(row.ITEM_ID) : null,
    actionType: row.ACTION_TYPE as ItemVote['actionType'],
    proposedBy: rawToHex(row.PROPOSED_BY),
    proposedByName: row.PROPOSED_BY_NAME,
    status: row.STATUS as ItemVote['status'],
    replacementData,
    createdAt: row.CREATED_AT.toISOString(),
    closedAt: row.CLOSED_AT?.toISOString() ?? null,
  };
}

function mapResponse(row: DbVoteResponse): VoteResponse {
  return {
    id: rawToHex(row.ID),
    voteId: rawToHex(row.VOTE_ID),
    userId: rawToHex(row.USER_ID),
    userName: row.USER_NAME,
    response: row.RESPONSE as VoteResponse['response'],
    votedAt: row.VOTED_AT.toISOString(),
  };
}

export async function getVotesByTrip(tripId: string): Promise<ItemVote[]> {
  const rows = await query<DbItemVote>(
    `SELECT iv.*, u.name AS proposed_by_name
     FROM item_votes iv
     JOIN users u ON u.id = iv.proposed_by
     WHERE iv.trip_id = :tripId
     ORDER BY iv.created_at DESC`,
    { tripId: hexToBuffer(tripId) }
  );

  const votes = rows.map(mapVote);

  // Fetch responses for all votes
  if (votes.length > 0) {
    const voteIds = votes.map((v) => v.id);
    const responseRows = await query<DbVoteResponse>(
      `SELECT vr.*, u.name AS user_name FROM vote_responses vr
       JOIN users u ON u.id = vr.user_id
       WHERE vr.vote_id IN (${voteIds.map((_, i) => `:v${i}`).join(',')})`,
      Object.fromEntries(voteIds.map((id, i) => [`v${i}`, hexToBuffer(id)]))
    );
    const responsesByVoteId = new Map<string, VoteResponse[]>();
    for (const r of responseRows.map(mapResponse)) {
      if (!responsesByVoteId.has(r.voteId)) responsesByVoteId.set(r.voteId, []);
      responsesByVoteId.get(r.voteId)!.push(r);
    }
    for (const vote of votes) {
      vote.responses = responsesByVoteId.get(vote.id) ?? [];
    }
  }

  return votes;
}

export async function createVote(data: {
  tripId: string;
  itemId?: string | null;   // null/undefined for 'add' proposals
  actionType: ItemVote['actionType'];
  proposedBy: string;
  replacementData?: unknown;
}): Promise<string> {
  const result = await execute(
    `INSERT INTO item_votes (id, trip_id, item_id, action_type, proposed_by, replacement_data)
     VALUES (SYS_GUID(), :tripId, :itemId, :actionType, :proposedBy, :replacementData)
     RETURNING id INTO :newId`,
    {
      tripId: hexToBuffer(data.tripId),
      itemId: data.itemId ? hexToBuffer(data.itemId) : null,
      actionType: data.actionType,
      proposedBy: hexToBuffer(data.proposedBy),
      replacementData: data.replacementData ? JSON.stringify(data.replacementData) : null,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
    }
  );
  const outBinds = result.outBinds as { newId: Buffer[] };
  return rawToHex(outBinds.newId[0]);
}

export async function closeVote(voteId: string, outcome: 'approved' | 'rejected'): Promise<void> {
  const status = outcome === 'approved' ? 'approved' : 'rejected';
  await execute(
    `UPDATE item_votes SET status = :status, closed_at = CURRENT_TIMESTAMP WHERE id = :id`,
    { status, id: hexToBuffer(voteId) }
  );
}

export async function getOpenVotesForTrip(tripId: string): Promise<ItemVote[]> {
  const rows = await query<DbItemVote>(
    `SELECT iv.*, u.name AS proposed_by_name
     FROM item_votes iv
     JOIN users u ON u.id = iv.proposed_by
     WHERE iv.trip_id = :tripId AND iv.status = 'open'
     ORDER BY iv.created_at DESC`,
    { tripId: hexToBuffer(tripId) }
  );
  const votes = rows.map(mapVote);
  if (votes.length === 0) return votes;

  const voteIds = votes.map(v => v.id);
  const responseRows = await query<DbVoteResponse>(
    `SELECT vr.*, u.name AS user_name FROM vote_responses vr
     JOIN users u ON u.id = vr.user_id
     WHERE vr.vote_id IN (${voteIds.map((_, i) => `:v${i}`).join(',')})`,
    Object.fromEntries(voteIds.map((id, i) => [`v${i}`, hexToBuffer(id)]))
  );
  const byVoteId = new Map<string, VoteResponse[]>();
  for (const r of responseRows.map(mapResponse)) {
    if (!byVoteId.has(r.voteId)) byVoteId.set(r.voteId, []);
    byVoteId.get(r.voteId)!.push(r);
  }
  for (const vote of votes) {
    vote.responses = byVoteId.get(vote.id) ?? [];
  }
  return votes;
}

export async function respondToVote(data: {
  voteId: string;
  userId: string;
  response: VoteResponse['response'];
}): Promise<void> {
  // UPSERT: if user already voted, update their response
  const existing = await queryOne<{ ID: Buffer }>(
    `SELECT id FROM vote_responses WHERE vote_id = :voteId AND user_id = :userId`,
    { voteId: hexToBuffer(data.voteId), userId: hexToBuffer(data.userId) }
  );

  if (existing) {
    await execute(
      `UPDATE vote_responses SET response = :response, voted_at = CURRENT_TIMESTAMP
       WHERE vote_id = :voteId AND user_id = :userId`,
      { response: data.response, voteId: hexToBuffer(data.voteId), userId: hexToBuffer(data.userId) }
    );
  } else {
    await execute(
      `INSERT INTO vote_responses (id, vote_id, user_id, response)
       VALUES (SYS_GUID(), :voteId, :userId, :response)`,
      {
        voteId: hexToBuffer(data.voteId),
        userId: hexToBuffer(data.userId),
        response: data.response,
      }
    );
  }
}
