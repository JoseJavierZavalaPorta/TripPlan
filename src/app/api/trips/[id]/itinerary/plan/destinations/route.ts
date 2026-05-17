// POST /api/trips/[id]/itinerary/plan/destinations — AI destination proposals
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { proposeDestinations } from '@/lib/oci-ai';

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
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const body = await req.json() as { answers?: Record<string, string | string[]> };
    const answers = body.answers ?? {};

    const start = new Date(trip.startDate + 'T00:00:00Z');
    const end   = new Date(trip.endDate   + 'T00:00:00Z');
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    const destinations = await proposeDestinations(trip.destination, totalDays, answers);
    return NextResponse.json({ data: destinations });
  } catch (err) {
    console.error('[POST plan/destinations]', err);
    return NextResponse.json({ error: 'Error al proponer destinos' }, { status: 500 });
  }
}
