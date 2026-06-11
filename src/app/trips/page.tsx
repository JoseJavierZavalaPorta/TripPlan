// src/app/trips/page.tsx
import { auth } from '@/auth';
import { getTripsByUser } from '@/lib/repositories/tripRepo';
import { TripCard } from '@/components/trips/TripCard';
import Link from 'next/link';

export default async function TripsPage() {
  const session = await auth();
  const trips = await getTripsByUser(session!.user!.id!);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mis Viajes</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {trips.length === 0
              ? 'Aún no tienes viajes planificados'
              : `${trips.length} viaje${trips.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/trips/new"
          className="h-11 px-4 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl flex items-center gap-2 active:scale-95 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo viaje
        </Link>
      </div>

      {trips.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-adventure-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 0l5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17m0-13v13" />
            </svg>
          </div>
          <h2 className="text-slate-900 font-semibold text-lg mb-2">Tu próxima aventura te espera</h2>
          <p className="text-slate-500 text-sm mb-8 max-w-xs mx-auto">
            Crea tu primer viaje y empieza a planificar con tu grupo usando IA.
          </p>
          <Link
            href="/trips/new"
            className="inline-flex h-12 px-6 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl items-center gap-2 active:scale-95 transition-colors"
          >
            Crear mi primer viaje
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}
