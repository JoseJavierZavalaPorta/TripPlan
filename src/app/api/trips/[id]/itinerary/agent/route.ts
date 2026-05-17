// src/app/api/trips/[id]/itinerary/agent/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { getAllTravelerProfiles } from '@/lib/repositories/profileRepo';
import { getUserById } from '@/lib/repositories/userRepo';
import { getPlanningHistory, savePlanningMessage, clearPlanningHistory } from '@/lib/repositories/planningRepo';
import { runPlanningAgent, AgentTripContext, ParticipantProfile } from '@/lib/oci-ai';

export const dynamic = 'force-dynamic';

// GET — load conversation history
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede planificar' }, { status: 403 });
    }

    const history = await getPlanningHistory(params.id);
    return NextResponse.json({ data: history });
  } catch (err) {
    console.error('[GET /agent]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST — send user message, get agent response
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const trip = await getTripById(params.id);
    if (!trip) return NextResponse.json({ error: 'Viaje no encontrado' }, { status: 404 });
    if (trip.leaderId !== session.user.id) {
      return NextResponse.json({ error: 'Solo el líder puede planificar' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as { message?: string; reset?: boolean };

    // Reset conversation if requested
    if (body.reset) {
      await clearPlanningHistory(params.id);
      return NextResponse.json({ data: { ok: true } });
    }

    const userMessage = (body.message ?? '').trim();

    // Load participant profiles for context
    const dbProfiles = await getAllTravelerProfiles(params.id);
    const profiles: ParticipantProfile[] = await Promise.all(
      dbProfiles.map(async (p) => {
        const user = await getUserById(p.userId);
        return {
          name: user?.name ?? 'Viajero',
          dietType: p.dietType ?? undefined,
          foodAllergies: p.foodAllergies ?? undefined,
          cuisinePrefs: p.cuisinePrefs ?? undefined,
          mobilityNeeds: p.mobilityNeeds ?? undefined,
          travelPace: p.travelPace ?? undefined,
          interests: p.interests.length > 0 ? p.interests : undefined,
          budgetRange: p.budgetRange ?? undefined,
          specialRequests: p.specialRequests ?? undefined,
        };
      })
    );
    if (profiles.length === 0) {
      profiles.push({ name: 'Viajero', travelPace: 'moderate' });
    }

    // Build trip context for agent
    const start = new Date(trip.startDate + 'T00:00:00Z');
    const end   = new Date(trip.endDate   + 'T00:00:00Z');
    const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    const context: AgentTripContext = {
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalDays,
      flightStatus: trip.flightStatus,
      outboundDate: trip.outboundDate,
      returnDate: trip.returnDate,
      outboundFlight: trip.outboundFlight,
      returnFlight: trip.returnFlight,
      tripNotes: trip.tripNotes,
    };

    // Load existing conversation history
    const history = await getPlanningHistory(params.id);

    // Save user message (skip for the auto-start trigger)
    const isAutoStart = userMessage === '__start__';
    if (!isAutoStart && userMessage) {
      await savePlanningMessage(params.id, 'user', userMessage);
    }

    // Run the agent
    const agentInput = isAutoStart ? 'Comienza la planificación del viaje.' : userMessage;
    const agentResponse = await runPlanningAgent(
      context,
      profiles,
      history.map((h) => ({ role: h.role, content: h.content })),
      agentInput,
    );

    // Save agent response
    await savePlanningMessage(params.id, 'agent', JSON.stringify(agentResponse));

    return NextResponse.json({ data: agentResponse });
  } catch (err) {
    console.error('[POST /agent]', err);
    return NextResponse.json({ error: 'Error al procesar la respuesta del agente' }, { status: 500 });
  }
}
