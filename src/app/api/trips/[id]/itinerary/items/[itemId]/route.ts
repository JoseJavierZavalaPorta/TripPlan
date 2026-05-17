// PATCH /api/trips/[id]/itinerary/items/[itemId] — leader can edit any item directly
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { getItineraryItemById, updateItineraryItem } from '@/lib/repositories/itineraryRepo';

const EditSchema = z.object({
  title:         z.string().min(1).max(300).optional(),
  description:   z.string().max(2000).nullable().optional(),
  locationName:  z.string().max(300).nullable().optional(),
  address:       z.string().max(500).nullable().optional(),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime:       z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  durationMin:   z.number().int().positive().nullable().optional(),
  estimatedCost: z.number().nonnegative().nullable().optional(),
  notes:         z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede editar directamente' }, { status: 403 });
    }

    const item = await getItineraryItemById(params.itemId);
    if (!item || item.tripId !== params.id) {
      return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 });
    }

    const body: unknown = await req.json();
    const parsed = EditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    await updateItineraryItem(params.itemId, parsed.data);
    const updated = await getItineraryItemById(params.itemId);

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH /api/trips/[id]/itinerary/items/[itemId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
