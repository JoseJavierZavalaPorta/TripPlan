// src/types/db.ts
// Raw Oracle row types — columns come back uppercase from oracledb OUT_FORMAT_OBJECT

export interface DbUser {
  ID: Buffer;
  EMAIL: string | null;
  NAME: string;
  AVATAR_URL: string | null;
  PASSWORD_HASH: string | null;
  CREATED_AT: Date;
}

export interface DbTrip {
  ID: Buffer;
  TITLE: string;
  DESCRIPTION: string | null;
  DESTINATION: string;
  DESTINATION_LAT: number | null;
  DESTINATION_LNG: number | null;
  START_DATE: Date;
  END_DATE: Date;
  STATUS: string;
  LEADER_ID: Buffer;
  FLIGHT_STATUS: string | null;
  OUTBOUND_DATE: Date | null;
  RETURN_DATE: Date | null;
  OUTBOUND_FLIGHT: string | null;
  RETURN_FLIGHT: string | null;
  TRIP_NOTES: string | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  // Joined fields
  LEADER_NAME?: string;
  PARTICIPANT_COUNT?: number;
}

export interface DbPlanningConversation {
  ID: Buffer;
  TRIP_ID: Buffer;
  ROLE: string;
  CONTENT: string;
  CREATED_AT: Date;
}

export interface DbTripParticipant {
  ID: Buffer;
  TRIP_ID: Buffer;
  USER_ID: Buffer;
  USER_NAME: string;
  USER_EMAIL: string | null;
  USER_AVATAR_URL: string | null;
  ROLE: string;
  STATUS: string;
  CAN_EDIT: number;   // 1 = can suggest/edit, 0 = view only
  JOINED_AT: Date | null;
  CREATED_AT: Date;
}

export interface DbTravelerProfile {
  ID: Buffer;
  TRIP_ID: Buffer;
  USER_ID: Buffer;
  ARRIVAL_DATE: Date | null;
  ARRIVAL_TIME: string | null;   // 'HH:MM'
  DEPARTURE_DATE: Date | null;
  DEPARTURE_TIME: string | null; // 'HH:MM'
  DIET_TYPE: string | null;
  FOOD_ALLERGIES: string | null;
  CUISINE_PREFS: string | null;
  MOBILITY_NEEDS: string | null;
  VISUAL_NEEDS: string | null;
  HEARING_NEEDS: string | null;
  OTHER_ACCESSIBILITY: string | null;
  TRAVEL_PACE: string | null;
  INTERESTS: string | null;
  BUDGET_RANGE: string | null;
  SPECIAL_REQUESTS: string | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
}

export interface DbItineraryDay {
  ID: Buffer;
  TRIP_ID: Buffer;
  DAY_DATE: Date;
  DAY_NUMBER: number;
  CITY: string | null;
  COUNTRY: string | null;
  FLAG: string | null;
  LOCKED: number;   // 0 = free, 1 = locked
  NOTES: string | null;
  CREATED_AT: Date;
}

export interface DbItineraryItem {
  ID: Buffer;
  DAY_ID: Buffer;
  TRIP_ID: Buffer;
  POSITION: number;
  ITEM_TYPE: string;
  TITLE: string;
  DESCRIPTION: string | null;
  LOCATION_NAME: string | null;
  LOCATION_LAT: number | null;
  LOCATION_LNG: number | null;
  ADDRESS: string | null;
  START_TIME: string | null;
  END_TIME: string | null;
  DURATION_MIN: number | null;
  ESTIMATED_COST: number | null;
  CURRENCY: string;
  STATUS: string;
  AI_GENERATED: number;
  BOOKING_URL: string | null;
  NOTES: string | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
}

export interface DbItemVote {
  ID: Buffer;
  TRIP_ID: Buffer;
  ITEM_ID: Buffer | null;   // null for 'add' proposals (no existing item yet)
  ACTION_TYPE: string;
  PROPOSED_BY: Buffer;
  STATUS: string;
  REPLACEMENT_DATA: string | null;
  CREATED_AT: Date;
  CLOSED_AT: Date | null;
  PROPOSED_BY_NAME?: string;
}

export interface DbVoteResponse {
  ID: Buffer;
  VOTE_ID: Buffer;
  USER_ID: Buffer;
  RESPONSE: string;
  VOTED_AT: Date;
  USER_NAME?: string;
}

export interface DbTripMedia {
  ID: Buffer;
  TRIP_ID: Buffer;
  ITEM_ID: Buffer | null;
  USER_ID: Buffer;
  MEDIA_TYPE: string;
  URL: string;
  TITLE: string | null;
  THUMBNAIL_URL: string | null;
  CREATED_AT: Date;
}

export interface DbTripMediaFile {
  MEDIA_ID: Buffer;
  MIME_TYPE: string;
  FILE_DATA: Buffer;
}

export interface DbTripInvitation {
  ID: Buffer;
  TRIP_ID: Buffer;
  INVITED_BY: Buffer;
  EMAIL: string;
  TOKEN: string;
  STATUS: string;
  EXPIRES_AT: Date;
  CREATED_AT: Date;
}
