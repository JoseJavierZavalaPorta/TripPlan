// POST /api/trips/[id]/itinerary/items/[itemId]/compatibility
// AI analysis of how compatible an activity is with the current user's dietary/accessibility profile
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getItineraryItemById } from '@/lib/repositories/itineraryRepo';
import { getTravelerProfile } from '@/lib/repositories/profileRepo';
import { isParticipant } from '@/lib/repositories/tripRepo';
import { ociChat } from '@/lib/oci-ai';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const tripId = params.id;
  const userId = session.user.id;

  const hasAccess = await isParticipant(tripId, userId);
  if (!hasAccess) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

  const [item, profile] = await Promise.all([
    getItineraryItemById(params.itemId),
    getTravelerProfile(tripId, userId),
  ]);

  if (!item) return NextResponse.json({ error: 'Actividad no encontrada' }, { status: 404 });
  if (!profile) return NextResponse.json({ error: 'Sin perfil — completa tu perfil de viajero primero' }, { status: 400 });

  const needsList: string[] = [];
  if (profile.dietType && profile.dietType !== 'omnivore') needsList.push(`Dieta: ${profile.dietType}`);
  if (profile.foodAllergies) needsList.push(`Alergias/intolerancias: ${profile.foodAllergies}`);
  if (profile.mobilityNeeds) needsList.push(`Movilidad: ${profile.mobilityNeeds}`);
  if (profile.visualNeeds) needsList.push(`Visual: ${profile.visualNeeds}`);
  if (profile.hearingNeeds) needsList.push(`Audición: ${profile.hearingNeeds}`);
  if (profile.otherAccessibility) needsList.push(`Otro: ${profile.otherAccessibility}`);

  if (needsList.length === 0) {
    return NextResponse.json({ data: { level: 'green', summary: 'Sin restricciones especiales — compatible.' } });
  }

  const prompt = `A traveler has these specific needs: ${needsList.join(' | ')}.

Activity: "${item.title}" (type: ${item.itemType})
${item.description ? `Description: ${item.description}` : ''}
${item.locationName ? `Location: ${item.locationName}` : ''}

Analyze compatibility for this specific traveler. Be concise and practical.
- For meals/restaurants: mention what they can order or if the restaurant accommodates their diet/allergies.
- For activities/transport: mention accessibility concerns (stairs, walking distance, noise, visual elements).
- If uncertain, say so honestly.

Respond ONLY with valid JSON (no markdown, no explanation):
{"level":"green","summary":"<1-2 sentences in Spanish>"}

Level options:
- "green" = fully compatible or no concerns
- "yellow" = partially compatible or uncertain — extra check recommended
- "red" = likely incompatible — explain why and suggest what to do

JSON only:`;

  try {
    const raw = await ociChat(prompt, 250);
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) throw new Error('No JSON in response');
    const parsed = JSON.parse(match[0]) as { level: 'green' | 'yellow' | 'red'; summary: string };
    if (!['green', 'yellow', 'red'].includes(parsed.level)) throw new Error('Invalid level');
    return NextResponse.json({ data: parsed });
  } catch {
    return NextResponse.json({ error: 'No se pudo analizar la compatibilidad' }, { status: 500 });
  }
}
