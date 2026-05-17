// src/app/trips/new/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PACE_OPTIONS = [
  { value: 'slow',     label: 'Tranquilo',  desc: 'Pocas actividades, tiempo libre' },
  { value: 'moderate', label: 'Moderado',   desc: 'Balance actividades y descanso' },
  { value: 'fast',     label: 'Intenso',    desc: 'Máximo aprovechamiento' },
];

const BUDGET_OPTIONS = [
  { value: 'budget',  label: 'Económico',   desc: 'Hostales, comida local' },
  { value: 'mid',     label: 'Intermedio',  desc: 'Hoteles 3★, restaurantes variados' },
  { value: 'luxury',  label: 'Premium',     desc: 'Hoteles 4-5★, exclusivo' },
];

const DIET_OPTIONS = [
  { value: 'omnivore',    label: 'Omnívoro' },
  { value: 'vegetarian',  label: 'Vegetariano' },
  { value: 'vegan',       label: 'Vegano' },
  { value: 'pescatarian', label: 'Pescetariano' },
  { value: 'halal',       label: 'Halal' },
  { value: 'kosher',      label: 'Kosher' },
];

const INTEREST_OPTIONS = [
  'Museos', 'Arte', 'Historia', 'Gastronomía', 'Aventura', 'Naturaleza',
  'Playa', 'Montaña', 'Compras', 'Vida nocturna', 'Fotografía', 'Deportes',
];

type FlightStatus = 'none' | 'tentative' | 'booked';

interface TripFields {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  tripNotes: string;
  flightStatus: FlightStatus;
  outboundDate: string;
  returnDate: string;
  outboundFlight: string;
  returnFlight: string;
}

// ── Step 1 — Trip details ──────────────────────────────────────────────────────

function StepTripDetails({
  onCreated,
}: {
  onCreated: (tripId: string, fields: TripFields) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [tripNotes, setTripNotes] = useState('');
  const [flightStatus, setFlightStatus] = useState<FlightStatus>('none');
  const [outboundDate, setOutboundDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [outboundFlight, setOutboundFlight] = useState('');
  const [returnFlight, setReturnFlight] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (new Date(startDate) > new Date(endDate)) {
      setError('La fecha de inicio debe ser anterior a la de fin');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          destination,
          startDate,
          endDate,
          tripNotes: tripNotes || undefined,
          flightStatus,
          outboundDate: outboundDate || undefined,
          returnDate: returnDate || undefined,
          outboundFlight: outboundFlight || undefined,
          returnFlight: returnFlight || undefined,
        }),
      });
      const data = (await res.json()) as { data?: { id: string }; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error al crear el viaje'); return; }
      onCreated(data.data!.id, {
        title, destination, startDate, endDate, tripNotes,
        flightStatus, outboundDate, returnDate, outboundFlight, returnFlight,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded-full">Paso 1 de 2</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Nuevo viaje</h1>
        <p className="text-slate-400 text-sm mt-1">Cuéntale al agente lo que buscas</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="bg-navy-800 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Nombre del viaje *
          </label>
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Sudeste Asiático 2026" required maxLength={200} autoFocus
            className="w-full bg-transparent text-white text-base placeholder-slate-600 outline-none"
          />
        </div>

        {/* Destination */}
        <div className="bg-navy-800 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            Región o destino general *
          </label>
          <input
            type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
            placeholder="Ej: Europa del Este, Sudeste Asiático, Perú" required maxLength={300}
            className="w-full bg-transparent text-white text-base placeholder-slate-600 outline-none"
          />
          <p className="text-slate-600 text-xs mt-2">
            El agente propondrá los países y ciudades específicos
          </p>
        </div>

        {/* Dates */}
        <div className="bg-navy-800 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Fecha de inicio *
            </label>
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              required className="w-full bg-transparent text-white text-base outline-none [color-scheme:dark]"
            />
          </div>
          <div className="border-t border-slate-700 pt-3">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Fecha de fin *
            </label>
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              min={startDate} required
              className="w-full bg-transparent text-white text-base outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Trip vision / notes for AI */}
        <div className="bg-navy-800 rounded-xl p-4">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
            ¿Qué buscan en este viaje?
          </label>
          <textarea
            value={tripNotes} onChange={(e) => setTripNotes(e.target.value)}
            placeholder="Ej: Queremos combinar naturaleza y cultura, con algo de aventura. Nos importa mucho la gastronomía local y preferimos evitar las rutas turísticas masivas. Si podemos incluir algún trekking, mejor."
            rows={4} maxLength={3000}
            className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none resize-none leading-relaxed"
          />
          <p className="text-slate-600 text-xs mt-2">
            El agente de planificación leerá esto para personalizar tu itinerario
          </p>
        </div>

        {/* Flight status */}
        <div className="bg-navy-800 rounded-xl p-4 space-y-3">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Estado de vuelos
          </label>

          <div className="space-y-2">
            {([
              { value: 'none',      label: 'Todavía no tenemos vuelos',    desc: 'Las fechas son aproximadas' },
              { value: 'tentative', label: 'Tenemos fechas tentativas',     desc: 'Vuelos sin reservar aún' },
              { value: 'booked',    label: 'Vuelos ya reservados',          desc: 'Tengo los datos del vuelo' },
            ] as const).map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setFlightStatus(opt.value)}
                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                  flightStatus === opt.value
                    ? 'bg-sky-400/10 border-sky-400/40'
                    : 'bg-slate-800/50 border-slate-700/50'
                }`}
              >
                <div className={`font-semibold text-sm ${flightStatus === opt.value ? 'text-sky-400' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Tentative: just dates */}
          {flightStatus === 'tentative' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Salida aproximada</label>
                <input
                  type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)}
                  className="w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
              </div>
              <div className="border-t border-slate-700 pt-3">
                <label className="text-xs text-slate-500 block mb-1.5">Regreso aproximado</label>
                <input
                  type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          )}

          {/* Booked: flight details */}
          {flightStatus === 'booked' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-xs text-slate-500 block mb-1.5">Vuelo de salida</label>
                <input
                  type="text" value={outboundFlight} onChange={(e) => setOutboundFlight(e.target.value)}
                  placeholder="Ej: LA2031 Avianca · 10:30 Lima→Cusco · 12 jun"
                  maxLength={200}
                  className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none"
                />
              </div>
              <div className="border-t border-slate-700 pt-3">
                <label className="text-xs text-slate-500 block mb-1.5">Vuelo de regreso</label>
                <input
                  type="text" value={returnFlight} onChange={(e) => setReturnFlight(e.target.value)}
                  placeholder="Ej: LA2030 Avianca · 12:00 Cusco→Lima · 24 jun"
                  maxLength={200}
                  className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">Fecha de salida</label>
                  <input
                    type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)}
                    className="w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1.5">Fecha de regreso</label>
                  <input
                    type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !title || !destination || !startDate || !endDate}
          className="w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? 'Creando...' : 'Continuar →'}
        </button>

        <button type="button" onClick={() => router.back()} className="w-full h-11 text-slate-400 text-sm font-medium">
          Cancelar
        </button>
      </form>
    </div>
  );
}

// ── Step 2 — My traveler profile ───────────────────────────────────────────────

function StepMyProfile({
  tripId,
  tripTitle,
  startDate,
  endDate,
}: {
  tripId: string;
  tripTitle: string;
  startDate: string;
  endDate: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [arrivalDate, setArrivalDate] = useState(startDate);
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureDate, setDepartureDate] = useState(endDate);
  const [departureTime, setDepartureTime] = useState('');
  const [dietType, setDietType] = useState('');
  const [foodAllergies, setFoodAllergies] = useState('');
  const [travelPace, setTravelPace] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');

  function toggleInterest(i: string) {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arrivalDate: arrivalDate || null,
          arrivalTime: arrivalTime || null,
          departureDate: departureDate || null,
          departureTime: departureTime || null,
          dietType: dietType || null,
          foodAllergies: foodAllergies || null,
          travelPace: travelPace || null,
          interests,
          budgetRange: budgetRange || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return; }
      router.push(`/trips/${tripId}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">Paso 2 de 2</span>
        </div>
        <h1 className="text-xl font-bold text-white">Tu perfil viajero</h1>
        <p className="text-slate-400 text-sm mt-0.5 truncate">{tripTitle}</p>
        <p className="text-slate-500 text-xs mt-1">
          El agente usará esto para personalizar el itinerario
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Arrival & Departure */}
        <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Llegada y salida personal
          </h3>
          <div>
            <label className="text-xs text-slate-500 block mb-1.5">Llego al destino</label>
            <div className="flex gap-3">
              <input
                type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-24 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
                <span className="text-slate-600 text-xs">hora</span>
              </div>
            </div>
          </div>
          <div className="border-t border-slate-700 pt-3">
            <label className="text-xs text-slate-500 block mb-1.5">Salgo del destino</label>
            <div className="flex gap-3">
              <input
                type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-24 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
                <span className="text-slate-600 text-xs">hora</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pace */}
        <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Ritmo de viaje</h3>
          <div className="space-y-2">
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setTravelPace(travelPace === opt.value ? '' : opt.value)}
                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                  travelPace === opt.value ? 'bg-sky-400/10 border-sky-400/40' : 'bg-slate-800/50 border-slate-700/50'
                }`}
              >
                <div className={`font-semibold text-sm ${travelPace === opt.value ? 'text-sky-400' : 'text-white'}`}>{opt.label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Presupuesto</h3>
          <div className="space-y-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setBudgetRange(budgetRange === opt.value ? '' : opt.value)}
                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                  budgetRange === opt.value ? 'bg-amber-400/10 border-amber-400/40' : 'bg-slate-800/50 border-slate-700/50'
                }`}
              >
                <div className={`font-semibold text-sm ${budgetRange === opt.value ? 'text-amber-400' : 'text-white'}`}>{opt.label}</div>
                <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Diet */}
        <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50 space-y-3">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alimentación</h3>
          <div className="flex flex-wrap gap-2">
            {DIET_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setDietType(dietType === opt.value ? '' : opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  dietType === opt.value ? 'bg-sky-400 text-navy-900' : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="text" value={foodAllergies} onChange={(e) => setFoodAllergies(e.target.value)}
            placeholder="Alergias (ej: nueces, gluten)" maxLength={500}
            className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none border-t border-slate-700 pt-3"
          />
        </div>

        {/* Interests */}
        <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Intereses</h3>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest} type="button"
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  interests.includes(interest) ? 'bg-amber-400 text-navy-900' : 'bg-slate-700/50 text-slate-400'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Guardar e ir al viaje'}
        </button>

        <button
          type="button"
          onClick={() => router.push(`/trips/${tripId}`)}
          className="w-full h-11 text-slate-400 text-sm font-medium"
        >
          Omitir por ahora
        </button>
      </form>
    </div>
  );
}

// ── Root page ─────────────────────────────────────────────────────────────────

export default function NewTripPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [tripId, setTripId] = useState('');
  const [tripFields, setTripFields] = useState<TripFields | null>(null);

  function handleTripCreated(id: string, fields: TripFields) {
    setTripId(id);
    setTripFields(fields);
    setStep(2);
  }

  if (step === 1) return <StepTripDetails onCreated={handleTripCreated} />;

  return (
    <StepMyProfile
      tripId={tripId}
      tripTitle={tripFields!.title}
      startDate={tripFields!.startDate}
      endDate={tripFields!.endDate}
    />
  );
}
