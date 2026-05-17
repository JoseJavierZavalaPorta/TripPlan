// PATCH /api/trips/[id]/participants/[userId] — leader toggles can_edit
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById, updateParticipantPermission } from '@/lib/repositories/tripRepo';

const Schema = z.object({ canEdit: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede cambiar permisos' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    await updateParticipantPermission(params.id, params.userId, parsed.data.canEdit);
    return NextResponse.json({ data: { canEdit: parsed.data.canEdit } });
  } catch (err) {
    console.error('[PATCH /participants/[userId]]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
