// POST /api/trips/[id]/itinerary/items/[itemId]/suggest — AI alternative suggestion
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById, isParticipant } from '@/lib/repositories/tripRepo';
import { getItineraryItemById, getItinerary } from '@/lib/repositories/itineraryRepo';
import { suggestItemAlternative } from '@/lib/oci-ai';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });

    const hasAccess =
      trip.leaderId === session.user.id ||
      (await isParticipant(params.id, session.user.id));
    if (!hasAccess) return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });

    const item = await getItineraryItemById(params.itemId);
    if (!item || item.tripId !== params.id) {
      return NextResponse.json({ error: 'Ítem no encontrado' }, { status: 404 });
    }

    // Get day context to find previous/next items
    const itinerary = await getItinerary(params.id);
    const day = itinerary.find((d) => d.id === item.dayId);
    const itemIndex = day?.items.findIndex((i) => i.id === item.id) ?? -1;
    const prevTitle = itemIndex > 0 ? day?.items[itemIndex - 1]?.title : undefined;
    const nextTitle = itemIndex >= 0 && day && itemIndex < day.items.length - 1
      ? day.items[itemIndex + 1]?.title
      : undefined;

    const suggestion = await suggestItemAlternative(
      {
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        locationName: item.locationName,
        startTime: item.startTime,
        endTime: item.endTime,
        estimatedCost: item.estimatedCost,
        currency: item.currency,
      },
      {
        destination: trip.destination,
        dayNumber: day?.dayNumber ?? 1,
        totalDays: itinerary.length,
        prevTitle,
        nextTitle,
      }
    );

    return NextResponse.json({ data: suggestion });
  } catch (err) {
    console.error('[POST /api/trips/[id]/itinerary/items/[itemId]/suggest]', err);
    return NextResponse.json({ error: 'Error al generar sugerencia' }, { status: 500 });
  }
}
