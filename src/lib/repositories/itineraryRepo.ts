// src/lib/repositories/itineraryRepo.ts
import oracledb from 'oracledb';
import { query, queryOne, execute, transaction } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbItineraryDay, DbItineraryItem } from '@/types/db';
import { ItineraryDay, ItineraryItem } from '@/types';
import { GeneratedItinerary, GeneratedDay } from '@/lib/oci-ai';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapItem(row: DbItineraryItem): ItineraryItem {
  return {
    id: rawToHex(row.ID),
    dayId: rawToHex(row.DAY_ID),
    tripId: rawToHex(row.TRIP_ID),
    position: row.POSITION,
    itemType: row.ITEM_TYPE as ItineraryItem['itemType'],
    title: row.TITLE,
    description: row.DESCRIPTION,
    locationName: row.LOCATION_NAME,
    locationLat: row.LOCATION_LAT,
    locationLng: row.LOCATION_LNG,
    address: row.ADDRESS,
    startTime: row.START_TIME,
    endTime: row.END_TIME,
    durationMin: row.DURATION_MIN,
    estimatedCost: row.ESTIMATED_COST,
    currency: row.CURRENCY,
    status: row.STATUS as ItineraryItem['status'],
    aiGenerated: row.AI_GENERATED === 1,
    bookingUrl: row.BOOKING_URL,
    notes: row.NOTES,
    createdAt: row.CREATED_AT.toISOString(),
    updatedAt: row.UPDATED_AT.toISOString(),
  };
}

function mapDay(row: DbItineraryDay, items: ItineraryItem[]): ItineraryDay {
  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    dayDate: row.DAY_DATE.toISOString().split('T')[0],
    dayNumber: row.DAY_NUMBER,
    city: row.CITY ?? null,
    country: row.COUNTRY ?? null,
    flag: row.FLAG ?? null,
    locked: row.LOCKED === 1,
    notes: row.NOTES,
    items,
    createdAt: row.CREATED_AT.toISOString(),
  };
}

// ── Queries ────────────────────────────────────────────────────────────────────

export async function getItinerary(tripId: string): Promise<ItineraryDay[]> {
  const dayRows = await query<DbItineraryDay>(
    `SELECT * FROM itinerary_days WHERE trip_id = :tripId ORDER BY day_number ASC`,
    { tripId: hexToBuffer(tripId) }
  );

  if (dayRows.length === 0) return [];

  const itemRows = await query<DbItineraryItem>(
    `SELECT * FROM itinerary_items WHERE trip_id = :tripId ORDER BY day_id, position ASC`,
    { tripId: hexToBuffer(tripId) }
  );

  // Group items by day id
  const itemsByDayId = new Map<string, ItineraryItem[]>();
  for (const itemRow of itemRows) {
    const dayId = rawToHex(itemRow.DAY_ID);
    if (!itemsByDayId.has(dayId)) itemsByDayId.set(dayId, []);
    itemsByDayId.get(dayId)!.push(mapItem(itemRow));
  }

  return dayRows.map((dayRow) => {
    const dayId = rawToHex(dayRow.ID);
    return mapDay(dayRow, itemsByDayId.get(dayId) ?? []);
  });
}

export async function getItineraryItemById(itemId: string): Promise<ItineraryItem | null> {
  const row = await queryOne<DbItineraryItem>(
    `SELECT * FROM itinerary_items WHERE id = :id`,
    { id: hexToBuffer(itemId) }
  );
  return row ? mapItem(row) : null;
}

// ── Persistence ────────────────────────────────────────────────────────────────

// Delete AI-generated items for unlocked days only.
// Locked days and manual items are always preserved.
export async function clearAiGeneratedItinerary(tripId: string): Promise<void> {
  await transaction(async (conn) => {
    await conn.execute(
      `DELETE FROM itinerary_items
       WHERE trip_id = :tripId
         AND ai_generated = 1
         AND day_id IN (
           SELECT id FROM itinerary_days WHERE trip_id = :tripId AND locked = 0
         )`,
      { tripId: hexToBuffer(tripId) },
      { autoCommit: false }
    );
    await conn.execute(
      `DELETE FROM itinerary_days
       WHERE trip_id = :tripId
         AND locked = 0
         AND NOT EXISTS (
           SELECT 1 FROM itinerary_items ii
           WHERE ii.day_id = itinerary_days.id AND ii.ai_generated = 0
         )`,
      { tripId: hexToBuffer(tripId) },
      { autoCommit: false }
    );
  });
}

// Returns a set of day numbers that are locked for the given trip
export async function getLockedDayNumbers(tripId: string): Promise<Set<number>> {
  const rows = await query<{ DAY_NUMBER: number }>(
    `SELECT day_number FROM itinerary_days WHERE trip_id = :tripId AND locked = 1`,
    { tripId: hexToBuffer(tripId) }
  );
  return new Set(rows.map((r) => r.DAY_NUMBER));
}

// Returns current city assignments for all days (used when partially regenerating)
export async function getDayCityAssignments(
  tripId: string,
): Promise<Array<{ dayNumber: number; city: string | null; country: string | null; flag: string | null }>> {
  const rows = await query<{ DAY_NUMBER: number; CITY: string | null; COUNTRY: string | null; FLAG: string | null }>(
    `SELECT day_number, city, country, flag FROM itinerary_days WHERE trip_id = :tripId ORDER BY day_number`,
    { tripId: hexToBuffer(tripId) }
  );
  return rows.map((r) => ({
    dayNumber: r.DAY_NUMBER,
    city: r.CITY ?? null,
    country: r.COUNTRY ?? null,
    flag: r.FLAG ?? null,
  }));
}

// Toggle the locked state of a single day
export async function toggleDayLock(dayId: string, locked: boolean): Promise<void> {
  await execute(
    `UPDATE itinerary_days SET locked = :locked WHERE id = :id`,
    { locked: locked ? 1 : 0, id: hexToBuffer(dayId) }
  );
}

const VALID_ITEM_TYPES = new Set(['activity','meal','transport','rest','accommodation','free_time']);
const ITEM_TYPE_MAP: Record<string, string> = {
  breakfast: 'meal', lunch: 'meal', dinner: 'meal', brunch: 'meal', snack: 'meal', food: 'meal', restaurant: 'meal',
  walk: 'transport', walking: 'transport', flight: 'transport', train: 'transport', bus: 'transport',
  taxi: 'transport', uber: 'transport', car: 'transport', boat: 'transport', transit: 'transport', drive: 'transport',
  hotel: 'accommodation', hostel: 'accommodation', airbnb: 'accommodation', lodging: 'accommodation', sleep: 'accommodation',
  break: 'rest', relax: 'rest', relaxation: 'rest', nap: 'rest',
  free: 'free_time', leisure: 'free_time',
};

function normalizeItemType(raw: string | null | undefined): string {
  if (!raw) return 'activity';
  const lower = raw.toLowerCase().trim();
  if (VALID_ITEM_TYPES.has(lower)) return lower;
  return ITEM_TYPE_MAP[lower] ?? 'activity';
}

// Persist one generated day immediately after the AI produces it.
// Safe to call concurrently for different days (each runs its own transaction).
export async function saveGeneratedDay(tripId: string, day: GeneratedDay): Promise<void> {
  await transaction(async (conn) => {
    // Upsert day row
    const existingDay = await conn.execute<{ ID: Buffer }>(
      `SELECT id FROM itinerary_days WHERE trip_id = :tripId AND day_date = TO_DATE(:dayDate, 'YYYY-MM-DD')`,
      { tripId: hexToBuffer(tripId), dayDate: day.dayDate },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let dayIdBuf: Buffer;
    const existingRows = existingDay.rows as Array<{ ID: Buffer }> | undefined;

    if (existingRows && existingRows.length > 0) {
      dayIdBuf = existingRows[0].ID;
      // Update city/country/flag on the existing row if provided
      if (day.city || day.country || day.flag) {
        await conn.execute(
          `UPDATE itinerary_days SET city = :city, country = :country, flag = :flag WHERE id = :id`,
          { city: day.city ?? null, country: day.country ?? null, flag: day.flag ?? null, id: dayIdBuf },
          { autoCommit: false }
        );
      }
    } else {
      const dayResult = await conn.execute(
        `INSERT INTO itinerary_days (id, trip_id, day_date, day_number, city, country, flag)
         VALUES (SYS_GUID(), :tripId, TO_DATE(:dayDate, 'YYYY-MM-DD'), :dayNumber, :city, :country, :flag)
         RETURNING id INTO :newId`,
        {
          tripId: hexToBuffer(tripId),
          dayDate: day.dayDate,
          dayNumber: day.dayNumber,
          city: day.city ?? null,
          country: day.country ?? null,
          flag: day.flag ?? null,
          newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
        },
        { autoCommit: false }
      );
      const dayBinds = dayResult.outBinds as { newId: Buffer[] };
      dayIdBuf = dayBinds.newId[0];
    }

    for (const item of day.items) {
      await conn.execute(
        `INSERT INTO itinerary_items
           (id, day_id, trip_id, position, item_type, title, description,
            location_name, address, start_time, end_time, duration_min,
            estimated_cost, currency, ai_generated, notes)
         VALUES
           (SYS_GUID(), :dayId, :tripId, :position, :itemType, :title, :description,
            :locationName, :address, :startTime, :endTime, :durationMin,
            :estimatedCost, :currency, 1, :notes)`,
        {
          dayId: dayIdBuf,
          tripId: hexToBuffer(tripId),
          position: item.position,
          itemType: normalizeItemType(item.itemType),
          title: item.title.substring(0, 300),
          description: item.description ?? null,
          locationName: item.locationName ?? null,
          address: item.address ?? null,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          durationMin: item.durationMin ?? null,
          estimatedCost: item.estimatedCost ?? null,
          currency: item.currency ?? 'PEN',
          notes: item.notes ?? null,
        },
        { autoCommit: false }
      );
    }
  });
}

export async function saveGeneratedItinerary(
  tripId: string,
  generated: GeneratedItinerary
): Promise<void> {
  await clearAiGeneratedItinerary(tripId);
  for (const day of generated.days) {
    await saveGeneratedDay(tripId, day);
  }
}

export async function updateItineraryItem(
  itemId: string,
  data: {
    title?: string;
    description?: string | null;
    locationName?: string | null;
    address?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    durationMin?: number | null;
    estimatedCost?: number | null;
    notes?: string | null;
  }
): Promise<void> {
  const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const binds: Record<string, unknown> = { itemId: hexToBuffer(itemId) };

  if (data.title !== undefined)        { sets.push('title = :title');               binds.title = data.title.substring(0, 300); }
  if (data.description !== undefined)  { sets.push('description = :description');   binds.description = data.description; }
  if (data.locationName !== undefined) { sets.push('location_name = :locationName'); binds.locationName = data.locationName; }
  if (data.address !== undefined)      { sets.push('address = :address');            binds.address = data.address; }
  if (data.startTime !== undefined)    { sets.push('start_time = :startTime');       binds.startTime = data.startTime; }
  if (data.endTime !== undefined)      { sets.push('end_time = :endTime');           binds.endTime = data.endTime; }
  if (data.durationMin !== undefined)  { sets.push('duration_min = :durationMin');   binds.durationMin = data.durationMin; }
  if (data.estimatedCost !== undefined){ sets.push('estimated_cost = :estimatedCost'); binds.estimatedCost = data.estimatedCost; }
  if (data.notes !== undefined)        { sets.push('notes = :notes');                binds.notes = data.notes; }

  if (sets.length === 1) return; // nothing to update

  await execute(
    `UPDATE itinerary_items SET ${sets.join(', ')} WHERE id = :itemId`,
    binds as oracledb.BindParameters
  );
}

export async function addItineraryItem(data: {
  dayId: string;
  tripId: string;
  position: number;
  itemType: ItineraryItem['itemType'];
  title: string;
  description?: string;
  locationName?: string;
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  estimatedCost?: number;
  currency?: string;
  notes?: string;
}): Promise<string> {
  const result = await execute(
    `INSERT INTO itinerary_items
       (id, day_id, trip_id, position, item_type, title, description,
        location_name, start_time, end_time, duration_min, estimated_cost, currency, notes)
     VALUES
       (SYS_GUID(), :dayId, :tripId, :position, :itemType, :title, :description,
        :locationName, :startTime, :endTime, :durationMin, :estimatedCost, :currency, :notes)
     RETURNING id INTO :newId`,
    {
      dayId: hexToBuffer(data.dayId),
      tripId: hexToBuffer(data.tripId),
      position: data.position,
      itemType: data.itemType,
      title: data.title,
      description: data.description ?? null,
      locationName: data.locationName ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      durationMin: data.durationMin ?? null,
      estimatedCost: data.estimatedCost ?? null,
      currency: data.currency ?? 'PEN',
      notes: data.notes ?? null,
      newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
    }
  );
  const outBinds = result.outBinds as { newId: Buffer[] };
  return rawToHex(outBinds.newId[0]);
}

// Shift positions of items at or after `fromPosition` in a day by +1 to make room for insertion
export async function shiftItemPositions(dayId: string, fromPosition: number): Promise<void> {
  await execute(
    `UPDATE itinerary_items SET position = position + 1
     WHERE day_id = :dayId AND position >= :fromPosition`,
    { dayId: hexToBuffer(dayId), fromPosition }
  );
}

// Insert a manual item at a specific position (shifts existing items down)
export async function insertItineraryItem(data: {
  dayId: string;
  tripId: string;
  position: number;
  itemType: ItineraryItem['itemType'];
  title: string;
  description?: string;
  locationName?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  address?: string;
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  estimatedCost?: number;
  currency?: string;
  notes?: string;
}): Promise<string> {
  return transaction(async (conn) => {
    // Shift existing items at or after this position
    await conn.execute(
      `UPDATE itinerary_items SET position = position + 1
       WHERE day_id = :dayId AND position >= :fromPosition`,
      { dayId: hexToBuffer(data.dayId), fromPosition: data.position },
      { autoCommit: false }
    );

    // Insert the new item
    const result = await conn.execute(
      `INSERT INTO itinerary_items
         (id, day_id, trip_id, position, item_type, title, description,
          location_name, location_lat, location_lng, address,
          start_time, end_time, duration_min, estimated_cost, currency, notes, ai_generated)
       VALUES
         (SYS_GUID(), :dayId, :tripId, :position, :itemType, :title, :description,
          :locationName, :locationLat, :locationLng, :address,
          :startTime, :endTime, :durationMin, :estimatedCost, :currency, :notes, 0)
       RETURNING id INTO :newId`,
      {
        dayId: hexToBuffer(data.dayId),
        tripId: hexToBuffer(data.tripId),
        position: data.position,
        itemType: data.itemType,
        title: data.title.substring(0, 300),
        description: data.description ?? null,
        locationName: data.locationName ?? null,
        locationLat: data.locationLat ?? null,
        locationLng: data.locationLng ?? null,
        address: data.address ?? null,
        startTime: data.startTime ?? null,
        endTime: data.endTime ?? null,
        durationMin: data.durationMin ?? null,
        estimatedCost: data.estimatedCost ?? null,
        currency: data.currency ?? 'EUR',
        notes: data.notes ?? null,
        newId: { dir: oracledb.BIND_OUT, type: oracledb.DB_TYPE_RAW, maxSize: 16 },
      },
      { autoCommit: false }
    );

    const outBinds = result.outBinds as { newId: Buffer[] };
    return rawToHex(outBinds.newId[0]);
  });
}
