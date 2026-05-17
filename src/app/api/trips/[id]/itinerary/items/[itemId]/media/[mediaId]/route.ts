// DELETE /api/trips/[id]/itinerary/items/[itemId]/media/[mediaId]
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { deleteItemMedia, getItemMedia } from '@/lib/repositories/mediaRepo';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string; mediaId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const deleted = await deleteItemMedia(params.mediaId, session.user.id);
    if (!deleted) return NextResponse.json({ error: 'No encontrado o sin permiso' }, { status: 404 });

    const media = await getItemMedia(params.itemId);
    return NextResponse.json({ data: media });
  } catch (err) {
    console.error('[DELETE /api/.../media/[mediaId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
