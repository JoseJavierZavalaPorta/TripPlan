// src/app/trips/[id]/profile/page.tsx
import { auth } from '@/auth';
import { getTravelerProfile } from '@/lib/repositories/profileRepo';
import { getTripById } from '@/lib/repositories/tripRepo';
import { redirect, notFound } from 'next/navigation';
import { TravelerProfileForm } from '@/components/trips/TravelerProfileForm';

export default async function TravelerProfilePage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login');

  const trip = await getTripById(params.id);
  if (!trip) notFound();

  const profile = await getTravelerProfile(params.id, session.user.id);

  return (
    <TravelerProfileForm
      tripId={params.id}
      tripTitle={trip.title}
      existingProfile={profile}
    />
  );
}
