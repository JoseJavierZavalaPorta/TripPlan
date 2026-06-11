// GET /api/trips/[id]/media — all media for the trip (album view)
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById, isParticipant } from '@/lib/repositories/tripRepo';
import { getTripAlbum } from '@/lib/repositories/mediaRepo';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const hasAccess =
      trip.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));
    if (!hasAccess) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const album = await getTripAlbum(params.id);
    return NextResponse.json({ data: album });
  } catch (err) {
    console.error('[GET /api/trips/[id]/media]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
