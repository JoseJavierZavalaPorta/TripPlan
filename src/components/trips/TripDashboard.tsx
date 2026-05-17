// src/components/trips/TripDashboard.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trip, TripParticipant, ItineraryDay, FlightStatus, TravelerProfile } from '@/types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { ParticipantList } from './ParticipantList';
import { DayItinerary } from '../itinerary/DayItinerary';

type Tab = 'itinerario' | 'participantes' | 'mapa';

interface TripDashboardProps {
  trip: Trip;
  participants: TripParticipant[];
  itinerary: ItineraryDay[];
  isLeader: boolean;
  currentUserId: string;
  hasProfile: boolean;
  myProfile: TravelerProfile | null;
}

const STATUS_LABELS: Record<Trip['status'], string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const STATUS_COLORS: Record<Trip['status'], string> = {
  planning: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  confirmed: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  in_progress: 'text-green-400 bg-green-400/10 border-green-400/20',
  completed: 'text-slate-400 bg-slate-400/10 border-slate-400/20',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export function TripDashboard({
  trip,
  participants,
  itinerary,
  isLeader,
  currentUserId,
  hasProfile,
  myProfile,
}: TripDashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('itinerario');

  // Determine what the current user can do
  const currentParticipant = participants.find(p => p.userId === currentUserId);
  const canSuggest = !isLeader && (currentParticipant?.canEdit ?? false);

  const start = parseISO(trip.startDate);
  const end = parseISO(trip.endDate);
  const days = differenceInDays(end, start) + 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Trip Header */}
      <div className="bg-navy-800 rounded-2xl p-5 border border-slate-700/50">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-xl font-bold text-white leading-snug flex-1 min-w-0 pr-3">
            {trip.title}
          </h1>
          <span className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_COLORS[trip.status]}`}>
            {STATUS_LABELS[trip.status]}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 mb-4">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm">{trip.destination}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-navy-900/50 rounded-xl p-3 text-center">
            <div className="text-sky-400 font-bold text-lg">
              {format(start, 'd MMM', { locale: es })}
            </div>
            <div className="text-slate-500 text-xs mt-0.5">Inicio</div>
          </div>
          <div className="bg-navy-900/50 rounded-xl p-3 text-center">
            <div className="text-white font-bold text-lg">{days}</div>
            <div className="text-slate-500 text-xs mt-0.5">{days === 1 ? 'Día' : 'Días'}</div>
          </div>
          <div className="bg-navy-900/50 rounded-xl p-3 text-center">
            <div className="text-amber-400 font-bold text-lg">
              {format(end, 'd MMM', { locale: es })}
            </div>
            <div className="text-slate-500 text-xs mt-0.5">Fin</div>
          </div>
        </div>

        {trip.description && (
          <p className="text-slate-400 text-sm mt-4 leading-relaxed">{trip.description}</p>
        )}
      </div>

      {/* Profile missing banner */}
      {!hasProfile && (
        <Link
          href={`/trips/${trip.id}/profile`}
          className="flex items-center gap-3 bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-3 active:scale-95 transition-transform"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-amber-400 text-sm font-semibold">Completa tu perfil</div>
            <div className="text-slate-400 text-xs">
              La IA necesita tus preferencias para personalizar el itinerario
            </div>
          </div>
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* Flight & Trip Vision Card */}
      <FlightCard trip={trip} isLeader={isLeader} />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/trips/${trip.id}/profile`}
          className="bg-navy-800 rounded-xl p-4 border border-slate-700/50 active:scale-95 transition-transform flex items-center gap-3"
        >
          <div className="w-9 h-9 rounded-lg bg-sky-400/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <div className="text-white text-sm font-semibold">Mi perfil</div>
            <div className="text-slate-500 text-xs">Preferencias</div>
          </div>
        </Link>

        {isLeader && (
          <Link
            href={`/trips/${trip.id}/invite`}
            className="bg-navy-800 rounded-xl p-4 border border-slate-700/50 active:scale-95 transition-transform flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-lg bg-amber-400/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <div className="text-white text-sm font-semibold">Invitar</div>
              <div className="text-slate-500 text-xs">Añadir viajeros</div>
            </div>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-xl p-1">
        {(['itinerario', 'participantes', 'mapa'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 h-9 rounded-lg text-sm font-semibold capitalize transition-colors ${
              activeTab === tab
                ? 'bg-sky-400 text-navy-900'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab === 'itinerario' ? 'Itinerario' : tab === 'participantes' ? 'Grupo' : 'Mapa'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'itinerario' && (
        <ItineraryTab
          tripId={trip.id}
          itinerary={itinerary}
          isLeader={isLeader}
          canSuggest={canSuggest}
          currentUserId={currentUserId}
          myProfile={myProfile}
        />
      )}

      {activeTab === 'participantes' && (
        <ParticipantList
          participants={participants}
          currentUserId={currentUserId}
          isLeader={isLeader}
          tripId={trip.id}
        />
      )}

      {activeTab === 'mapa' && (
        <MapTab tripId={trip.id} itinerary={itinerary} trip={trip} />
      )}
    </div>
  );
}

// ── Flight & Vision Card ───────────────────────────────────────────────────────

const FLIGHT_STATUS_LABELS: Record<FlightStatus, string> = {
  none:      'Sin vuelos',
  tentative: 'Fechas tentativas',
  booked:    'Vuelos reservados',
};

const FLIGHT_STATUS_COLORS: Record<FlightStatus, string> = {
  none:      'text-slate-400 bg-slate-400/10',
  tentative: 'text-amber-400 bg-amber-400/10',
  booked:    'text-teal-400 bg-teal-400/10',
};

function FlightCard({ trip, isLeader }: { trip: Trip; isLeader: boolean }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flightStatus, setFlightStatus] = useState<FlightStatus>(trip.flightStatus);
  const [outboundDate, setOutboundDate] = useState(trip.outboundDate ?? '');
  const [returnDate, setReturnDate] = useState(trip.returnDate ?? '');
  const [outboundFlight, setOutboundFlight] = useState(trip.outboundFlight ?? '');
  const [returnFlight, setReturnFlight] = useState(trip.returnFlight ?? '');
  const [tripNotes, setTripNotes] = useState(trip.tripNotes ?? '');

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/trips/${trip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightStatus,
          outboundDate: outboundDate || null,
          returnDate: returnDate || null,
          outboundFlight: outboundFlight || null,
          returnFlight: returnFlight || null,
          tripNotes: tripNotes || null,
        }),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const hasAnyData = trip.tripNotes || trip.flightStatus !== 'none' || trip.outboundFlight || trip.returnFlight;

  if (!editing) {
    return (
      <div className="bg-navy-800 rounded-2xl border border-slate-700/50 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vuelos y visión</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${FLIGHT_STATUS_COLORS[trip.flightStatus]}`}>
              {FLIGHT_STATUS_LABELS[trip.flightStatus]}
            </span>
          </div>
          {isLeader && (
            <button onClick={() => setEditing(true)} className="text-sky-400 text-xs font-semibold">
              Editar
            </button>
          )}
        </div>

        <div className="px-4 pb-4 space-y-2">
          {(trip.outboundFlight || trip.outboundDate) && (
            <div className="flex items-start gap-2">
              <span className="text-slate-600 text-xs mt-0.5">↗</span>
              <span className="text-slate-400 text-xs">
                {trip.outboundFlight || trip.outboundDate}
              </span>
            </div>
          )}
          {(trip.returnFlight || trip.returnDate) && (
            <div className="flex items-start gap-2">
              <span className="text-slate-600 text-xs mt-0.5">↙</span>
              <span className="text-slate-400 text-xs">
                {trip.returnFlight || trip.returnDate}
              </span>
            </div>
          )}
          {trip.tripNotes && (
            <div className="mt-2 pt-2 border-t border-slate-700/50">
              <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">{trip.tripNotes}</p>
            </div>
          )}
          {!hasAnyData && isLeader && (
            <button onClick={() => setEditing(true)} className="text-slate-600 text-xs">
              Añade vuelos y la visión del viaje para que el agente planifique mejor →
            </button>
          )}
          {!hasAnyData && !isLeader && (
            <p className="text-slate-600 text-xs">Sin información de vuelos aún.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-navy-800 rounded-2xl border border-sky-400/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
        <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">Editar vuelos y visión</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Flight status */}
        <div className="space-y-2">
          <label className="text-xs text-slate-500 block">Estado de vuelos</label>
          <div className="flex gap-2">
            {(['none', 'tentative', 'booked'] as FlightStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFlightStatus(s)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  flightStatus === s ? 'bg-sky-400 text-navy-900' : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {s === 'none' ? 'Sin vuelos' : s === 'tentative' ? 'Tentativo' : 'Reservado'}
              </button>
            ))}
          </div>
        </div>

        {flightStatus !== 'none' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Fecha salida</label>
                <input
                  type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)}
                  className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-2 py-2 outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Fecha regreso</label>
                <input
                  type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-2 py-2 outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            {flightStatus === 'booked' && (
              <>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Vuelo de salida</label>
                  <input
                    type="text" value={outboundFlight} onChange={(e) => setOutboundFlight(e.target.value)}
                    placeholder="Ej: LA2031 · 10:30 Lima→Cusco" maxLength={200}
                    className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-3 py-2 outline-none placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Vuelo de regreso</label>
                  <input
                    type="text" value={returnFlight} onChange={(e) => setReturnFlight(e.target.value)}
                    placeholder="Ej: LA2030 · 12:00 Cusco→Lima" maxLength={200}
                    className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-3 py-2 outline-none placeholder-slate-600"
                  />
                </div>
              </>
            )}
          </>
        )}

        {/* Trip notes */}
        <div>
          <label className="text-xs text-slate-500 block mb-1">Visión del viaje (para el agente)</label>
          <textarea
            value={tripNotes} onChange={(e) => setTripNotes(e.target.value)}
            placeholder="¿Qué buscan en este viaje? ¿Qué tipo de experiencias? ¿Alguna preferencia o restricción importante?"
            rows={3} maxLength={3000}
            className="w-full bg-slate-700/50 text-white text-xs rounded-lg px-3 py-2 outline-none resize-none placeholder-slate-600 leading-relaxed"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave} disabled={saving}
            className="flex-1 h-10 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          <button
            onClick={() => setEditing(false)} disabled={saving}
            className="h-10 px-4 text-slate-400 text-sm border border-slate-700 rounded-xl"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Itinerary Tab ──────────────────────────────────────────────────────────────

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

interface DayGenProgress {
  dayNumber: number;
  status: 'pending' | 'generating' | 'done' | 'locked' | 'error';
  city?: string;
}

function ItineraryTab({
  tripId, itinerary, isLeader, canSuggest, currentUserId, myProfile,
}: {
  tripId: string; itinerary: ItineraryDay[]; isLeader: boolean;
  canSuggest: boolean; currentUserId: string; myProfile: TravelerProfile | null;
}) {
  const router = useRouter();
  const [genStatus, setGenStatus] = useState<GenerationStatus>('idle');
  const [genProgress, setGenProgress] = useState<DayGenProgress[]>([]);
  const [genError, setGenError] = useState('');

  const lockedCount = itinerary.filter((d) => d.locked).length;
  const freeCount = itinerary.length - lockedCount;

  async function handlePartialReplan() {
    if (!confirm(`Esto regenerará los ${freeCount} días sin candado, manteniendo las ciudades asignadas. ¿Continuar?`)) return;

    setGenStatus('generating');
    setGenError('');

    // Build initial progress from current itinerary
    const initialProgress: DayGenProgress[] = itinerary.map((d) => ({
      dayNumber: d.dayNumber,
      status: d.locked ? 'locked' : 'pending',
      city: d.city ?? undefined,
    }));
    setGenProgress(initialProgress);

    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // no cityAssignments — server reads from DB
      });

      if (!response.ok || !response.body) {
        setGenStatus('error');
        setGenError('No se pudo iniciar la regeneración.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Mark first non-locked batch as generating once we get the start event
      let started = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            try {
              const payload = JSON.parse(line.slice(6)) as Record<string, unknown>;
              if (eventType === 'start' && !started) {
                started = true;
                const lockedDays = new Set((payload.lockedDays as number[]) ?? []);
                setGenProgress((prev) =>
                  prev.map((d) =>
                    !lockedDays.has(d.dayNumber) && d.status === 'pending'
                      ? { ...d, status: 'generating' }
                      : d
                  )
                );
              } else if (eventType === 'day_complete') {
                const dayNum = payload.dayNumber as number;
                setGenProgress((prev) =>
                  prev.map((d) => {
                    if (d.dayNumber === dayNum) return { ...d, status: 'done' };
                    return d;
                  })
                );
              } else if (eventType === 'error') {
                setGenError((payload.message as string) ?? 'Error en la generación');
                setGenStatus('error');
                setGenProgress((prev) =>
                  prev.map((d) =>
                    d.status === 'pending' || d.status === 'generating' ? { ...d, status: 'error' } : d
                  )
                );
              }
            } catch { /* ignore */ }
            eventType = '';
          }
        }
      }

      setGenStatus('done');
      // Force page refresh to load the updated itinerary from DB
      router.refresh();
    } catch (e) {
      setGenStatus('error');
      setGenError((e as Error).message ?? 'Error de conexión');
    }
  }

  if (genStatus === 'generating' || genStatus === 'done' || genStatus === 'error') {
    const doneCount = genProgress.filter((d) => d.status === 'done').length;
    const freeTotal = genProgress.filter((d) => d.status !== 'locked').length;
    const pct = freeTotal > 0 ? Math.round((doneCount / freeTotal) * 100) : 100;

    return (
      <div className="space-y-4 bg-navy-800 rounded-2xl p-5 border border-slate-700/50">
        <div className="text-center">
          <div className="text-white font-bold mb-1">
            {genStatus === 'done' ? '¡Días libres regenerados!' : genStatus === 'error' ? 'Generación interrumpida' : 'Regenerando días libres...'}
          </div>
          <div className="text-slate-400 text-sm">{doneCount} de {freeTotal} días completados</div>
        </div>

        <div className="bg-slate-700/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${genStatus === 'error' ? 'bg-amber-400' : 'bg-teal-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {genError && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
            <p className="text-amber-400 text-xs">{genError}</p>
          </div>
        )}

        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {genProgress.map((d) => (
            <div key={d.dayNumber} className="flex items-center gap-2.5">
              {d.status === 'locked' && <span className="text-sm">🔒</span>}
              {d.status === 'done' && (
                <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              {d.status === 'generating' && (
                <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin" />
              )}
              {d.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-slate-600" />}
              {d.status === 'error' && (
                <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-amber-400 text-[10px] font-bold">!</span>
                </div>
              )}
              <span className={`text-sm ${
                d.status === 'done' ? 'text-white' :
                d.status === 'locked' ? 'text-slate-500' :
                d.status === 'generating' ? 'text-teal-400' :
                d.status === 'error' ? 'text-amber-400' : 'text-slate-600'
              }`}>
                Día {d.dayNumber}{d.city ? ` — ${d.city}` : ''}
                {d.status === 'locked' && ' (protegido)'}
              </span>
            </div>
          ))}
        </div>

        {(genStatus === 'done' || genStatus === 'error') && (
          <button
            onClick={() => { setGenStatus('idle'); setGenProgress([]); }}
            className={`w-full h-10 font-bold text-sm rounded-xl ${genStatus === 'done' ? 'bg-teal-400 text-navy-900' : 'bg-amber-500 text-white'}`}
          >
            Ver itinerario
          </button>
        )}
      </div>
    );
  }

  if (itinerary.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h3 className="text-white font-semibold mb-2">Sin itinerario aún</h3>
        <p className="text-slate-400 text-sm mb-6 max-w-xs mx-auto">
          {isLeader
            ? 'Genera un itinerario personalizado con IA basado en los perfiles del grupo.'
            : 'El líder del viaje generará el itinerario pronto.'}
        </p>
        {isLeader && (
          <Link
            href={`/trips/${tripId}/itinerary/plan`}
            className="inline-flex h-11 px-5 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl items-center gap-2 active:scale-95 transition-transform"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Planificar con IA
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-slate-400 text-sm">{itinerary.length} días planificados</span>
          {lockedCount > 0 && (
            <span className="ml-2 text-amber-400 text-xs">· {lockedCount} 🔒</span>
          )}
        </div>
        {isLeader && (
          <div className="flex items-center gap-3">
            {freeCount > 0 && (
              <button
                onClick={handlePartialReplan}
                className="text-teal-400 text-sm font-semibold flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Regen. {freeCount} libres
              </button>
            )}
            <Link
              href={`/trips/${tripId}/itinerary/plan`}
              className="text-sky-400 text-sm font-semibold flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Replanificar todo
            </Link>
          </div>
        )}
      </div>

      {itinerary.map((day, idx) => (
        <DayItinerary
          key={day.id}
          day={day}
          tripId={tripId}
          isLeader={isLeader}
          canSuggest={canSuggest}
          currentUserId={currentUserId}
          myProfile={myProfile}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
}

// ── Map Tab ────────────────────────────────────────────────────────────────────

function MapTab({
  tripId,
  itinerary,
  trip,
}: {
  tripId: string;
  itinerary: ItineraryDay[];
  trip: Trip;
}) {
  // Dynamic import happens in the MapView component itself
  const hasCoords = trip.destinationLat && trip.destinationLng;
  const hasItems = itinerary.some((d) =>
    d.items.some((i) => i.locationLat && i.locationLng)
  );

  if (!hasCoords && !hasItems) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-navy-800 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 0l5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17m0-13v13" />
          </svg>
        </div>
        <h3 className="text-white font-semibold mb-2">El mapa estará disponible</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Genera el itinerario con IA para ver las ubicaciones en el mapa.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-navy-800 rounded-2xl overflow-hidden border border-slate-700/50" style={{ height: 400 }}>
      <MapViewLoader
        tripId={tripId}
        trip={trip}
        itinerary={itinerary}
      />
    </div>
  );
}

// Lazy load MapView to avoid SSR issues with Leaflet
function MapViewLoader(props: {
  tripId: string;
  trip: Trip;
  itinerary: ItineraryDay[];
}) {
  const [MapView, setMapView] = useState<React.ComponentType<typeof props> | null>(null);
  const [loading, setLoading] = useState(false);

  if (!MapView && !loading) {
    setLoading(true);
    import('@/components/map/MapView').then((m) => {
      setMapView(() => m.MapView);
      setLoading(false);
    });
  }

  if (!MapView) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-slate-500 text-sm">Cargando mapa...</div>
      </div>
    );
  }

  return <MapView {...props} />;
}
