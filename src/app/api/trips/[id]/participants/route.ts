// src/app/api/trips/[id]/participants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { auth } from '@/auth';
import {
  getTripById,
  getTripParticipants,
  addParticipant,
  isParticipant,
  createInvitation,
} from '@/lib/repositories/tripRepo';
import { getUserByEmail } from '@/lib/repositories/userRepo';

const InviteSchema = z.object({
  email: z.string().email('Email inválido'),
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

    const hasAccess =
      (await getTripById(params.id))?.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const participants = await getTripParticipants(params.id);
    return NextResponse.json({ data: participants });
  } catch (err) {
    console.error('[GET /api/trips/[id]/participants]', err);
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

    // Only leaders can invite
    const trip = await getTripById(params.id);
    if (!trip) {
      return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    }
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede invitar participantes' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = InviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const { email } = parsed.data;

    // If user exists in system, add them directly as pending participant
    const existingUser = await getUserByEmail(email);
    const token = crypto.randomBytes(32).toString('hex');

    await createInvitation({
      tripId: params.id,
      invitedBy: session.user.id,
      email,
      token,
    });

    if (existingUser) {
      const alreadyIn = await isParticipant(params.id, existingUser.id);
      if (!alreadyIn) {
        await addParticipant({ tripId: params.id, userId: existingUser.id });
      }
    }

    const inviteUrl = `${process.env.NEXTAUTH_URL}/trips/join?token=${token}`;

    return NextResponse.json({
      data: {
        invited: true,
        userExists: !!existingUser,
        inviteUrl,
      },
    }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips/[id]/participants]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
