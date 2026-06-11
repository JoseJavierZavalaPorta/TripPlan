import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// ── OCI credentials (non-secret config values) ─────────────────────────────
const OCI_CONFIG = {
  user:        'ocid1.user.oc1..aaaaaaaarlj6a5jqc7tgbcsjeaiytdl2che3yexvsnvaaiapqhovpa2a4gjq',
  fingerprint: 'd0:e8:49:c1:24:72:2c:ec:79:49:bf:ed:44:59:9e:b6',
  tenancy:     'ocid1.tenancy.oc1..aaaaaaaafhf3ewm4pwj7szqqdills6ojr5seu4q67k44mufp6of7hw46b3iq',
  region:      'us-chicago-1',
  // Chat endpoint — matches generative_ai_client.chat() in the Python reference
  endpoint:    'https://inference.generativeai.us-chicago-1.oci.oraclecloud.com',
  modelId:     'ocid1.generativeaimodel.oc1.us-chicago-1.amaaaaaask7dceyapnibwg42qjhwaxrlqfpreueirtwghiwvv2whsnwmnlva',
};

// ── Private key loader ──────────────────────────────────────────────────────
function loadPrivateKey(): string {
  if (process.env.OCI_PRIVATE_KEY_B64) {
    return Buffer.from(process.env.OCI_PRIVATE_KEY_B64, 'base64').toString('utf-8');
  }
  const keyPath = path.join(process.cwd(), 'oci-keys', 'key.pem');
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf-8');
  }
  throw new Error('OCI private key not found. Place key at oci-keys/key.pem or set OCI_PRIVATE_KEY_B64');
}

// ── OCI HTTP request signing (RSA-SHA256) ───────────────────────────────────
// Follows: https://docs.oracle.com/en-us/iaas/Content/API/Concepts/signingrequests.htm
async function ociPost(urlPath: string, body: unknown): Promise<unknown> {
  const privateKey = loadPrivateKey();
  const host = new URL(OCI_CONFIG.endpoint).hostname;
  const bodyStr = JSON.stringify(body);
  const contentType = 'application/json';
  const contentLength = Buffer.byteLength(bodyStr, 'utf-8');
  const date = new Date().toUTCString();

  // SHA-256 hash of body, base64-encoded (required header x-content-sha256)
  const bodyHash = crypto.createHash('sha256').update(bodyStr, 'utf-8').digest('base64');

  // Required signed headers for POST
  const signedHeaderNames = '(request-target) date host content-type content-length x-content-sha256';
  const signingString = [
    `(request-target): post ${urlPath}`,
    `date: ${date}`,
    `host: ${host}`,
    `content-type: ${contentType}`,
    `content-length: ${contentLength}`,
    `x-content-sha256: ${bodyHash}`,
  ].join('\n');

  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signingString)
    .sign(privateKey, 'base64');

  const keyId = `${OCI_CONFIG.tenancy}/${OCI_CONFIG.user}/${OCI_CONFIG.fingerprint}`;
  const authHeader = `Signature version="1",keyId="${keyId}",algorithm="rsa-sha256",headers="${signedHeaderNames}",signature="${signature}"`;

  const fullUrl = `${OCI_CONFIG.endpoint}${urlPath}`;

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(contentLength),
      'x-content-sha256': bodyHash,
      'date': date,
      'Authorization': authHeader,
    },
    body: bodyStr,
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`OCI API error ${response.status}: ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`OCI returned non-JSON response: ${responseText.slice(0, 200)}`);
  }
}

// ── Public types ─────────────────────────────────────────────────────────────

// Planning wizard types
export interface PlanningQuestion {
  id: string;
  question: string;
  type: 'single' | 'multiple' | 'text';
  options?: string[];
}

export interface ProposedDestination {
  country: string;
  flag: string;
  description: string;
  highlights: string[];
  recommendedDays: number;
}

export interface ProposedCity {
  name: string;
  description: string;
  recommendedDays: number;
  mustSee: string[];
}

export interface CityGroup {
  country: string;
  flag: string;
  cities: ProposedCity[];
}

export interface CityAssignment {
  city: string;
  country: string;
  flag: string;
}

export interface ItemSuggestion {
  title: string;
  description: string;
  locationName?: string;
  address?: string;
  estimatedCost?: number;
  notes?: string;
}

export interface TripDetails {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface ParticipantProfile {
  name: string;
  arrivalTime?: string;    // 'HH:MM' — only relevant on Day 1
  departureTime?: string;  // 'HH:MM' — only relevant on last day
  dietType?: string;
  foodAllergies?: string;
  cuisinePrefs?: string;
  mobilityNeeds?: string;
  visualNeeds?: string;
  hearingNeeds?: string;
  otherAccessibility?: string;
  travelPace?: string;
  interests?: string[];
  budgetRange?: string;
  specialRequests?: string;
}

export interface GeneratedItineraryItem {
  position: number;
  itemType: 'activity' | 'meal' | 'transport' | 'rest' | 'accommodation' | 'free_time';
  title: string;
  description: string;
  locationName?: string;
  address?: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  estimatedCost: number;
  currency: string;
  transportMode?: string;
  transportDurationMin?: number;
  notes?: string;
}

export interface GeneratedDay {
  dayNumber: number;
  dayDate: string;
  city?: string;
  country?: string;
  flag?: string;
  items: GeneratedItineraryItem[];
}

export interface GeneratedItinerary {
  days: GeneratedDay[];
  totalEstimatedCost: number;
  currency: string;
  notes: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildProfileContext(profiles: ParticipantProfile[]): string {
  return profiles.map((p, i) => {
    const parts: string[] = [`T${i + 1}:${p.name}`];
    if (p.dietType)           parts.push(`diet:${p.dietType}`);
    if (p.foodAllergies)      parts.push(`allergy:${p.foodAllergies}`);
    if (p.cuisinePrefs)       parts.push(`cuisine:${p.cuisinePrefs}`);
    if (p.mobilityNeeds)      parts.push(`mobility:${p.mobilityNeeds}`);
    if (p.travelPace)         parts.push(`pace:${p.travelPace}`);
    if (p.interests?.length)  parts.push(`interests:${p.interests.join(',')}`);
    if (p.budgetRange)        parts.push(`budget:${p.budgetRange}`);
    if (p.specialRequests)    parts.push(`req:${p.specialRequests}`);
    return parts.join(' ');
  }).join(' | ');
}

// Returns the latest arrival time across all profiles (most restrictive for Day 1)
function latestArrivalTime(profiles: ParticipantProfile[]): string | undefined {
  const times = profiles.map((p) => p.arrivalTime).filter(Boolean) as string[];
  if (times.length === 0) return undefined;
  return times.sort().at(-1); // lexicographic sort works for HH:MM
}

// Returns the earliest departure time across all profiles (most restrictive for last day)
function earliestDepartureTime(profiles: ParticipantProfile[]): string | undefined {
  const times = profiles.map((p) => p.departureTime).filter(Boolean) as string[];
  if (times.length === 0) return undefined;
  return times.sort()[0];
}

// Returns every calendar date between startDate and endDate inclusive
function buildCalendarDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate + 'T00:00:00Z');
  const end     = new Date(endDate   + 'T00:00:00Z');
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}

// Attempts to recover a malformed or truncated JSON array
function repairJsonArray(raw: string): string {
  const cleaned = raw
    .replace(/```json\s*/gi, '')  // markdown code fence open
    .replace(/```\s*/g, '')       // markdown code fence close
    .replace(/\.{3,}/g, '')       // "..." truncation markers
    .replace(/\/\/[^\n]*/g, '')   // // line comments
    .replace(/\}\s*\{/g, '},{')   // missing comma between objects (Cohere drops them)
    .replace(/,(\s*[}\]])/g, '$1'); // trailing commas before } or ]

  const start = cleaned.indexOf('[');
  if (start < 0) return '[]';

  const lastBrace = cleaned.lastIndexOf('}');
  if (lastBrace < 0) return '[]';

  return cleaned.substring(start, lastBrace + 1) + ']';
}

// ── Per-day prompt ───────────────────────────────────────────────────────────

function buildDayPrompt(
  trip: TripDetails,
  profiles: ParticipantProfile[],
  dayDate: string,
  dayNumber: number,
  totalDays: number,
  visitedLocations: string[],
  cityAssignment?: CityAssignment,
  avoidActivities?: string[],
  prevCityAssignment?: CityAssignment,
): string {
  const profileContext = buildProfileContext(profiles);
  const avoidClause = visitedLocations.length > 0
    ? `\nCRITICAL — LOCATIONS ALREADY USED (never repeat any of these): ${visitedLocations.slice(-40).join(' | ')}`
    : '';
  const blacklistClause = avoidActivities?.length
    ? `\nBLACKLISTED by group (NEVER suggest these): ${avoidActivities.join(', ')}`
    : '';

  const isFirstDay = dayNumber === 1;
  const isLastDay  = dayNumber === totalDays;

  const arrivalTime   = isFirstDay ? latestArrivalTime(profiles) : undefined;
  const departureTime = isLastDay  ? earliestDepartureTime(profiles) : undefined;

  let timeConstraint = '';
  if (arrivalTime) {
    timeConstraint += `\nARRIVAL CONSTRAINT: travelers arrive at ${arrivalTime}. No activities before ${arrivalTime}.`;
  }
  if (departureTime) {
    const [h, m] = departureTime.split(':').map(Number);
    const cutoffMin = h * 60 + m - 180;
    const cutoffH = Math.floor(cutoffMin / 60).toString().padStart(2, '0');
    const cutoffM = (cutoffMin % 60).toString().padStart(2, '0');
    timeConstraint += `\nDEPARTURE CONSTRAINT: departs at ${departureTime}. Last activity by ${cutoffH}:${cutoffM}. Final item = transport to airport.`;
  }

  // Inter-city travel clause — injected when city changes from previous day
  const cityChanged =
    prevCityAssignment?.city &&
    cityAssignment?.city &&
    prevCityAssignment.city !== cityAssignment.city;

  const travelClause = cityChanged
    ? `\nTRAVEL REQUIRED: Travelers move from ${prevCityAssignment!.city}, ${prevCityAssignment!.country} to ${cityAssignment!.city}, ${cityAssignment!.country} on this day.
THIS IS A SPLIT DAY: morning in ${prevCityAssignment!.city}, afternoon/evening in ${cityAssignment!.city}.
- Position 1 MUST be itemType="transport", title="[Mode]: ${prevCityAssignment!.city} → ${cityAssignment!.city}".
- Choose best mode: train if <600km (Eurostar/AVE/TGV/Thalys/Italo etc.), flight if >600km or no direct rail.
- Transport description MUST include: departure time, arrival time, total duration, estimated cost, and a booking tip (official site or app name).
- Realistic durationMin: train <600km = 90-240min, flight = 150-210min incl. airport time.
- After transport (position 2+): ONLY activities in ${cityAssignment!.city} (afternoon/evening). Label them "Tarde: [name]" or "Noche: [name]".
- Do NOT schedule activities in ${prevCityAssignment!.city} for this day — travelers will already be en route.`
    : '';

  const defaultStart = cityChanged ? '06:00' : (arrivalTime ?? '07:00');

  // City focus line — forces geographic coherence when plan wizard is used
  const cityLine = cityAssignment
    ? `\nCITY: Plan this ENTIRE day in ${cityAssignment.city}, ${cityAssignment.country} ${cityAssignment.flag}. Every location must be in ${cityAssignment.city}.`
    : '';

  const scheduleNote = cityChanged
    ? `Day starts with travel from ${prevCityAssignment!.city} to ${cityAssignment!.city}. After arriving, fit remaining activities (afternoon/evening only).`
    : isFirstDay && arrivalTime
    ? `Start at ${arrivalTime} (arrival day).`
    : isLastDay && departureTime
    ? `End activities before departure. Include airport transport.`
    : 'Full day: breakfast, morning activity, lunch, afternoon activity, dinner.';

  return `You are an expert travel planner. Output ONLY a JSON array of itinerary items for ONE specific day.

TRIP: ${trip.destination} | ${trip.startDate}→${trip.endDate} | ${totalDays} days
${trip.description ? `Notes: ${trip.description}` : ''}
TRAVELERS: ${profileContext}
DAY: ${dayNumber}/${totalDays} — ${dayDate}${cityLine}${travelClause}${avoidClause}${blacklistClause}${timeConstraint}

SCHEDULE: ${scheduleNote}

RULES:
- 7-10 items. Include meals, transports between locations, and main activities.
- Times in HH:MM format. No overlaps.
- Local currency: EUR for Europe, PEN for Peru, CLP for Chile, COP for Colombia, USD otherwise.
- Respect travelers' diet/allergies/pace from profiles.
- UNIQUENESS: Every locationName must be different from all others in this day AND different from the ALREADY USED list above. Choose different neighborhoods, areas, and venues — never repeat.
- Be specific: use real place names, real addresses, realistic prices and durations.
- For transport items: include departure/arrival times and booking tip in description.

Output ONLY this JSON array (no markdown, no explanation):
[{"position":1,"itemType":"transport","title":"...","description":"...","locationName":"...","address":"...","startTime":"${defaultStart}","endTime":"...","durationMin":60,"estimatedCost":0,"currency":"EUR","notes":"..."},...]`;
}

// ── OCI chat calls ───────────────────────────────────────────────────────────

export async function ociChat(message: string, maxTokens: number): Promise<string> {
  const requestBody = {
    compartmentId: OCI_CONFIG.tenancy,
    servingMode: { modelId: OCI_CONFIG.modelId, servingType: 'ON_DEMAND' },
    chatRequest: {
      apiFormat: 'COHERE',
      message,
      maxTokens,
      temperature: 0.15,
      frequencyPenalty: 0,
      presencePenalty: 0,
    },
  };
  const response = await ociPost('/20231130/actions/chat', requestBody) as {
    chatResponse?: { text?: string };
  };
  return response?.chatResponse?.text ?? '';
}


// ── Single-day AI call with repair + retry ────────────────────────────────────

async function generateDayItems(
  trip: TripDetails,
  profiles: ParticipantProfile[],
  dayDate: string,
  dayNumber: number,
  totalDays: number,
  visitedLocations: string[],
  cityAssignment?: CityAssignment,
  avoidActivities?: string[],
  prevCityAssignment?: CityAssignment,
): Promise<GeneratedItineraryItem[]> {
  const message = buildDayPrompt(trip, profiles, dayDate, dayNumber, totalDays, visitedLocations, cityAssignment, avoidActivities, prevCityAssignment);

  const tryParse = (raw: string, label: string): GeneratedItineraryItem[] | null => {
    const arrayMatch = raw.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return null;

    // First try: parse as-is
    try {
      const parsed = JSON.parse(arrayMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as GeneratedItineraryItem[];
    } catch { /* fall through to repair */ }

    // Second try: repair truncated JSON
    try {
      const repaired = repairJsonArray(arrayMatch[0]);
      const parsed = JSON.parse(repaired);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.warn(`[oci-ai] Day ${dayNumber} JSON repaired (${label}): recovered ${parsed.length} items`);
        return parsed as GeneratedItineraryItem[];
      }
    } catch { /* repair also failed */ }

    return null;
  };

  // Attempt 1: full prompt with 3500 tokens
  const rawText = await ociChat(message, 3500);
  if (rawText) {
    const items = tryParse(rawText, 'attempt-1');
    if (items) return items;
  }

  // Attempt 2: minimal prompt with 2000 tokens (fallback if model still truncates)
  console.warn(`[oci-ai] Day ${dayNumber} attempt 1 failed — retrying with minimal prompt`);
  const city = cityAssignment?.city ?? trip.destination;
  const minimalMessage = `Output a JSON array of 8 itinerary items for day ${dayNumber} (${dayDate}) in ${city}. itemType MUST be one of: meal, transport, activity, rest, accommodation, free_time. Include: meal 07:00, transport 08:00, activity 09:00, activity 11:30, meal 13:00, transport 14:30, activity 15:00, meal 20:00. Each item needs: position,itemType,title,description,locationName,startTime,endTime,durationMin,estimatedCost,currency. Use local currency. Output JSON array only, no other text:`;
  const rawText2 = await ociChat(minimalMessage, 2000);
  if (rawText2) {
    const items = tryParse(rawText2, 'attempt-2');
    if (items) return items;
  }

  throw new Error(`Day ${dayNumber} (${dayDate}): AI failed to produce valid JSON after 2 attempts`);
}

// ── Main export ─────────────────────────────────────────────────────────────

const GENERATION_BATCH_SIZE = 3;

export async function generateItinerary(
  tripDetails: TripDetails,
  participantProfiles: ParticipantProfile[],
  onDayComplete?: (day: GeneratedDay) => Promise<void>,
  cityAssignments?: CityAssignment[],
  skipDayNumbers?: Set<number>,
  avoidActivities?: string[],
): Promise<GeneratedItinerary> {
  const calendarDays = buildCalendarDays(tripDetails.startDate, tripDetails.endDate);
  const totalDays = calendarDays.length;

  const generatedDays: GeneratedDay[] = [];
  let runningCost = 0;
  const visitedLocations: string[] = [];

  // Generate days in parallel batches — skip locked day numbers entirely
  for (let batchStart = 0; batchStart < calendarDays.length; batchStart += GENERATION_BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + GENERATION_BATCH_SIZE, calendarDays.length);
    const batchVisited = [...visitedLocations];

    // Only include non-skipped days in this batch
    const batchIndices = [];
    for (let i = batchStart; i < batchEnd; i++) {
      if (!skipDayNumbers?.has(i + 1)) batchIndices.push(i);
    }

    if (batchIndices.length === 0) continue;

    const batchPromises = batchIndices.map((i) =>
      generateDayItems(
        tripDetails,
        participantProfiles,
        calendarDays[i],
        i + 1,
        totalDays,
        batchVisited,
        cityAssignments?.[i],
        avoidActivities,
        i > 0 ? cityAssignments?.[i - 1] : undefined,
      )
    );

    const batchResults = await Promise.all(batchPromises);

    for (let j = 0; j < batchResults.length; j++) {
      const i = batchIndices[j];
      const items = batchResults[j];
      const ca = cityAssignments?.[i];

      for (const item of items) {
        if (item.locationName) visitedLocations.push(item.locationName);
      }

      const dayCost = items.reduce((sum, item) => sum + (item.estimatedCost ?? 0), 0);
      runningCost += dayCost;

      const day: GeneratedDay = {
        dayNumber: i + 1,
        dayDate: calendarDays[i],
        city: ca?.city,
        country: ca?.country,
        flag: ca?.flag,
        items,
      };
      generatedDays.push(day);

      if (onDayComplete) {
        await onDayComplete(day);
      }
    }
  }

  const currency = generatedDays[0]?.items[0]?.currency ?? 'PEN';

  return {
    days: generatedDays,
    totalEstimatedCost: runningCost,
    currency,
    notes: `${totalDays}-day itinerary for ${tripDetails.destination}. Verify bookings and opening hours before travel.`,
  };
}

// ── Per-item AI suggestion ────────────────────────────────────────────────────

export async function suggestItemAlternative(
  item: {
    itemType: string;
    title: string;
    description: string | null;
    locationName: string | null;
    startTime: string | null;
    endTime: string | null;
    estimatedCost: number | null;
    currency: string;
  },
  context: {
    destination: string;
    dayNumber: number;
    totalDays: number;
    prevTitle?: string;
    nextTitle?: string;
  },
): Promise<ItemSuggestion> {
  const timeSlot = item.startTime && item.endTime
    ? `${item.startTime}–${item.endTime}`
    : item.startTime ?? 'any time';

  const surroundingCtx = [
    context.prevTitle ? `Before: ${context.prevTitle}` : '',
    context.nextTitle ? `After: ${context.nextTitle}` : '',
  ].filter(Boolean).join('. ');

  const message = `Suggest ONE alternative ${item.itemType} to replace this item in a trip itinerary.

CURRENT ITEM:
- Title: ${item.title}
- Location: ${item.locationName ?? 'unspecified'}
- Time slot: ${timeSlot} on Day ${context.dayNumber}/${context.totalDays}
- Description: ${item.description ?? 'none'}
- Cost: ${item.estimatedCost ?? 0} ${item.currency}
${surroundingCtx ? `- Context: ${surroundingCtx}` : ''}

DESTINATION: ${context.destination}

REQUIREMENTS:
- Keep the same time slot
- Keep the same item type (${item.itemType})
- Suggest something DIFFERENT from the current option
- Use the same currency (${item.currency})
- Be specific: real place name, realistic cost

Respond ONLY with a JSON object:
{"title":"...","description":"...","locationName":"...","address":"...","estimatedCost":0,"notes":"..."}`;

  const raw = await ociChat(message, 600);
  if (!raw) throw new Error('Empty AI response for suggestion');

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI suggestion has no JSON object');

  const parsed = JSON.parse(match[0]) as ItemSuggestion;
  return parsed;
}

// ── Planning agent types + function ──────────────────────────────────────────

export interface AgentTripContext {
  destination: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  flightStatus: string;
  outboundDate?: string | null;
  returnDate?: string | null;
  outboundFlight?: string | null;
  returnFlight?: string | null;
  tripNotes?: string | null;
}

export interface AgentResponsePayload {
  type: 'question' | 'proposal' | 'message';
  content: string;
  proposal?: {
    summary: string;
    cityAssignments: Array<{ day: number; city: string; country: string; flag: string }>;
    highlights: string[];
  };
}

// ── Proposal normalizer ──────────────────────────────────────────────────────
// Collapses A→B(1d)→A backtrack patterns and merges split same-city blocks.
// Runs after AI output so display is always clean regardless of model behavior.

type RawAssignment = { day: number; city: string; country: string; flag: string };

function normalizeAssignments(raw: RawAssignment[]): RawAssignment[] {
  if (!raw.length) return raw;

  // Step 1: build [{city,country,flag,days}] groups (merge consecutive same-city)
  const groups: Array<{ city: string; country: string; flag: string; days: number }> = [];
  for (const a of raw) {
    const last = groups[groups.length - 1];
    if (last && last.city === a.city && last.country === a.country) {
      last.days++;
    } else {
      groups.push({ city: a.city, country: a.country, flag: a.flag, days: 1 });
    }
  }

  // Step 2: collapse A→B(1d)→A patterns (day trips that created backtracking)
  // Repeat until no more changes (handles chains like A→B→A→C→A→D)
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 1; i < groups.length - 1; i++) {
      const prev = groups[i - 1];
      const curr = groups[i];
      const next = groups[i + 1];
      if (
        curr.days === 1 &&
        prev.city === next.city &&
        prev.country === next.country
      ) {
        // Absorb: day trip city (curr) + return leg (next) fold into prev
        prev.days += next.days + 1;
        groups.splice(i, 2);
        changed = true;
        break;
      }
    }
  }

  // Step 3: also collapse any remaining non-consecutive same-city duplicates
  // (e.g. Madrid 2d → Valencia 1d → Madrid 1d: rare but model does it)
  // Strategy: if two groups share the same city and are separated only by
  // a single 1-day group, treat the middle one as a day trip too.
  // (Already handled by the loop above — additional pass for safety)

  // Step 4: rebuild with sequential day numbers
  const result: RawAssignment[] = [];
  let dayNum = 1;
  for (const g of groups) {
    for (let d = 0; d < g.days; d++) {
      result.push({ day: dayNum++, city: g.city, country: g.country, flag: g.flag });
    }
  }
  return result;
}

function buildFlightInfo(ctx: AgentTripContext): string {
  if (ctx.flightStatus === 'booked') {
    const lines = ['Flights already purchased.'];
    if (ctx.outboundDate) lines.push(`Outbound: ${ctx.outboundDate}${ctx.outboundFlight ? ` — ${ctx.outboundFlight}` : ''}`);
    if (ctx.returnDate)   lines.push(`Return: ${ctx.returnDate}${ctx.returnFlight ? ` — ${ctx.returnFlight}` : ''}`);
    return lines.join(' ');
  }
  if (ctx.flightStatus === 'tentative') {
    return `Tentative dates — outbound around ${ctx.outboundDate ?? ctx.startDate}, return around ${ctx.returnDate ?? ctx.endDate}. Flights not yet purchased.`;
  }
  return 'No flights purchased yet. Dates are flexible within the trip window.';
}

export async function runPlanningAgent(
  context: AgentTripContext,
  profiles: ParticipantProfile[],
  history: Array<{ role: 'user' | 'agent'; content: string }>,
  userMessage: string,
): Promise<AgentResponsePayload> {
  const profileSummary = profiles.map((p, i) => {
    const parts: string[] = [`- Viajero ${i + 1} (${p.name}):`];
    if (p.travelPace)        parts.push(`ritmo=${p.travelPace}`);
    if (p.budgetRange)       parts.push(`presupuesto=${p.budgetRange}`);
    if (p.dietType)          parts.push(`dieta=${p.dietType}`);
    if (p.foodAllergies)     parts.push(`alergias=${p.foodAllergies}`);
    if (p.interests?.length) parts.push(`intereses=${p.interests.join(', ')}`);
    if (p.mobilityNeeds)     parts.push(`movilidad=${p.mobilityNeeds}`);
    if (p.specialRequests)   parts.push(`solicitudes=${p.specialRequests}`);
    return parts.join(' ');
  }).join('\n');

  // Build conversation history as readable text
  const historyText = history.map((msg) => {
    if (msg.role === 'user') return `USUARIO: ${msg.content}`;
    try {
      const parsed = JSON.parse(msg.content) as AgentResponsePayload;
      return `AGENTE: ${parsed.content}`;
    } catch {
      return `AGENTE: ${msg.content}`;
    }
  }).join('\n');

  // Count how many questions the agent has already asked
  const agentQuestionCount = history.filter((h) => {
    if (h.role !== 'agent') return false;
    try { return (JSON.parse(h.content) as { type: string }).type === 'question'; }
    catch { return false; }
  }).length;

  const prompt = `Eres un agente experto en planificación de viajes. Tu misión: entender qué necesita este grupo y proponer un plan de ruta con ciudades concretas día a día.

=== DATOS DEL VIAJE ===
Destino/región: ${context.destination}
Fechas: ${context.startDate} → ${context.endDate} (${context.totalDays} días)
Vuelos: ${buildFlightInfo(context)}
Visión del líder: ${context.tripNotes || 'No especificada'}

=== PERFILES DE VIAJEROS (ya conocidos — NO preguntes sobre esto) ===
${profileSummary || 'Sin perfiles completos aún.'}

=== HISTORIAL DE CONVERSACIÓN ===
${historyText || '(inicio de conversación — saluda brevemente y haz tu primera pregunta)'}

=== MENSAJE DEL USUARIO ===
USUARIO: ${userMessage}

=== INSTRUCCIONES ===
1. NO preguntes sobre ritmo, presupuesto, dieta ni alergias — ya están en los perfiles.
2. NO repitas preguntas que ya hiciste — revisa el historial. Cada pregunta debe ser sobre un tema NUEVO.
3. Preguntas hechas hasta ahora: ${agentQuestionCount}. Límite: 2 preguntas. Si ya hiciste 2 o más, ve directo a la propuesta.
4. Si el usuario ya menciona destinos o ciudades concretas, ve DIRECTO a la propuesta sin más preguntas.
5. Cada pregunta debe ser concisa, en español, y enfocada en la ruta (zonas a visitar, must-sees, ciudades a evitar).

RESPONDE SOLO con uno de estos JSON (sin texto extra):

Para hacer UNA pregunta:
{"type":"question","content":"<pregunta concisa en español>"}

Para proponer el plan:
{"type":"proposal","content":"<explicación amigable en español, 1-2 frases>","proposal":{"summary":"<resumen de la ruta en 1 frase>","cityAssignments":[{"day":1,"city":"Madrid","country":"España","flag":"🇪🇸"},{"day":2,"city":"Madrid","country":"España","flag":"🇪🇸"}],"highlights":["<dato interesante específico>","<otro>","<otro>"]}}

REGLAS CRÍTICAS para cityAssignments:
- EXACTAMENTE ${context.totalDays} objetos, días 1 al ${context.totalDays}
- Días consecutivos en la misma ciudad SIEMPRE agrupados (nunca divididos)
- Ciudades ordenadas geográficamente para minimizar backtracking
- Para viajes largos: planifica traslados realistas (tren <600km, vuelo >600km)
- Si hay vuelos reservados, respeta ciudad de llegada (día 1) y de salida (último día)
- 3-5 highlights específicos y concretos (no genéricos como "gran cultura")

PROHIBICIONES ABSOLUTAS (causan error grave):
❌ NUNCA listes la misma ciudad en dos bloques no consecutivos. Ejemplo INCORRECTO: Madrid(1d)→Toledo(1d)→Madrid(1d). Ejemplo CORRECTO: Madrid(2d)→Toledo(1d) o Madrid(3d).
❌ NUNCA crees rutas de ida y vuelta: el patrón A→B→A siempre está PROHIBIDO.
❌ NUNCA asignes como ciudad separada lo que es una excursión de día desde otra ciudad.

EXCURSIONES DE DÍA — NO necesitan entrada propia en cityAssignments:
Las siguientes ciudades son excursiones (<2h desde su ciudad base). Si el usuario las pide, agrega 1 día extra a la ciudad base y menciona la excursión en highlights:
- Toledo (45min de Madrid), Segovia (1h de Madrid)
- Oxford (1h de Londres), Windsor (30min de Londres)
- Versalles (40min de París), Giverny (1.5h de París)
- Pisa (1h de Florencia), Cinque Terre (1h de La Spezia)
- Brujas (1h de Bruselas), Gante (30min de Bruselas)
- Dachau (1h de Múnich), Neuschwanstein (2h de Múnich)

MANEJO DE RESTRICCIONES DEL USUARIO (MUY IMPORTANTE):
- Si el usuario dice "solo pasar por", "de paso", "tránsito" → asigna EXACTAMENTE 1 día a esa ciudad.
- Si el usuario dice "es muy caro" o "no quiero gastar ahí" → minimiza días en ese país (1 día máximo).
- Si el usuario pide explícitamente "X días en Y" → usa EXACTAMENTE ese número, ni más ni menos.
- Si el usuario pide reducir días en un país → reduce esos días y redistribuye en otros países.
- Cada día en cityAssignments = 1 noche de alojamiento. No ignores restricciones de coste.

JSON:`;

  const raw = await ociChat(prompt, 2500);

  // Parse the JSON response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const cleaned = jsonMatch[0]
        .replace(/\}\s*\{/g, '},{')
        .replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(cleaned) as AgentResponsePayload;
      if (parsed.type && parsed.content) {
        // Normalize proposal to remove A→B→A backtracking and split cities
        if (parsed.type === 'proposal' && parsed.proposal?.cityAssignments) {
          parsed.proposal.cityAssignments = normalizeAssignments(
            parsed.proposal.cityAssignments
          );
        }
        return parsed;
      }
    } catch {
      // fall through to plain message
    }
  }

  return { type: 'message', content: raw || 'Lo siento, hubo un problema. Inténtalo de nuevo.' };
}

// ── Planning wizard functions (legacy — kept for reference) ───────────────────

export async function generatePlanningQuestions(
  destination: string,
  totalDays: number,
): Promise<PlanningQuestion[]> {
  const message = `You are a travel planner. A traveler is planning a ${totalDays}-day trip to ${destination}.
Generate 4 concise questions to better understand their preferences so you can propose ideal countries/regions and cities.
Focus on: travel style, must-see experiences, activity level, cultural vs nature preference, budget comfort zone.

Output ONLY a JSON array (no markdown, no explanation):
[{"id":"q1","question":"...","type":"single","options":["...","...","...","..."]},...]

Rules:
- "type" must be "single" (pick one), "multiple" (pick many), or "text" (free text, no options key)
- 3 single/multiple questions + 1 text question
- options: 3-4 choices each, short phrases, no bullets
- Respond in Spanish
- JSON only, no extra text`;

  const raw = await ociChat(message, 1200);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('[generatePlanningQuestions] raw response:', raw.slice(0, 400));
    throw new Error('No JSON array in planning questions response');
  }
  try {
    return JSON.parse(repairJsonArray(match[0])) as PlanningQuestion[];
  } catch (e) {
    console.error('[generatePlanningQuestions] parse error on repaired JSON:', repairJsonArray(match[0]).slice(0, 400));
    throw e;
  }
}

export async function proposeDestinations(
  destination: string,
  totalDays: number,
  answers: Record<string, string | string[]>,
): Promise<ProposedDestination[]> {
  const answersText = Object.entries(answers)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  const message = `You are a travel planner. A traveler wants to explore ${destination} for ${totalDays} days.

Their answers:
${answersText}

Propose 3-6 countries/regions within ${destination} to visit, considering travel distance and the total duration.
Allocated days must sum to exactly ${totalDays}.
Order them geographically to minimize backtracking.

Output ONLY a JSON array (no markdown):
[{"country":"Spain","flag":"🇪🇸","description":"one sentence hook","highlights":["...","...","..."],"recommendedDays":7},...]
JSON only, respond country names in the traveler's language (Spanish):`;

  const raw = await ociChat(message, 1500);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in destinations response');
  return JSON.parse(repairJsonArray(match[0])) as ProposedDestination[];
}

export async function proposeCities(
  selectedDestinations: { country: string; flag: string; days: number }[],
): Promise<CityGroup[]> {
  const destList = selectedDestinations
    .map((d) => `${d.flag} ${d.country}: ${d.days} days`)
    .join('\n');

  const message = `You are a travel planner. For each destination below, propose the best cities/areas to visit.
Order cities geographically to minimize travel. Recommend days proportional to city importance.

${destList}

Output ONLY a JSON array (no markdown):
[{"country":"Spain","flag":"🇪🇸","cities":[{"name":"Madrid","description":"capital vibrante con arte de clase mundial","recommendedDays":3,"mustSee":["Museo del Prado","Palacio Real","Retiro"]},{"name":"Barcelona","description":"...","recommendedDays":4,"mustSee":["Sagrada Família","Gothic Quarter","Park Güell"]}]}]
JSON only, names and descriptions in Spanish:`;

  const raw = await ociChat(message, 2000);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('No JSON array in cities response');
  return JSON.parse(repairJsonArray(match[0])) as CityGroup[];
}
