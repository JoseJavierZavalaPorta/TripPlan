// src/app/api/trips/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById, isParticipant, updateTrip, deleteTrip } from '@/lib/repositories/tripRepo';

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
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    const hasAccess =
      trip.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin acceso a este viaje' }, { status: 403 });
    }

    return NextResponse.json({ data: trip });
  } catch (err) {
    console.error('[GET /api/trips/[id]]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

const UpdateTripSchema = z.object({
  flightStatus: z.enum(['none', 'tentative', 'booked']).optional(),
  outboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  outboundFlight: z.string().max(200).nullable().optional(),
  returnFlight: z.string().max(200).nullable().optional(),
  tripNotes: z.string().max(3000).nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede editar el viaje' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = UpdateTripSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    await updateTrip(params.id, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error('[PATCH /api/trips/[id]]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }

    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede eliminar el viaje' }, { status: 403 });
    }

    await deleteTrip(params.id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    console.error('[DELETE /api/trips/[id]]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
