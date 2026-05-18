// GET /api/trips/[id]/events — SSE stream for real-time trip updates
// Polls Oracle every 8s and pushes an 'update' event when any trip data changes.
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getTripById, isParticipant } from '@/lib/repositories/tripRepo';
import { queryOne } from '@/lib/db-helpers';
import { hexToBuffer } from '@/lib/db';

export const dynamic = 'force-dynamic';

const POLL_MS = 8_000;
const MAX_MS  = 4 * 60_000; // client EventSource reconnects automatically after this

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });

  const trip = await getTripById(params.id);
  if (!trip) return new Response('Not found', { status: 404 });

  const hasAccess =
    trip.leaderId === session.user.id ||
    (await isParticipant(params.id, session.user.id));
  if (!hasAccess) return new Response('Forbidden', { status: 403 });

  const tripBuf = hexToBuffer(params.id);

  async function getLatestTs(): Promise<Date | null> {
    const row = await queryOne<{ LATEST: Date | null }>(
      `SELECT MAX(ts) AS latest FROM (
         SELECT updated_at AS ts FROM trips          WHERE id = :tripId
         UNION ALL
         SELECT created_at       FROM trip_participants WHERE trip_id = :tripId
         UNION ALL
         SELECT updated_at       FROM itinerary_items   WHERE trip_id = :tripId
         UNION ALL
         SELECT created_at       FROM item_votes         WHERE trip_id = :tripId
         UNION ALL
         SELECT closed_at        FROM item_votes         WHERE trip_id = :tripId
                                                               AND closed_at IS NOT NULL
         UNION ALL
         SELECT vr.voted_at      FROM vote_responses vr
           JOIN item_votes iv ON iv.id = vr.vote_id    WHERE iv.trip_id = :tripId
       )`,
      { tripId: tripBuf }
    );
    return row?.LATEST ?? null;
  }

  let lastTs = await getLatestTs();

  const encoder = new TextEncoder();
  const mkEvent = (name: string) => encoder.encode(`event: ${name}\ndata: {}\n\n`);
  const ping    = encoder.encode(': ping\n\n');

  let closed = false;
  let iv: ReturnType<typeof setInterval> | null = null;
  let tv: ReturnType<typeof setTimeout>  | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(mkEvent('connected'));

      iv = setInterval(async () => {
        if (closed) return;
        try {
          const latest = await getLatestTs();
          if (latest && (!lastTs || latest > lastTs)) {
            lastTs = latest;
            controller.enqueue(mkEvent('update'));
          } else {
            controller.enqueue(ping);
          }
        } catch {
          // swallow — next tick will retry or client reconnects
        }
      }, POLL_MS);

      tv = setTimeout(() => {
        if (!closed) {
          closed = true;
          if (iv) clearInterval(iv);
          controller.close();
        }
      }, MAX_MS);

      req.signal.addEventListener('abort', () => {
        closed = true;
        if (iv) clearInterval(iv);
        if (tv) clearTimeout(tv);
      });
    },
    cancel() {
      closed = true;
      if (iv) clearInterval(iv);
      if (tv) clearTimeout(tv);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
