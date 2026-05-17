// src/lib/repositories/profileRepo.ts
import oracledb from 'oracledb';
import { queryOne, execute } from '../db-helpers';
import { rawToHex, hexToBuffer } from '../db';
import { DbTravelerProfile } from '@/types/db';
import { TravelerProfile } from '@/types';

function mapProfile(row: DbTravelerProfile): TravelerProfile {
  let interests: string[] = [];
  try {
    if (row.INTERESTS) {
      const parsed = JSON.parse(row.INTERESTS);
      interests = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    // ASSUMPTION: interests stored as JSON array string; fallback to empty array on parse error
    interests = [];
  }

  return {
    id: rawToHex(row.ID),
    tripId: rawToHex(row.TRIP_ID),
    userId: rawToHex(row.USER_ID),
    arrivalDate: row.ARRIVAL_DATE?.toISOString().split('T')[0] ?? null,
    arrivalTime: row.ARRIVAL_TIME ?? null,
    departureDate: row.DEPARTURE_DATE?.toISOString().split('T')[0] ?? null,
    departureTime: row.DEPARTURE_TIME ?? null,
    dietType: row.DIET_TYPE as TravelerProfile['dietType'],
    foodAllergies: row.FOOD_ALLERGIES,
    cuisinePrefs: row.CUISINE_PREFS,
    mobilityNeeds: row.MOBILITY_NEEDS,
    visualNeeds: row.VISUAL_NEEDS,
    hearingNeeds: row.HEARING_NEEDS,
    otherAccessibility: row.OTHER_ACCESSIBILITY,
    travelPace: row.TRAVEL_PACE as TravelerProfile['travelPace'],
    interests,
    budgetRange: row.BUDGET_RANGE as TravelerProfile['budgetRange'],
    specialRequests: row.SPECIAL_REQUESTS,
    createdAt: row.CREATED_AT.toISOString(),
    updatedAt: row.UPDATED_AT.toISOString(),
  };
}

export async function getTravelerProfile(
  tripId: string,
  userId: string
): Promise<TravelerProfile | null> {
  const row = await queryOne<DbTravelerProfile>(
    `SELECT * FROM traveler_profiles WHERE trip_id = :tripId AND user_id = :userId`,
    { tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );
  return row ? mapProfile(row) : null;
}

export async function getAllTravelerProfiles(tripId: string): Promise<TravelerProfile[]> {
  const { query } = await import('../db-helpers');
  const rows = await query<DbTravelerProfile>(
    `SELECT * FROM traveler_profiles WHERE trip_id = :tripId`,
    { tripId: hexToBuffer(tripId) }
  );
  return rows.map(mapProfile);
}

export async function upsertTravelerProfile(
  tripId: string,
  userId: string,
  data: Partial<Omit<TravelerProfile, 'id' | 'tripId' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const existing = await queryOne<{ ID: Buffer }>(
    `SELECT id FROM traveler_profiles WHERE trip_id = :tripId AND user_id = :userId`,
    { tripId: hexToBuffer(tripId), userId: hexToBuffer(userId) }
  );

  const interestsJson = data.interests !== undefined
    ? JSON.stringify(data.interests)
    : undefined;

  if (existing) {
    // Build dynamic UPDATE
    const sets: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const binds: oracledb.BindParameters & Record<string, unknown> = {
      tripId: hexToBuffer(tripId),
      userId: hexToBuffer(userId),
    };

    if (data.arrivalDate !== undefined)   { sets.push('arrival_date = TO_DATE(:arrivalDate, \'YYYY-MM-DD\')');   binds.arrivalDate   = data.arrivalDate; }
    if (data.arrivalTime !== undefined)   { sets.push('arrival_time = :arrivalTime');                             binds.arrivalTime   = data.arrivalTime; }
    if (data.departureDate !== undefined) { sets.push('departure_date = TO_DATE(:departureDate, \'YYYY-MM-DD\')'); binds.departureDate = data.departureDate; }
    if (data.departureTime !== undefined) { sets.push('departure_time = :departureTime');                          binds.departureTime = data.departureTime; }
    if (data.dietType !== undefined) { sets.push('diet_type = :dietType'); binds.dietType = data.dietType; }
    if (data.foodAllergies !== undefined) { sets.push('food_allergies = :foodAllergies'); binds.foodAllergies = data.foodAllergies; }
    if (data.cuisinePrefs !== undefined) { sets.push('cuisine_prefs = :cuisinePrefs'); binds.cuisinePrefs = data.cuisinePrefs; }
    if (data.mobilityNeeds !== undefined) { sets.push('mobility_needs = :mobilityNeeds'); binds.mobilityNeeds = data.mobilityNeeds; }
    if (data.visualNeeds !== undefined) { sets.push('visual_needs = :visualNeeds'); binds.visualNeeds = data.visualNeeds; }
    if (data.hearingNeeds !== undefined) { sets.push('hearing_needs = :hearingNeeds'); binds.hearingNeeds = data.hearingNeeds; }
    if (data.otherAccessibility !== undefined) { sets.push('other_accessibility = :otherAccessibility'); binds.otherAccessibility = data.otherAccessibility; }
    if (data.travelPace !== undefined) { sets.push('travel_pace = :travelPace'); binds.travelPace = data.travelPace; }
    if (interestsJson !== undefined) { sets.push('interests = :interests'); binds.interests = interestsJson; }
    if (data.budgetRange !== undefined) { sets.push('budget_range = :budgetRange'); binds.budgetRange = data.budgetRange; }
    if (data.specialRequests !== undefined) { sets.push('special_requests = :specialRequests'); binds.specialRequests = data.specialRequests; }

    await execute(
      `UPDATE traveler_profiles SET ${sets.join(', ')}
       WHERE trip_id = :tripId AND user_id = :userId`,
      binds
    );
  } else {
    await execute(
      `INSERT INTO traveler_profiles
         (id, trip_id, user_id, arrival_date, arrival_time, departure_date, departure_time,
          diet_type, food_allergies, cuisine_prefs, mobility_needs, visual_needs,
          hearing_needs, other_accessibility, travel_pace, interests, budget_range, special_requests)
       VALUES
         (SYS_GUID(), :tripId, :userId,
          TO_DATE(:arrivalDate, 'YYYY-MM-DD'), :arrivalTime,
          TO_DATE(:departureDate, 'YYYY-MM-DD'), :departureTime,
          :dietType, :foodAllergies, :cuisinePrefs, :mobilityNeeds, :visualNeeds,
          :hearingNeeds, :otherAccessibility, :travelPace, :interests, :budgetRange, :specialRequests)`,
      {
        tripId: hexToBuffer(tripId),
        userId: hexToBuffer(userId),
        arrivalDate: data.arrivalDate ?? null,
        arrivalTime: data.arrivalTime ?? null,
        departureDate: data.departureDate ?? null,
        departureTime: data.departureTime ?? null,
        dietType: data.dietType ?? null,
        foodAllergies: data.foodAllergies ?? null,
        cuisinePrefs: data.cuisinePrefs ?? null,
        mobilityNeeds: data.mobilityNeeds ?? null,
        visualNeeds: data.visualNeeds ?? null,
        hearingNeeds: data.hearingNeeds ?? null,
        otherAccessibility: data.otherAccessibility ?? null,
        travelPace: data.travelPace ?? null,
        interests: interestsJson ?? null,
        budgetRange: data.budgetRange ?? null,
        specialRequests: data.specialRequests ?? null,
      }
    );
  }
}
