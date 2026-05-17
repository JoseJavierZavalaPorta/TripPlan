// POST /api/trips/[id]/itinerary/generate — SSE streaming itinerary generation
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { getAllTravelerProfiles } from '@/lib/repositories/profileRepo';
import {
  clearAiGeneratedItinerary,
  saveGeneratedDay,
  getLockedDayNumbers,
  getDayCityAssignments,
} from '@/lib/repositories/itineraryRepo';
import { getBlacklist } from '@/lib/repositories/blacklistRepo';
import {
  generateItinerary,
  TripDetails,
  ParticipantProfile,
  CityAssignment,
} from '@/lib/oci-ai';
import { getUserById } from '@/lib/repositories/userRepo';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth and authorization must be checked BEFORE starting the stream so errors return JSON
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const trip = await getTripById(params.id);
  if (!trip) {
    return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
  }
  if (trip.leaderId !== session.user.id) {
    return NextResponse.json(
      { error: 'Solo el líder del viaje puede generar el itinerario' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({})) as { cityAssignments?: CityAssignment[] };
  let cityAssignments = body.cityAssignments;

  // Load locked days, existing city assignments, and blacklist from DB
  const [lockedDayNumbers, existingCityAssignments, avoidActivities] = await Promise.all([
    getLockedDayNumbers(params.id),
    getDayCityAssignments(params.id),
    getBlacklist(params.id),
  ]);

  // If no cityAssignments were passed (partial replan), use the ones already saved in the DB
  if (!cityAssignments) {
    cityAssignments = existingCityAssignments.map((d) => ({
      city: d.city ?? '',
      country: d.country ?? '',
      flag: d.flag ?? '',
    }));
  }

  const tripDetails: TripDetails = {
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    description: trip.description ?? undefined,
  };

  const dbProfiles = await getAllTravelerProfiles(params.id);
  const participantProfiles: ParticipantProfile[] = await Promise.all(
    dbProfiles.map(async (p) => {
      const user = await getUserById(p.userId);
      return {
        name: user?.name ?? 'Viajero',
        arrivalTime: p.arrivalTime ?? undefined,
        departureTime: p.departureTime ?? undefined,
        dietType: p.dietType ?? undefined,
        foodAllergies: p.foodAllergies ?? undefined,
        cuisinePrefs: p.cuisinePrefs ?? undefined,
        mobilityNeeds: p.mobilityNeeds ?? undefined,
        visualNeeds: p.visualNeeds ?? undefined,
        hearingNeeds: p.hearingNeeds ?? undefined,
        otherAccessibility: p.otherAccessibility ?? undefined,
        travelPace: p.travelPace ?? undefined,
        interests: p.interests.length > 0 ? p.interests : undefined,
        budgetRange: p.budgetRange ?? undefined,
        specialRequests: p.specialRequests ?? undefined,
      };
    })
  );

  if (participantProfiles.length === 0) {
    participantProfiles.push({ name: 'Viajero', travelPace: 'moderate' });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(msg));
      };

      try {
        await clearAiGeneratedItinerary(params.id);

        // Count total days to send in start event
        const start = new Date(tripDetails.startDate + 'T00:00:00Z');
        const end   = new Date(tripDetails.endDate   + 'T00:00:00Z');
        const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
        send('start', { totalDays, lockedDays: Array.from(lockedDayNumbers) });

        const generated = await generateItinerary(
          tripDetails,
          participantProfiles,
          async (day) => {
            await saveGeneratedDay(params.id, day);
            send('day_complete', {
              dayNumber: day.dayNumber,
              dayDate: day.dayDate,
              itemCount: day.items.length,
              city: day.city,
              country: day.country,
            });
          },
          cityAssignments,
          lockedDayNumbers,
          avoidActivities.length > 0 ? avoidActivities : undefined,
        );

        send('done', {
          daysGenerated: generated.days.length,
          totalEstimatedCost: generated.totalEstimatedCost,
          currency: generated.currency,
        });
      } catch (err) {
        console.error('[SSE generate]', err);
        send('error', { message: err instanceof Error ? err.message : 'Error al generar itinerario' });
      } finally {
        controller.close();
      }
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
