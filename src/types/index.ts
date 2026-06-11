// src/types/index.ts
// Domain types for TripPlan

export interface User {
  id: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export type TripStatus = 'planning' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type FlightStatus = 'none' | 'tentative' | 'booked';

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  destination: string;
  destinationLat: number | null;
  destinationLng: number | null;
  startDate: string;        // ISO date string
  endDate: string;
  status: TripStatus;
  leaderId: string;
  leaderName?: string;
  participantCount?: number;
  flightStatus: FlightStatus;
  outboundDate: string | null;
  returnDate: string | null;
  outboundFlight: string | null;
  returnFlight: string | null;
  tripNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningMessage {
  id: string;
  tripId: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: string;
}

export interface AgentProposal {
  summary: string;
  cityAssignments: Array<{ day: number; city: string; country: string; flag: string }>;
  highlights: string[];
}

export interface AgentResponse {
  type: 'question' | 'proposal' | 'message';
  content: string;
  proposal?: AgentProposal;
}

export type ParticipantRole = 'leader' | 'member';
export type ParticipantStatus = 'pending' | 'accepted' | 'declined';

export interface TripParticipant {
  id: string;
  tripId: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  userAvatarUrl: string | null;
  role: ParticipantRole;
  status: ParticipantStatus;
  canEdit: boolean;
  joinedAt: string | null;
  createdAt: string;
}

export type DietType =
  | 'omnivore'
  | 'vegetarian'
  | 'vegan'
  | 'pescatarian'
  | 'halal'
  | 'kosher'
  | 'other';

export type TravelPace = 'slow' | 'moderate' | 'fast';
export type BudgetRange = 'budget' | 'mid' | 'luxury';

export interface TravelerProfile {
  id: string;
  tripId: string;
  userId: string;
  arrivalDate: string | null;
  arrivalTime: string | null;    // 'HH:MM' — time they arrive at destination
  departureDate: string | null;
  departureTime: string | null;  // 'HH:MM' — time they leave on last day
  dietType: DietType | null;
  foodAllergies: string | null;
  cuisinePrefs: string | null;
  mobilityNeeds: string | null;
  visualNeeds: string | null;
  hearingNeeds: string | null;
  otherAccessibility: string | null;
  travelPace: TravelPace | null;
  interests: string[];          // parsed from JSON string in DB
  budgetRange: BudgetRange | null;
  specialRequests: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ItemType =
  | 'activity'
  | 'meal'
  | 'transport'
  | 'rest'
  | 'accommodation'
  | 'free_time';

export type ItemStatus = 'planned' | 'confirmed' | 'cancelled' | 'completed';

export interface ItineraryItem {
  id: string;
  dayId: string;
  tripId: string;
  position: number;
  itemType: ItemType;
  title: string;
  description: string | null;
  locationName: string | null;
  locationLat: number | null;
  locationLng: number | null;
  address: string | null;
  startTime: string | null;     // 'HH:MM'
  endTime: string | null;
  durationMin: number | null;
  estimatedCost: number | null;
  currency: string;
  status: ItemStatus;
  aiGenerated: boolean;
  bookingUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryDay {
  id: string;
  tripId: string;
  dayDate: string;
  dayNumber: number;
  city: string | null;
  country: string | null;
  flag: string | null;
  locked: boolean;
  notes: string | null;
  items: ItineraryItem[];
  createdAt: string;
}

export type TransportMode =
  | 'walking'
  | 'taxi'
  | 'bus'
  | 'metro'
  | 'uber'
  | 'bike'
  | 'car'
  | 'plane'
  | 'boat'
  | 'train';

export interface TransportLeg {
  id: string;
  tripId: string;
  fromItemId: string | null;
  toItemId: string | null;
  transportMode: TransportMode | null;
  durationMin: number | null;
  distanceKm: number | null;
  estimatedCost: number | null;
  routeNotes: string | null;
  routeColor: string | null;
  createdAt: string;
}

export type VoteActionType = 'add' | 'remove' | 'replace';
export type VoteStatus = 'open' | 'approved' | 'rejected' | 'cancelled';

export interface ItemVote {
  id: string;
  tripId: string;
  itemId: string | null;   // null for 'add' proposals
  actionType: VoteActionType;
  proposedBy: string;
  proposedByName?: string;
  status: VoteStatus;
  replacementData: unknown | null;
  createdAt: string;
  closedAt: string | null;
  responses?: VoteResponse[];
}

export interface VoteResponse {
  id: string;
  voteId: string;
  userId: string;
  userName?: string;
  response: 'yes' | 'no' | 'abstain';
  votedAt: string;
}

export type BudgetCategory =
  | 'accommodation'
  | 'food'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'other';

export interface BudgetEntry {
  id: string;
  tripId: string;
  userId: string | null;
  category: BudgetCategory | null;
  description: string;
  estimated: number | null;
  actual: number | null;
  currency: string;
  isShared: boolean;
  createdAt: string;
}

export type MediaType = 'image' | 'youtube' | 'tiktok' | 'instagram' | 'link';

export interface TripMedia {
  id: string;
  tripId: string;
  itemId: string | null;
  userId: string;
  mediaType: MediaType;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface TripMediaAlbumEntry {
  id: string;
  tripId: string;
  itemId: string | null;
  userId: string;
  uploaderName: string;
  uploaderAvatar: string | null;
  mediaType: MediaType;
  url: string;
  title: string | null;
  createdAt: string;
  dayNumber: number | null;
  dayDate: string | null;
  itemTitle: string | null;
}

export interface TripInvitation {
  id: string;
  tripId: string;
  invitedBy: string;
  email: string;
  token: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
}

// ── API response wrapper ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
