// src/components/trips/TripCard.tsx
import Link from 'next/link';
import { Trip } from '@/types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

interface TripCardProps {
  trip: Trip;
}

const STATUS_LABELS: Record<Trip['status'], string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<Trip['status'], string> = {
  planning: 'text-amber-400 bg-amber-400/10',
  confirmed: 'text-sky-400 bg-sky-400/10',
  in_progress: 'text-green-400 bg-green-400/10',
  completed: 'text-slate-400 bg-slate-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
};

export function TripCard({ trip }: TripCardProps) {
  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const days = differenceInDays(end, start) + 1;

  const dateStr = `${format(start, 'd MMM', { locale: es })} — ${format(end, 'd MMM yyyy', { locale: es })}`;

  return (
    <Link href={`/trips/${trip.id}`}>
      <div className="bg-navy-800 rounded-2xl p-4 active:scale-[0.98] transition-transform border border-slate-700/50 hover:border-sky-400/30 hover:shadow-card-hover">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-semibold text-base truncate">{trip.title}</h2>
            <div className="flex items-center gap-1 mt-1">
              <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-slate-400 text-sm truncate">{trip.destination}</span>
            </div>
          </div>

          <span className={`ml-3 flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[trip.status]}`}>
            {STATUS_LABELS[trip.status]}
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Date range */}
          <div className="flex items-center gap-1.5 text-slate-400">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{dateStr}</span>
          </div>

          {/* Duration */}
          <span className="text-slate-500">·</span>
          <span className="text-slate-400">{days} {days === 1 ? 'día' : 'días'}</span>

          {/* Participant count */}
          {(trip.participantCount ?? 0) > 0 && (
            <>
              <span className="text-slate-500">·</span>
              <div className="flex items-center gap-1 text-slate-400">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{trip.participantCount}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
