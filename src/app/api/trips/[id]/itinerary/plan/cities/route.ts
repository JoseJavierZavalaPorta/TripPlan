// POST /api/trips/[id]/itinerary/plan/cities — AI city proposals per destination
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { proposeCities } from '@/lib/oci-ai';

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

    const body = await req.json() as {
      selectedDestinations?: { country: string; flag: string; days: number }[];
    };
    if (!body.selectedDestinations?.length) {
      return NextResponse.json({ error: 'Selecciona al menos un destino' }, { status: 400 });
    }

    const cityGroups = await proposeCities(body.selectedDestinations);
    return NextResponse.json({ data: cityGroups });
  } catch (err) {
    console.error('[POST plan/cities]', err);
    return NextResponse.json({ error: 'Error al proponer ciudades' }, { status: 500 });
  }
}
