// src/app/trips/new/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ── Flight lookup types ────────────────────────────────────────────────────────

interface FlightData {
  flightIata: string;
  airlineName: string;
  depIata: string;
  depCity: string;
  arrIata: string;
  arrCity: string;
  depTime: string;
  arrTime: string;
  duration?: number;
  nextDay?: boolean;
}

type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found';

async function lookupFlight(code: string): Promise<FlightData | null> {
  try {
    const res = await fetch(`/api/flights/lookup?code=${encodeURIComponent(code)}`);
    const json = await res.json() as { found: boolean } & Partial<FlightData>;
    if (!json.found) return null;
    return json as FlightData;
  } catch {
    return null;
  }
}

// ── FlightInput — smart input with debounced AirLabs lookup ───────────────────

function FlightInput({
  label,
  onConfirm,
  onClear,
}: {
  label: string;
  onConfirm: (data: FlightData, formatted: string) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [result, setResult] = useState<FlightData | null>(null);
  const [confirmed, setConfirmed] = useState<FlightData | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function handleChange(v: string) {
    const val = v.toUpperCase().replace(/\s/g, '');
    setQuery(val);
    setConfirmed(null);
    setResult(null);
    clearTimeout(timerRef.current);

    if (val.length < 4) { setStatus('idle'); return; }

    setStatus('searching');
    timerRef.current = setTimeout(async () => {
      const data = await lookupFlight(val);
      if (data) { setResult(data); setStatus('found'); }
      else setStatus('not_found');
    }, 600);
  }

  function handleConfirm() {
    if (!result) return;
    const formatted = `${result.flightIata} · ${result.airlineName} · ${result.depCity} (${result.depIata}) → ${result.arrCity} (${result.arrIata}) · ${result.depTime}`;
    setConfirmed(result);
    onConfirm(result, formatted);
  }

  function handleClear() {
    setQuery('');
    setStatus('idle');
    setResult(null);
    setConfirmed(null);
    onClear();
  }

  if (confirmed) {
    return (
      <div>
        <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
        <div className="bg-sky-50 border border-sky-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-sky-700">{confirmed.flightIata}</span>
              <span className="text-xs text-slate-500">{confirmed.airlineName}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span className="text-xs font-semibold text-slate-700">{confirmed.depCity}</span>
              <span className="text-xs text-slate-400">{confirmed.depTime}</span>
              <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              <span className="text-xs font-semibold text-slate-700">{confirmed.arrCity}</span>
              <span className="text-xs text-slate-400">{confirmed.arrTime}</span>
              {confirmed.nextDay && (
                <span className="text-xs font-bold text-amber-500">+1 día</span>
              )}
              {confirmed.duration && (
                <span className="text-xs text-slate-400">· {Math.floor(confirmed.duration / 60)}h{confirmed.duration % 60 > 0 ? `${confirmed.duration % 60}m` : ''}</span>
              )}
            </div>
          </div>
          <button
            type="button" onClick={handleClear}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors cursor-pointer flex-shrink-0 underline"
          >
            Cambiar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 block mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Ej: LA2031"
          maxLength={10}
          className="w-full h-10 border border-slate-200 rounded-lg px-3 pr-10 text-slate-900 bg-white text-sm placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all font-mono tracking-wide"
        />
        {status === 'searching' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-sky-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}
        {status === 'found' && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {status === 'found' && result && (
        <div className="mt-2 bg-white border border-sky-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-900">{result.flightIata}</span>
                  <span className="text-xs text-slate-500 font-medium">{result.airlineName}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="text-center">
                    <div className="text-sm font-bold text-slate-900">{result.depTime}</div>
                    <div className="text-xs text-slate-500">{result.depCity}</div>
                    <div className="text-xs text-slate-400">{result.depIata}</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-0.5 px-2">
                    <div className="flex items-center w-full gap-1">
                      <div className="flex-1 h-px bg-slate-200" />
                      <svg className="w-3 h-3 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                    {result.duration && (
                      <span className="text-xs text-slate-400">
                        {Math.floor(result.duration / 60)}h{result.duration % 60 > 0 ? `${result.duration % 60}m` : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="flex items-start justify-center gap-0.5">
                      <div className="text-sm font-bold text-slate-900">{result.arrTime}</div>
                      {result.nextDay && (
                        <span className="text-xs font-bold text-amber-500 leading-tight mt-0.5">+1</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{result.arrCity}</div>
                    <div className="text-xs text-slate-400">{result.arrIata}</div>
                  </div>
                </div>
                {result.nextDay && (
                  <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
                    </svg>
                    Llega al día siguiente
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-slate-100 flex">
            <button
              type="button" onClick={handleClear}
              className="flex-1 py-2.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer font-medium"
            >
              Cancelar
            </button>
            <div className="w-px bg-slate-100" />
            <button
              type="button" onClick={handleConfirm}
              className="flex-1 py-2.5 text-xs text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer font-bold"
            >
              Usar este vuelo
            </button>
          </div>
        </div>
      )}

      {status === 'not_found' && query.length >= 4 && (
        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Vuelo no encontrado. Verifica el código (ej: LA2031, AV9132).
        </p>
      )}
    </div>
  );
}

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
  'Bienestar', 'Arquitectura', 'Mercados', 'Festivales',
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
  outboundFlightData?: FlightData;
  returnFlightData?: FlightData;
}

function addDays(dateStr: string, n: number): string {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// ── Shared progress stepper ────────────────────────────────────────────────────

function ProgressStepper({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        currentStep >= 1 ? 'bg-adventure-500 text-white' : 'bg-slate-200 text-slate-400'
      }`}>1</div>
      <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-adventure-500 rounded-full transition-all duration-500"
          style={{ width: currentStep >= 2 ? '100%' : '0%' }}
        />
      </div>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        currentStep >= 2 ? 'bg-adventure-500 text-white' : 'bg-slate-200 text-slate-400'
      }`}>2</div>
    </div>
  );
}

// ── Field: individual bordered input ──────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full h-12 border border-slate-200 rounded-xl px-4 text-slate-900 placeholder-slate-400 bg-white ' +
  'focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all text-sm';

const dateInputCls =
  'flex-1 h-11 border border-slate-200 rounded-xl px-3 text-slate-900 bg-white ' +
  'focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all text-sm [color-scheme:light]';

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
  const [outboundFlightData, setOutboundFlightData] = useState<FlightData | null>(null);
  const [returnFlightData, setReturnFlightData] = useState<FlightData | null>(null);

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
        outboundFlightData: outboundFlightData ?? undefined,
        returnFlightData: returnFlightData ?? undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <ProgressStepper currentStep={1} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Nuevo viaje</h1>
        <p className="text-slate-500 text-sm mt-1">Cuéntale al agente lo que buscas</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        <Field label="Nombre del viaje *">
          <input
            type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Sudeste Asiático 2026" required maxLength={200} autoFocus
            className={inputCls}
          />
        </Field>

        <Field
          label="Región o destino general *"
          hint="El agente propondrá los países y ciudades específicos"
        >
          <input
            type="text" value={destination} onChange={(e) => setDestination(e.target.value)}
            placeholder="Ej: Europa del Este, Sudeste Asiático, Perú" required maxLength={300}
            className={inputCls}
          />
        </Field>

        {/* Dates side by side */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha de inicio *">
            <input
              type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              required className={dateInputCls + ' w-full'}
            />
          </Field>
          <Field label="Fecha de fin *">
            <input
              type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              min={startDate} required className={dateInputCls + ' w-full'}
            />
          </Field>
        </div>

        <Field
          label="¿Qué buscan en este viaje?"
          hint="El agente leerá esto para personalizar tu itinerario"
        >
          <textarea
            value={tripNotes} onChange={(e) => setTripNotes(e.target.value)}
            placeholder="Ej: Queremos combinar naturaleza y cultura, con algo de aventura. Nos importa mucho la gastronomía local y preferimos evitar las rutas turísticas masivas..."
            rows={4} maxLength={3000}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all text-sm resize-none leading-relaxed"
          />
        </Field>

        {/* Flight status */}
        <div>
          <label className="text-sm font-semibold text-slate-700 block mb-2">Estado de vuelos</label>
          <div className="space-y-2">
            {([
              { value: 'none',      label: 'Sin vuelos aún',           desc: 'Las fechas son aproximadas' },
              { value: 'tentative', label: 'Fechas tentativas',         desc: 'Vuelos sin reservar aún' },
              { value: 'booked',    label: 'Vuelos ya reservados',      desc: 'Tengo los datos del vuelo' },
            ] as const).map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setFlightStatus(opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border cursor-pointer ${
                  flightStatus === opt.value
                    ? 'bg-sky-50 border-sky-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold text-sm ${flightStatus === opt.value ? 'text-sky-700' : 'text-slate-900'}`}>
                      {opt.label}
                    </div>
                    <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
                  </div>
                  {flightStatus === opt.value && (
                    <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>

          {flightStatus === 'tentative' && (
            <div className="mt-3 bg-sky-50 rounded-xl p-4 border border-sky-100 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Salida aprox.</label>
                  <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Regreso aprox.</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                </div>
              </div>
            </div>
          )}

          {flightStatus === 'booked' && (
            <div className="mt-3 bg-sky-50 rounded-xl p-4 border border-sky-100 space-y-3">
              <FlightInput
                label="Vuelo de salida"
                onConfirm={(data, formatted) => {
                  setOutboundFlightData(data);
                  setOutboundFlight(formatted);
                  // Auto-suggest departure date from trip start date
                  if (!outboundDate && startDate) setOutboundDate(startDate);
                }}
                onClear={() => { setOutboundFlightData(null); setOutboundFlight(''); }}
              />
              {outboundFlightData && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha del vuelo de salida</label>
                  <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                </div>
              )}

              <FlightInput
                label="Vuelo de regreso"
                onConfirm={(data, formatted) => {
                  setReturnFlightData(data);
                  setReturnFlight(formatted);
                  if (!returnDate && endDate) setReturnDate(endDate);
                }}
                onClear={() => { setReturnFlightData(null); setReturnFlight(''); }}
              />
              {returnFlightData && (
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1.5">Fecha del vuelo de regreso</label>
                  <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !title || !destination || !startDate || !endDate}
          className="w-full h-12 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl active:scale-95 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creando...
            </>
          ) : 'Continuar — Mi perfil'}
        </button>

        <button type="button" onClick={() => router.back()}
          className="w-full h-11 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors cursor-pointer">
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
  outboundDate,
  outboundFlightData,
  returnDate,
  returnFlightData,
}: {
  tripId: string;
  tripTitle: string;
  startDate: string;
  endDate: string;
  outboundDate?: string;
  outboundFlightData?: FlightData;
  returnDate?: string;
  returnFlightData?: FlightData;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-populate from flight data if available
  const initArrivalDate = outboundFlightData && outboundDate
    ? addDays(outboundDate, outboundFlightData.nextDay ? 1 : 0)
    : startDate;
  const initArrivalTime = outboundFlightData?.arrTime ?? '';
  const initDepartureDate = returnDate || endDate;
  const initDepartureTime = returnFlightData?.depTime ?? '';

  const [arrivalDate, setArrivalDate] = useState(initArrivalDate);
  const [arrivalTime, setArrivalTime] = useState(initArrivalTime);
  const [departureDate, setDepartureDate] = useState(initDepartureDate);
  const [departureTime, setDepartureTime] = useState(initDepartureTime);
  const [dietType, setDietType] = useState('');
  const [foodAllergies, setFoodAllergies] = useState('');
  const [travelPace, setTravelPace] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [budgetRange, setBudgetRange] = useState('');
  const [otherInput, setOtherInput] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const otherRef = useRef<HTMLInputElement>(null);

  function toggleInterest(i: string) {
    setInterests((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  function addOtherInterest() {
    const val = otherInput.trim();
    if (val && !interests.includes(val)) {
      setInterests((prev) => [...prev, val]);
    }
    setOtherInput('');
    setShowOtherInput(false);
  }

  useEffect(() => {
    if (showOtherInput) otherRef.current?.focus();
  }, [showOtherInput]);

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
    <div className="space-y-5 animate-fade-in">
      <ProgressStepper currentStep={2} />

      <div>
        <h1 className="text-xl font-bold text-slate-900">Tu perfil viajero</h1>
        <p className="text-adventure-500 font-semibold text-sm truncate">{tripTitle}</p>
        <p className="text-slate-500 text-xs mt-1">El agente usará esto para personalizar el itinerario</p>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Arrival & Departure */}
        <ProfileSection title="Llegada y salida personal" color="sky" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        }>
          {(outboundFlightData || returnFlightData) && (
            <div className="flex items-center gap-1.5 mb-3 px-3 py-2 bg-sky-50 border border-sky-100 rounded-lg">
              <svg className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-xs text-sky-600 font-medium">Auto-completado desde tu vuelo — puedes ajustar si es necesario</p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Llego al destino</label>
              <div className="flex gap-2">
                <input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)}
                  className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                <input type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-28 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Salgo del destino</label>
              <div className="flex gap-2">
                <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                  className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
                <input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-28 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light]" />
              </div>
            </div>
          </div>
        </ProfileSection>

        {/* Pace */}
        <ProfileSection title="Ritmo de viaje" color="adventure" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        }>
          <div className="space-y-2">
            {PACE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => setTravelPace(travelPace === opt.value ? '' : opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border cursor-pointer ${
                  travelPace === opt.value
                    ? 'bg-adventure-500/5 border-adventure-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold text-sm ${travelPace === opt.value ? 'text-adventure-600' : 'text-slate-900'}`}>{opt.label}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
                  </div>
                  {travelPace === opt.value && (
                    <div className="w-5 h-5 rounded-full bg-adventure-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ProfileSection>

        {/* Budget */}
        <ProfileSection title="Presupuesto" color="amber" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        }>
          <div className="space-y-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                onClick={() => setBudgetRange(budgetRange === opt.value ? '' : opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border cursor-pointer ${
                  budgetRange === opt.value
                    ? 'bg-amber-50 border-amber-300 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold text-sm ${budgetRange === opt.value ? 'text-amber-700' : 'text-slate-900'}`}>{opt.label}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
                  </div>
                  {budgetRange === opt.value && (
                    <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </ProfileSection>

        {/* Diet */}
        <ProfileSection title="Alimentación" color="teal" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        }>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {DIET_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => setDietType(dietType === opt.value ? '' : opt.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                    dietType === opt.value
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Alergias alimentarias</label>
              <input type="text" value={foodAllergies} onChange={(e) => setFoodAllergies(e.target.value)}
                placeholder="Ej: nueces, gluten, mariscos" maxLength={500}
                className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors" />
            </div>
          </div>
        </ProfileSection>

        {/* Interests */}
        <ProfileSection title="Intereses" color="adventure" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        }>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button key={interest} type="button"
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                  interests.includes(interest)
                    ? 'bg-adventure-500 text-white border-adventure-500 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {interest}
              </button>
            ))}
            {/* Custom interests added by user */}
            {interests.filter((i) => !INTEREST_OPTIONS.includes(i)).map((custom) => (
              <span key={custom} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-adventure-500 text-white border border-adventure-500 shadow-sm">
                {custom}
                <button
                  type="button"
                  onClick={() => setInterests((prev) => prev.filter((x) => x !== custom))}
                  className="ml-0.5 hover:text-adventure-200 transition-colors cursor-pointer"
                  aria-label={`Quitar ${custom}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {/* "Otro" button */}
            {!showOtherInput && (
              <button
                type="button"
                onClick={() => setShowOtherInput(true)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-adventure-300 text-adventure-500 hover:bg-adventure-500/5 transition-all cursor-pointer flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Otro
              </button>
            )}
          </div>

          {/* Inline input for custom interest */}
          {showOtherInput && (
            <div className="flex items-center gap-2 mt-3">
              <input
                ref={otherRef}
                type="text"
                value={otherInput}
                onChange={(e) => setOtherInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addOtherInterest(); }
                  if (e.key === 'Escape') { setShowOtherInput(false); setOtherInput(''); }
                }}
                placeholder="Ej: Surf, Arqueología, Jazz..."
                maxLength={50}
                className="flex-1 h-9 border border-adventure-300 rounded-lg px-3 text-slate-900 bg-white text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-adventure-500/20 transition-all"
              />
              <button
                type="button"
                onClick={addOtherInterest}
                disabled={!otherInput.trim()}
                className="h-9 px-3 bg-adventure-500 text-white rounded-lg text-xs font-bold disabled:opacity-40 cursor-pointer hover:bg-adventure-600 transition-colors"
              >
                Agregar
              </button>
              <button
                type="button"
                onClick={() => { setShowOtherInput(false); setOtherInput(''); }}
                className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {interests.length > 0 && (
            <p className="text-xs text-adventure-600 mt-2 font-medium">{interests.length} seleccionados</p>
          )}
        </ProfileSection>

        <button
          type="submit" disabled={loading}
          className="w-full h-12 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl active:scale-95 transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </>
          ) : 'Guardar e ir al viaje'}
        </button>

        <button type="button"
          onClick={() => router.push(`/trips/${tripId}`)}
          className="w-full h-11 text-slate-400 hover:text-slate-600 text-sm font-medium transition-colors cursor-pointer">
          Omitir por ahora
        </button>
      </form>
    </div>
  );
}

// ── Shared section card for profile steps ─────────────────────────────────────

type SectionColor = 'sky' | 'adventure' | 'amber' | 'teal';

const sectionStyles: Record<SectionColor, { iconBg: string; iconText: string }> = {
  sky:       { iconBg: 'bg-sky-100',     iconText: 'text-sky-600' },
  adventure: { iconBg: 'bg-orange-100',  iconText: 'text-adventure-500' },
  amber:     { iconBg: 'bg-amber-100',   iconText: 'text-amber-600' },
  teal:      { iconBg: 'bg-teal-100',    iconText: 'text-teal-600' },
};

function ProfileSection({
  title,
  color,
  icon,
  children,
}: {
  title: string;
  color: SectionColor;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const s = sectionStyles[color];
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-card">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
          <span className={`w-4 h-4 ${s.iconText}`}>{icon}</span>
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
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
      outboundDate={tripFields!.outboundDate || undefined}
      outboundFlightData={tripFields!.outboundFlightData}
      returnDate={tripFields!.returnDate || undefined}
      returnFlightData={tripFields!.returnFlightData}
    />
  );
}
