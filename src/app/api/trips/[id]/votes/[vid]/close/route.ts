// POST /api/trips/[id]/votes/[vid]/close — leader closes a vote (approve or reject)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { closeVote, getVotesByTrip } from '@/lib/repositories/voteRepo';
import { insertItineraryItem, getItineraryItemById } from '@/lib/repositories/itineraryRepo';
import { addToBlacklist } from '@/lib/repositories/blacklistRepo';
import { execute } from '@/lib/db-helpers';
import { hexToBuffer } from '@/lib/db';
import { ItineraryItem } from '@/types';

const Schema = z.object({ outcome: z.enum(['approved', 'rejected']) });

// Shape of replacement_data for 'add' proposals
interface AddProposalData {
  dayId: string;
  position: number;
  itemType: ItineraryItem['itemType'];
  title: string;
  description?: string;
  locationName?: string;
  locationLat?: number | null;
  locationLng?: number | null;
  address?: string;
  startTime?: string;
  endTime?: string;
  durationMin?: number;
  estimatedCost?: number;
  currency?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; vid: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede cerrar votaciones' }, { status: 403 });
    }

    const body: unknown = await req.json();
    const parsed = Schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

    const { outcome } = parsed.data;

    // Fetch the vote
    const votes = await getVotesByTrip(params.id);
    const vote = votes.find(v => v.id === params.vid);
    if (!vote) return NextResponse.json({ error: 'Votación no encontrada' }, { status: 404 });
    if (vote.status !== 'open') return NextResponse.json({ error: 'La votación ya está cerrada' }, { status: 409 });

    // Apply outcome
    if (vote.actionType === 'add' && outcome === 'approved') {
      const data = vote.replacementData as AddProposalData | null;
      if (data?.dayId && data.title) {
        await insertItineraryItem({
          dayId: data.dayId,
          tripId: params.id,
          position: data.position,
          itemType: data.itemType,
          title: data.title,
          description: data.description,
          locationName: data.locationName,
          locationLat: data.locationLat ?? null,
          locationLng: data.locationLng ?? null,
          address: data.address,
          startTime: data.startTime,
          endTime: data.endTime,
          durationMin: data.durationMin,
          estimatedCost: data.estimatedCost,
          currency: data.currency,
        });
      }
    } else if (vote.actionType === 'add' && outcome === 'rejected') {
      // Blacklist the proposed title so the AI won't suggest it again
      const data = vote.replacementData as AddProposalData | null;
      if (data?.title) await addToBlacklist(params.id, data.title);
    } else if (vote.actionType === 'remove' && outcome === 'approved') {
      // Delete the item and blacklist its title
      if (vote.itemId) {
        const item = await getItineraryItemById(vote.itemId);
        if (item) await addToBlacklist(params.id, item.title);
        await execute(
          `DELETE FROM itinerary_items WHERE id = :id`,
          { id: hexToBuffer(vote.itemId) }
        );
      }
    }

    await closeVote(params.vid, outcome);

    return NextResponse.json({ data: { outcome } });
  } catch (err) {
    console.error('[POST /votes/[vid]/close]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
