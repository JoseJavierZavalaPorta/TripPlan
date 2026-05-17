// src/app/api/trips/[id]/votes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { isParticipant, getTripById } from '@/lib/repositories/tripRepo';
import { getVotesByTrip, getOpenVotesForTrip, createVote } from '@/lib/repositories/voteRepo';

const CreateVoteSchema = z.object({
  itemId: z.string().min(1).optional(),   // null/absent for 'add' proposals
  actionType: z.enum(['add', 'remove', 'replace']),
  replacementData: z.unknown().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    const hasAccess =
      trip?.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    // ?open=1 returns only open votes (used by the day view)
    const openOnly = req.nextUrl.searchParams.get('open') === '1';
    const votes = openOnly
      ? await getOpenVotesForTrip(params.id)
      : await getVotesByTrip(params.id);

    return NextResponse.json({ data: votes });
  } catch (err) {
    console.error('[GET /api/trips/[id]/votes]', err);
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

    const hasAccess =
      (await getTripById(params.id))?.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = CreateVoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const voteId = await createVote({
      tripId: params.id,
      itemId: parsed.data.itemId ?? null,
      actionType: parsed.data.actionType,
      proposedBy: session.user.id,
      replacementData: parsed.data.replacementData,
    });

    return NextResponse.json({ data: { id: voteId } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/trips/[id]/votes]', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
