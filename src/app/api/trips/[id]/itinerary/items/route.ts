// POST /api/trips/[id]/itinerary/items — manually insert an activity at a given position
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { insertItineraryItem, getItineraryItemById } from '@/lib/repositories/itineraryRepo';

const InsertSchema = z.object({
  dayId:         z.string().min(1),
  position:      z.number().int().positive(),
  itemType:      z.enum(['activity', 'meal', 'transport', 'rest', 'accommodation', 'free_time']),
  title:         z.string().min(1).max(300),
  description:   z.string().max(2000).optional(),
  locationName:  z.string().max(300).optional(),
  locationLat:   z.number().nullable().optional(),
  locationLng:   z.number().nullable().optional(),
  address:       z.string().max(500).optional(),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime:       z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMin:   z.number().int().positive().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  currency:      z.string().max(3).optional(),
  notes:         z.string().max(2000).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede añadir actividades' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = InsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { dayId, ...itemData } = parsed.data;
    const newId = await insertItineraryItem({ dayId, tripId: params.id, ...itemData });
    const item = await getItineraryItemById(newId);

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips/[id]/itinerary/items]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
