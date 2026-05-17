// src/app/api/trips/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripsByUser, createTrip } from '@/lib/repositories/tripRepo';

const CreateTripSchema = z.object({
  title: z.string().min(2, 'Título muy corto').max(200),
  destination: z.string().min(2, 'Destino requerido').max(300),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  description: z.string().max(2000).optional(),
  destinationLat: z.number().min(-90).max(90).optional(),
  destinationLng: z.number().min(-180).max(180).optional(),
  flightStatus: z.enum(['none', 'tentative', 'booked']).optional(),
  outboundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  outboundFlight: z.string().max(200).optional(),
  returnFlight: z.string().max(200).optional(),
  tripNotes: z.string().max(3000).optional(),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trips = await getTripsByUser(session.user.id);
    return NextResponse.json({ data: trips });
  } catch (err) {
    console.error('[GET /api/trips]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const body: unknown = await req.json();
    const parsed = CreateTripSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { startDate, endDate } = parsed.data;
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: 'La fecha de inicio debe ser anterior a la fecha de fin' },
        { status: 400 }
      );
    }

    const tripId = await createTrip({
      ...parsed.data,
      leaderId: session.user.id,
    });

    return NextResponse.json({ data: { id: tripId } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
