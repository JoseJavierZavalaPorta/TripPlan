// Redirect legacy /generate path to the new planning wizard
import { redirect } from 'next/navigation';

export default function GenerateRedirect({ params }: { params: { id: string } }) {
  redirect(`/trips/${params.id}/itinerary/plan`);
}
