// src/app/trips/[id]/page.tsx
import { auth } from '@/auth';
import { getTripById, isParticipant, getTripParticipants } from '@/lib/repositories/tripRepo';
import { getItinerary } from '@/lib/repositories/itineraryRepo';
import { getTravelerProfile } from '@/lib/repositories/profileRepo';
import { notFound, redirect } from 'next/navigation';
import { TripDashboard } from '@/components/trips/TripDashboard';

export default async function TripPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login');

  const trip = await getTripById(params.id);
  if (!trip) notFound();

  const hasAccess =
    trip.leaderId === session.user.id ||
    (await isParticipant(params.id, session.user.id));

  if (!hasAccess) {
    redirect('/trips');
  }

  const [participants, itinerary, myProfile] = await Promise.all([
    getTripParticipants(params.id),
    getItinerary(params.id),
    getTravelerProfile(params.id, session.user.id),
  ]);

  const isLeader = trip.leaderId === session.user.id;

  return (
    <TripDashboard
      trip={trip}
      participants={participants}
      itinerary={itinerary}
      isLeader={isLeader}
      currentUserId={session.user.id}
      hasProfile={myProfile !== null}
      myProfile={myProfile}
    />
  );
}
