// src/app/trips/[id]/itinerary/plan/page.tsx
import { auth } from '@/auth';
import { getTripById } from '@/lib/repositories/tripRepo';
import { redirect, notFound } from 'next/navigation';
import { PlanningAgent } from './PlanningAgent';

export default async function PlanPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const trip = await getTripById(params.id);
  if (!trip) notFound();
  if (trip.leaderId !== session.user.id) redirect(`/trips/${params.id}`);

  const start = new Date(trip.startDate + 'T00:00:00Z');
  const end   = new Date(trip.endDate   + 'T00:00:00Z');
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

  return (
    <PlanningAgent
      tripId={trip.id}
      tripTitle={trip.title}
      destination={trip.destination}
      totalDays={totalDays}
    />
  );
}
