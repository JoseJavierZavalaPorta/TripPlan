// src/app/api/trips/[id]/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isParticipant, getTripById } from '@/lib/repositories/tripRepo';
import { getTravelerProfile, upsertTravelerProfile } from '@/lib/repositories/profileRepo';

const ProfileSchema = z.object({
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  arrivalTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  departureTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  dietType: z
    .enum(['omnivore', 'vegetarian', 'vegan', 'pescatarian', 'halal', 'kosher', 'other'])
    .optional()
    .nullable(),
  foodAllergies: z.string().max(500).optional().nullable(),
  cuisinePrefs: z.string().max(500).optional().nullable(),
  mobilityNeeds: z.string().max(500).optional().nullable(),
  visualNeeds: z.string().max(500).optional().nullable(),
  hearingNeeds: z.string().max(500).optional().nullable(),
  otherAccessibility: z.string().max(500).optional().nullable(),
  travelPace: z.enum(['slow', 'moderate', 'fast']).optional().nullable(),
  interests: z.array(z.string()).max(20).optional(),
  budgetRange: z.enum(['budget', 'mid', 'luxury']).optional().nullable(),
  specialRequests: z.string().max(5000).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const profile = await getTravelerProfile(params.id, session.user.id);
    return NextResponse.json({ data: profile });
  } catch (err) {
    console.error('[GET /api/trips/[id]/profile]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Must be participant or leader
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

    const body: unknown = await req.json();
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    await upsertTravelerProfile(params.id, session.user.id, parsed.data);
    const profile = await getTravelerProfile(params.id, session.user.id);

    return NextResponse.json({ data: profile });
  } catch (err) {
    console.error('[POST /api/trips/[id]/profile]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
