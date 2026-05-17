// src/app/api/trips/[id]/votes/[vid]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isParticipant, getTripById } from '@/lib/repositories/tripRepo';
import { respondToVote } from '@/lib/repositories/voteRepo';

const RespondSchema = z.object({
  response: z.enum(['yes', 'no', 'abstain']),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; vid: string } }
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

    const body: unknown = await req.json();
    const parsed = RespondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    await respondToVote({
      voteId: params.vid,
      userId: session.user.id,
      response: parsed.data.response,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error('[POST /api/trips/[id]/votes/[vid]]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
