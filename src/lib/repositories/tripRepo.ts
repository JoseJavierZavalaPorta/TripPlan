// src/lib/repositories/tripRepo.ts
import oracledb from 'oracledb';
import { query, queryOne, execute, transaction } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbTrip, DbTripParticipant, DbTripInvitation } from '@/types/db';
import { Trip, TripParticipant, TripInvitation, FlightStatus } from '@/types';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapTrip(row: DbTrip): Trip {
  return {
    id: rawToHex(row.ID),
    title: row.TITLE,
    description: row.DESCRIPTION,
    destination: row.DESTINATION,
    destinationLat: row.DESTINATION_LAT,
    destinationLng: row.DESTINATION_LNG,
    startDate: row.START_DATE.toISOString().split('T')[0],
    endDate: row.END_DATE.toISOString().split('T')[0],
    status: row.STATUS as Trip['status'],
    leaderId: rawToHex(row.LEADER_ID),
    leaderName: row.LEADER_NAME,
    participantCount: row.PARTICIPANT_COUNT,
    flightStatus: (row.FLIGHT_STATUS ?? 'none') as FlightStatus,
    outboundDate: row.OUTBOUND_DATE ? row.OUTBOUND_DATE.toISOString().split('T')[0] : null,
    returnDate: row.RETURN_DATE ? row.RETURN_DATE.toISOString().split('T')[0] : null,
    outboundFlight: row.OUTBOUND_FLIGHT ?? null,
    returnFlight: row.RETURN_FLIGHT ?? null,
    tripNotes: row.TRIP_NOTES ?? null,
    createdAt: row.CREATED_AT.toISOString(),
    updatedAt: row.UPDATED_AT.toISOString(),
  };
}

function mapParticipant(row: DbTripParticipant): TripParticipant {
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    userId: rawToHex(row.USER_ID),
    userName: row.USER_NAME,
    userEmail: row.USER_EMAIL,
    userAvatarUrl: row.USER_AVATAR_URL,
    role: row.ROLE as TripParticipant['role'],
    status: row.STATUS as TripParticipant['status'],
    canEdit: row.CAN_EDIT === 1,
    joinedAt: row.JOINED_AT?.toISOString() ?? null,
    createdAt: row.CREATED_AT.toISOString(),
  };
}

// ── Trip CRUD ─────────────────────────────────────────────────────────────────

export async function getTripsByUser(userId: string): Promise<Trip[]> {
  const userBuf = hexToBuffer(userId);
  const rows = await query<DbTrip>(
    `SELECT t.id, t.title, t.description, t.destination,
            t.destination_lat, t.destination_lng,
            t.start_date, t.end_date, t.status, t.leader_id,
            t.flight_status, t.outbound_date, t.return_date,
            t.outbound_flight, t.return_flight, t.trip_notes,
            t.created_at, t.updated_at,
            u.name AS leader_name,
            (SELECT COUNT(*) FROM trip_participants tp
             WHERE tp.trip_id = t.id AND tp.status = 'accepted') AS participant_count
     FROM trips t
     JOIN users u ON u.id = t.leader_id
     WHERE t.leader_id = :pLeader
        OR EXISTS (
          SELECT 1 FROM trip_participants tp2
          WHERE tp2.trip_id = t.id
            AND tp2.user_id = :pMember
            AND tp2.status IN ('accepted', 'pending')
        )
     ORDER BY t.start_date DESC`,
    { pLeader: userBuf, pMember: userBuf }
  );
  return rows.map(mapTrip);
}

export async function getTripById(tripId: string): Promise<Trip | null> {
  const row = await queryOne<DbTrip>(
    `SELECT t.*, u.name AS leader_name,
            (SELECT COUNT(*) FROM trip_participants tp
             WHERE tp.trip_id = t.id AND tp.status = 'accepted') AS participant_count
     FROM trips t
     JOIN users u ON u.id = t.leader_id
     WHERE t.id = :id`,
    { id: hexToBuffer(tripId) }
  );
  return row ? mapTrip(row) : null;
}

export async function createTrip(data: {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  leaderId: string;
  description?: string;
  destinationLat?: number;
  destinationLng?: number;
  flightStatus?: string;
  outboundDate?: string;
  returnDate?: string;
  outboundFlight?: string;
  returnFlight?: string;
  tripNotes?: string;
}): Promise<string> {
  let newTripId = '';

  await transaction(async (conn) => {
    // Create the trip
    const tripResult = await conn.execute(
      `INSERT INTO trips (id, title, description, destination, destination_lat, destination_lng,
                         start_date, end_date, leader_id,
                         flight_status, outbound_date, return_date, outbound_flight, return_flight, trip_notes)
       VALUES (SYS_GUID(), :title, :description, :destination, :lat, :lng,
               TO_DATE(:startDate, 'YYYY-MM-DD'), TO_DATE(:endDate, 'YYYY-MM-DD'), :leaderId,
               :flightStatus,
               CASE WHEN :outboundDate IS NOT NULL THEN TO_DATE(:outboundDate2, 'YYYY-MM-DD') END,
               CASE WHEN :returnDate IS NOT NULL THEN TO_DATE(:returnDate2, 'YYYY-MM-DD') END,
               :outboundFlight, :returnFlight, :tripNotes)
       RETURNING id INTO :newId`,
      {
        title: data.title,
        description: data.description ?? null,
        destination: data.destination,
        lat: data.destinationLat ?? null,
        lng: data.destinationLng ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        leaderId: hexToBuffer(data.leaderId),
        flightStatus: data.flightStatus ?? 'none',
        outboundDate: data.outboundDate ?? null,
        outboundDate2: data.outboundDate ?? null,
        returnDate: data.returnDate ?? null,
        returnDate2: data.returnDate ?? null,
        outboundFlight: data.outboundFlight ?? null,
        returnFlight: data.returnFlight ?? null,
        tripNotes: data.tripNotes ?? null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
      },
      { autoCommit: false }
    );
    const tripBinds = tripResult.outBinds as { newId: Buffer[] };
    const tripIdBuf = tripBinds.newId[0];
    newTripId = rawToHex(tripIdBuf);

    // Auto-add leader as accepted participant
    await conn.execute(
      `INSERT INTO trip_participants (id, trip_id, user_id, role, status, joined_at)
       VALUES (SYS_GUID(), :tripId, :userId, 'leader', 'accepted', CURRENT_TIMESTAMP)`,
      { tripId: tripIdBuf, userId: hexToBuffer(data.leaderId) },
      { autoCommit: false }
    );
  });

  return newTripId;
}

export async function updateTripStatus(
  tripId: string,
  status: Trip['status']
): Promise<void> {
  await execute(
    `UPDATE trips SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
    { status, id: hexToBuffer(tripId) }
  );
}

export async function updateTrip(
  tripId: string,
  data: {
    flightStatus?: string;
    outboundDate?: string | null;
    returnDate?: string | null;
    outboundFlight?: string | null;
    returnFlight?: string | null;
    tripNotes?: string | null;
  }
): Promise<void> {
  await execute(
    `UPDATE trips SET
       flight_status   = :flightStatus,
       outbound_date   = CASE WHEN :outboundDate IS NOT NULL THEN TO_DATE(:outboundDate2, 'YYYY-MM-DD') ELSE NULL END,
       return_date     = CASE WHEN :returnDate IS NOT NULL THEN TO_DATE(:returnDate2, 'YYYY-MM-DD') ELSE NULL END,
       outbound_flight = :outboundFlight,
       return_flight   = :returnFlight,
       trip_notes      = :tripNotes,
       updated_at      = CURRENT_TIMESTAMP
     WHERE id = :id`,
    {
      flightStatus: data.flightStatus ?? 'none',
      outboundDate: data.outboundDate ?? null,
      outboundDate2: data.outboundDate ?? null,
      returnDate: data.returnDate ?? null,
      returnDate2: data.returnDate ?? null,
      outboundFlight: data.outboundFlight ?? null,
      returnFlight: data.returnFlight ?? null,
      tripNotes: data.tripNotes ?? null,
      id: hexToBuffer(tripId),
    }
  );
}

// ── Participants ───────────────────────────────────────────────────────────────

export async function getTripParticipants(tripId: string): Promise<TripParticipant[]> {
  const rows = await query<DbTripParticipant>(
    `SELECT tp.*, u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
     FROM trip_participants tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.trip_id = :tripId
     ORDER BY tp.role DESC, tp.joined_at ASC NULLS LAST`,
    { tripId: hexToBuffer(tripId) }
  );
  return rows.map(mapParticipant);
}

export async function addParticipant(data: {
  tripId: string;
  userId: string;
  role?: TripParticipant['role'];
}): Promise<void> {
  await execute(
    `INSERT INTO trip_participants (id, trip_id, user_id, role, status)
     VALUES (SYS_GUID(), :tripId, :userId, :role, 'pending')`,
    {
      tripId: hexToBuffer(data.tripId),
      userId: hexToBuffer(data.userId),
      role: data.role ?? 'member',
    }
  );
}

export async function updateParticipantStatus(
  tripId: string,
  userId: string,
  status: TripParticipant['status']
): Promise<void> {
  const joinedAt = status === 'accepted' ? ', joined_at = CURRENT_TIMESTAMP' : '';
  await execute(
    `UPDATE trip_participants SET status = :status${joinedAt}
     WHERE trip_id = :tripId AND user_id = :userId`,
    { status, tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );
}

export async function isParticipant(tripId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ CNT: number }>(
    `SELECT COUNT(*) AS cnt FROM trip_participants
     WHERE trip_id = :tripId AND user_id = :userId AND status IN ('accepted','pending')`,
    { tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );
  return (row?.CNT ?? 0) > 0;
}

// ── Invitations ────────────────────────────────────────────────────────────────

function mapInvitation(row: DbTripInvitation): TripInvitation {
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    invitedBy: rawToHex(row.INVITED_BY),
    email: row.EMAIL,
    token: row.TOKEN,
    status: row.STATUS as TripInvitation['status'],
    expiresAt: row.EXPIRES_AT.toISOString(),
    createdAt: row.CREATED_AT.toISOString(),
  };
}

export async function createInvitation(data: {
  tripId: string;
  invitedBy: string;
  email: string;
  token: string;
}): Promise<string> {
  const result = await execute(
    `INSERT INTO trip_invitations (id, trip_id, invited_by, email, token, expires_at)
     VALUES (SYS_GUID(), :tripId, :invitedBy, :email, :token,
             CURRENT_TIMESTAMP + INTERVAL '7' DAY)
     RETURNING id INTO :newId`,
    {
      tripId: hexToBuffer(data.tripId),
      invitedBy: hexToBuffer(data.invitedBy),
      email: data.email,
      token: data.token,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
    }
  );
  const outBinds = result.outBinds as { newId: Buffer[] };
  return rawToHex(outBinds.newId[0]);
}

export async function getInvitationByToken(token: string): Promise<TripInvitation | null> {
  const row = await queryOne<DbTripInvitation>(
    `SELECT * FROM trip_invitations WHERE token = :token`,
    { token }
  );
  return row ? mapInvitation(row) : null;
}

export async function acceptInvitation(token: string): Promise<void> {
  await execute(
    `UPDATE trip_invitations SET status = 'accepted' WHERE token = :token`,
    { token }
  );
}

export async function updateParticipantPermission(
  tripId: string,
  userId: string,
  canEdit: boolean,
): Promise<void> {
  await execute(
    `UPDATE trip_participants SET can_edit = :canEdit WHERE trip_id = :tripId AND user_id = :userId`,
    { canEdit: canEdit ? 1 : 0, tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );
}

export async function getParticipantByUserId(
  tripId: string,
  userId: string,
): Promise<TripParticipant | null> {
  const row = await queryOne<DbTripParticipant>(
    `SELECT tp.*, u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
     FROM trip_participants tp
     JOIN users u ON u.id = tp.user_id
     WHERE tp.trip_id = :tripId AND tp.user_id = :userId`,
    { tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );
  return row ? mapParticipant(row) : null;
}
