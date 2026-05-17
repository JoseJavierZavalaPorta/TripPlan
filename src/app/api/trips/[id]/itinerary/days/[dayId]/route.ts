// PATCH /api/trips/[id]/itinerary/days/[dayId] — toggle locked state (leader only)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { toggleDayLock } from '@/lib/repositories/itineraryRepo';

const Schema = z.object({
  locked: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; dayId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede bloquear días' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    await toggleDayLock(params.dayId, parsed.data.locked);
    return NextResponse.json({ data: { locked: parsed.data.locked } });
  } catch (err) {
    console.error('[PATCH /api/trips/[id]/itinerary/days/[dayId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
