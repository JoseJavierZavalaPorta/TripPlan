// GET /api/invite?token= — validate invite token
// POST /api/invite — register (if new user) + join trip via token
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import {
  getInvitationByToken,
  acceptInvitation,
  getTripById,
  addParticipant,
  updateParticipantStatus,
  isParticipant,
} from '@/lib/repositories/tripRepo';
import { getUserByEmail, createUser } from '@/lib/repositories/userRepo';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const inv = await getInvitationByToken(token);
  if (!inv) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });
  if (inv.status !== 'pending') return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 });
  if (new Date(inv.expiresAt) < new Date()) return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 });

  const trip = await getTripById(inv.tripId);
  const userExists = !!(await getUserByEmail(inv.email));

  return NextResponse.json({
    data: {
      email: inv.email,
      tripId: inv.tripId,
      tripTitle: trip?.title ?? '',
      userExists,
    },
  });
}

const JoinSchema = z.object({
  token:    z.string().min(1),
  name:     z.string().min(1).max(200).optional(),
  password: z.string().min(6).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const parsed = JoinSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { token, name, password } = parsed.data;

    const inv = await getInvitationByToken(token);
    if (!inv) return NextResponse.json({ error: 'Enlace inválido' }, { status: 404 });
    if (inv.status !== 'pending') return NextResponse.json({ error: 'Este enlace ya fue usado' }, { status: 410 });
    if (new Date(inv.expiresAt) < new Date()) return NextResponse.json({ error: 'Enlace expirado' }, { status: 410 });

    let user = await getUserByEmail(inv.email);

    if (!user) {
      // New user: name + password required
      if (!name || !password) {
        return NextResponse.json({ error: 'Nombre y contraseña requeridos' }, { status: 400 });
      }
      const hash = await bcrypt.hash(password, 12);
      await createUser({ name, email: inv.email, passwordHash: hash });
      user = await getUserByEmail(inv.email);
    }

    if (!user) return NextResponse.json({ error: 'Error al crear cuenta' }, { status: 500 });

    // Add to trip if not already a participant
    const alreadyIn = await isParticipant(inv.tripId, user.id);
    if (!alreadyIn) {
      await addParticipant({ tripId: inv.tripId, userId: user.id });
    }
    await updateParticipantStatus(inv.tripId, user.id, 'accepted');
    await acceptInvitation(token);

    return NextResponse.json({ data: { tripId: inv.tripId, email: inv.email } });
  } catch (err) {
    console.error('[POST /api/invite]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
