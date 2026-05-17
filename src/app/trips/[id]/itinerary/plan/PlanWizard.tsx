'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PlanningQuestion, ProposedDestination, CityGroup, CityAssignment } from '@/lib/oci-ai';

// ── Types ─────────────────────────────────────────────────────────────────────

type Stage =
  | 'loading-questions'
  | 'questions'
  | 'loading-destinations'
  | 'destinations'
  | 'loading-cities'
  | 'cities'
  | 'generating'
  | 'done';

interface DayProgress {
  dayNumber: number;
  dayDate: string;
  itemCount: number;
  city?: string;
  country?: string;
  done: boolean;
}

interface PlanWizardProps {
  tripId: string;
  tripTitle: string;
  destination: string;
  totalDays: number;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function buildCityAssignments(
  selectedDestinations: { country: string; flag: string; days: number }[],
  selectedCities: Record<string, string[]>,
  cityGroups: CityGroup[],
): CityAssignment[] {
  const assignments: CityAssignment[] = [];
  for (const dest of selectedDestinations) {
    const cities = selectedCities[dest.country] ?? [];
    if (cities.length === 0) {
      // fallback: no city selection, use country name
      for (let d = 0; d < dest.days; d++) {
        assignments.push({ city: dest.country, country: dest.country, flag: dest.flag });
      }
      continue;
    }
    const daysPerCity = Math.floor(dest.days / cities.length);
    const remainder   = dest.days % cities.length;
    cities.forEach((cityName, idx) => {
      const cityDays = daysPerCity + (idx < remainder ? 1 : 0);
      for (let d = 0; d < cityDays; d++) {
        assignments.push({ city: cityName, country: dest.country, flag: dest.flag });
      }
    });
  }
  return assignments;
}

function cityDaysPreview(
  country: string,
  cities: string[],
  countryDays: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  if (cities.length === 0) return result;
  const perCity  = Math.floor(countryDays / cities.length);
  const remainder = countryDays % cities.length;
  cities.forEach((c, i) => { result[c] = perCity + (i < remainder ? 1 : 0); });
  return result;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function PlanWizard({ tripId, tripTitle, destination, totalDays }: PlanWizardProps) {
  const router = useRouter();

  const [stage, setStage]                           = useState<Stage>('loading-questions');
  const [questions, setQuestions]                   = useState<PlanningQuestion[]>([]);
  const [answers, setAnswers]                       = useState<Record<string, string | string[]>>({});
  const [proposedDestinations, setProposedDests]    = useState<ProposedDestination[]>([]);
  const [selectedDestIds, setSelectedDestIds]       = useState<Set<string>>(new Set());
  const [destinationDays, setDestinationDays]       = useState<Record<string, number>>({});
  const [cityGroups, setCityGroups]                 = useState<CityGroup[]>([]);
  const [selectedCities, setSelectedCities]         = useState<Record<string, string[]>>({});
  const [progress, setProgress]                     = useState<DayProgress[]>([]);
  const [totalDaysSSE, setTotalDaysSSE]             = useState(totalDays);
  const [generationError, setGenerationError]       = useState('');
  const [apiError, setApiError]                     = useState('');

  // ── Stage: load questions ────────────────────────────────────────────────

  useEffect(() => {
    if (stage !== 'loading-questions') return;
    (async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary/plan/questions`, { method: 'POST' });
        const json = await res.json() as { data?: PlanningQuestion[]; error?: string };
        if (!res.ok) { setApiError(json.error ?? 'Error al cargar preguntas'); return; }
        setQuestions(json.data ?? []);
        setStage('questions');
      } catch {
        setApiError('Error de conexión al cargar preguntas');
      }
    })();
  }, [stage, tripId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const submitAnswers = useCallback(async () => {
    setApiError('');
    setStage('loading-destinations');
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/plan/destinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json() as { data?: ProposedDestination[]; error?: string };
      if (!res.ok) { setApiError(json.error ?? 'Error al proponer destinos'); setStage('questions'); return; }
      const dests = json.data ?? [];
      setProposedDests(dests);
      // Pre-select all and set recommended days
      setSelectedDestIds(new Set(dests.map((d) => d.country)));
      const days: Record<string, number> = {};
      dests.forEach((d) => { days[d.country] = d.recommendedDays; });
      setDestinationDays(days);
      setStage('destinations');
    } catch {
      setApiError('Error de conexión al proponer destinos');
      setStage('questions');
    }
  }, [tripId, answers]);

  const submitDestinations = useCallback(async () => {
    setApiError('');
    const selected = proposedDestinations.filter((d) => selectedDestIds.has(d.country));
    if (selected.length === 0) { setApiError('Selecciona al menos un destino'); return; }
    const totalAssigned = selected.reduce((s, d) => s + (destinationDays[d.country] ?? 0), 0);
    if (totalAssigned !== totalDays) {
      setApiError(`Los días asignados (${totalAssigned}) deben sumar exactamente ${totalDays}`);
      return;
    }
    setStage('loading-cities');
    try {
      const payload = selected.map((d) => ({
        country: d.country,
        flag: d.flag,
        days: destinationDays[d.country] ?? d.recommendedDays,
      }));
      const res = await fetch(`/api/trips/${tripId}/itinerary/plan/cities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedDestinations: payload }),
      });
      const json = await res.json() as { data?: CityGroup[]; error?: string };
      if (!res.ok) { setApiError(json.error ?? 'Error al proponer ciudades'); setStage('destinations'); return; }
      const groups = json.data ?? [];
      setCityGroups(groups);
      // Pre-select recommended cities
      const sel: Record<string, string[]> = {};
      groups.forEach((g) => {
        sel[g.country] = g.cities.slice(0, 2).map((c) => c.name);
      });
      setSelectedCities(sel);
      setStage('cities');
    } catch {
      setApiError('Error de conexión al proponer ciudades');
      setStage('destinations');
    }
  }, [tripId, proposedDestinations, selectedDestIds, destinationDays, totalDays]);

  const startGeneration = useCallback(async () => {
    setApiError('');
    setGenerationError('');
    setProgress([]);

    const selected = proposedDestinations.filter((d) => selectedDestIds.has(d.country));
    const cityAssignments = buildCityAssignments(
      selected.map((d) => ({ country: d.country, flag: d.flag, days: destinationDays[d.country] ?? d.recommendedDays })),
      selectedCities,
      cityGroups,
    );

    setStage('generating');

    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityAssignments }),
      });

      if (!response.ok) {
        const err = await response.json() as { error?: string };
        setGenerationError(err.error ?? 'Error al iniciar la generación');
        setStage('cities');
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            try {
              const data = JSON.parse(raw);
              if (currentEvent === 'start') {
                setTotalDaysSSE(data.totalDays ?? totalDays);
              } else if (currentEvent === 'day_complete') {
                setProgress((prev) => [...prev, { ...data, done: true }]);
              } else if (currentEvent === 'done') {
                setStage('done');
              } else if (currentEvent === 'error') {
                setGenerationError(data.message ?? 'Error desconocido');
              }
            } catch { /* ignore malformed SSE data */ }
          }
        }
      }
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Error de conexión');
      setStage('cities');
    }
  }, [tripId, proposedDestinations, selectedDestIds, destinationDays, selectedCities, cityGroups, totalDays]);

  // ── Render ────────────────────────────────────────────────────────────────

  const assignedTotal = Array.from(selectedDestIds).reduce(
    (s, c) => s + (destinationDays[c] ?? 0),
    0
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/trips/${tripId}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Planificar viaje</h1>
          <p className="text-slate-400 text-xs truncate max-w-[220px]">{tripTitle}</p>
        </div>
      </div>

      {/* Progress indicator */}
      <StageIndicator stage={stage} />

      {/* API error */}
      {apiError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {apiError}
        </div>
      )}

      {/* ── Stage content ── */}

      {(stage === 'loading-questions' || stage === 'loading-destinations' || stage === 'loading-cities') && (
        <LoadingCard stage={stage} />
      )}

      {stage === 'questions' && (
        <QuestionsStage
          questions={questions}
          answers={answers}
          onChangeAnswer={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
          onSubmit={submitAnswers}
        />
      )}

      {stage === 'destinations' && (
        <DestinationsStage
          destinations={proposedDestinations}
          selectedIds={selectedDestIds}
          destinationDays={destinationDays}
          totalDays={totalDays}
          assignedTotal={assignedTotal}
          onToggle={(country) => {
            setSelectedDestIds((prev) => {
              const next = new Set(prev);
              if (next.has(country)) next.delete(country); else next.add(country);
              return next;
            });
          }}
          onSetDays={(country, days) => setDestinationDays((prev) => ({ ...prev, [country]: days }))}
          onSubmit={submitDestinations}
        />
      )}

      {stage === 'cities' && (
        <CitiesStage
          cityGroups={cityGroups}
          selectedDestinations={proposedDestinations.filter((d) => selectedDestIds.has(d.country))}
          destinationDays={destinationDays}
          selectedCities={selectedCities}
          onToggleCity={(country, city) => {
            setSelectedCities((prev) => {
              const cur = prev[country] ?? [];
              const next = cur.includes(city) ? cur.filter((c) => c !== city) : [...cur, city];
              return { ...prev, [country]: next };
            });
          }}
          onSubmit={startGeneration}
          error={generationError}
        />
      )}

      {stage === 'generating' && (
        <GeneratingStage
          progress={progress}
          totalDays={totalDaysSSE}
          error={generationError}
          onRetry={() => { setStage('cities'); setGenerationError(''); }}
        />
      )}

      {stage === 'done' && (
        <DoneStage
          daysGenerated={progress.length}
          tripId={tripId}
          onViewItinerary={() => router.push(`/trips/${tripId}`)}
        />
      )}
    </div>
  );
}

// ── Stage Indicator ────────────────────────────────────────────────────────────

const STAGE_STEPS = ['questions', 'destinations', 'cities', 'generating', 'done'] as const;
const STAGE_LABELS: Record<string, string> = {
  questions: 'Preferencias',
  destinations: 'Países',
  cities: 'Ciudades',
  generating: 'Generando',
  done: 'Listo',
};

function StageIndicator({ stage }: { stage: Stage }) {
  const current = STAGE_STEPS.findIndex((s) => stage.includes(s)) + 1 || 1;
  return (
    <div className="flex items-center gap-1">
      {STAGE_STEPS.map((s, i) => {
        const step = i + 1;
        const active = step === current;
        const done   = step < current;
        return (
          <div key={s} className="flex items-center flex-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
              done   ? 'bg-teal-400 text-navy-900' :
              active ? 'bg-sky-400 text-navy-900'  :
                       'bg-slate-700 text-slate-500'
            }`}>
              {done ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : step}
            </div>
            {i < STAGE_STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-teal-400' : 'bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Loading Card ───────────────────────────────────────────────────────────────

const LOADING_MESSAGES: Record<string, { title: string; subtitle: string }> = {
  'loading-questions': { title: 'Preparando preguntas...', subtitle: 'La IA está personalizando las preguntas para tu destino' },
  'loading-destinations': { title: 'Analizando tus preferencias...', subtitle: 'La IA propone los mejores países para ti' },
  'loading-cities': { title: 'Seleccionando ciudades...', subtitle: 'La IA elige las mejores ciudades por ruta' },
};

function LoadingCard({ stage }: { stage: Stage }) {
  const { title, subtitle } = LOADING_MESSAGES[stage] ?? { title: 'Cargando...', subtitle: '' };
  return (
    <div className="bg-navy-800 rounded-2xl p-8 border border-slate-700/50 flex flex-col items-center text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-sky-400/10 flex items-center justify-center">
        <svg className="w-7 h-7 text-sky-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </div>
      <div>
        <h3 className="text-white font-semibold">{title}</h3>
        <p className="text-slate-400 text-sm mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

// ── Questions Stage ────────────────────────────────────────────────────────────

function QuestionsStage({
  questions,
  answers,
  onChangeAnswer,
  onSubmit,
}: {
  questions: PlanningQuestion[];
  answers: Record<string, string | string[]>;
  onChangeAnswer: (id: string, val: string | string[]) => void;
  onSubmit: () => void;
}) {
  const allAnswered = questions.every((q) => {
    const a = answers[q.id];
    if (q.type === 'text') return typeof a === 'string' && a.trim().length > 0;
    return Array.isArray(a) ? a.length > 0 : (typeof a === 'string' && a.length > 0);
  });

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50">
        <h2 className="text-white font-semibold mb-1">Cuéntanos sobre ti</h2>
        <p className="text-slate-400 text-sm">La IA usará tus respuestas para proponer los mejores destinos.</p>
      </div>

      {questions.map((q) => (
        <div key={q.id} className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50 space-y-3">
          <p className="text-white text-sm font-medium leading-snug">{q.question}</p>

          {q.type === 'text' ? (
            <textarea
              value={(answers[q.id] as string) ?? ''}
              onChange={(e) => onChangeAnswer(q.id, e.target.value)}
              placeholder="Tu respuesta..."
              rows={3}
              className="w-full bg-navy-900/60 border border-slate-600/50 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-sky-400 resize-none"
            />
          ) : q.type === 'multiple' ? (
            <div className="flex flex-wrap gap-2">
              {(q.options ?? []).map((opt) => {
                const cur = (answers[q.id] as string[]) ?? [];
                const selected = cur.includes(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      const next = selected ? cur.filter((o) => o !== opt) : [...cur, opt];
                      onChangeAnswer(q.id, next);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      selected
                        ? 'bg-sky-400 text-navy-900 border-sky-400'
                        : 'bg-navy-900/60 text-slate-300 border-slate-600/50'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {(q.options ?? []).map((opt) => {
                const selected = answers[q.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => onChangeAnswer(q.id, opt)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors flex items-center gap-2.5 ${
                      selected
                        ? 'bg-sky-400/10 text-sky-300 border-sky-400/40'
                        : 'bg-navy-900/60 text-slate-300 border-slate-600/50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                      selected ? 'border-sky-400 bg-sky-400' : 'border-slate-500'
                    }`} />
                    {opt}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="w-full h-13 py-3.5 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
      >
        Proponer destinos
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ── Destinations Stage ─────────────────────────────────────────────────────────

function DestinationsStage({
  destinations,
  selectedIds,
  destinationDays,
  totalDays,
  assignedTotal,
  onToggle,
  onSetDays,
  onSubmit,
}: {
  destinations: ProposedDestination[];
  selectedIds: Set<string>;
  destinationDays: Record<string, number>;
  totalDays: number;
  assignedTotal: number;
  onToggle: (country: string) => void;
  onSetDays: (country: string, days: number) => void;
  onSubmit: () => void;
}) {
  const allGood = assignedTotal === totalDays && selectedIds.size > 0;

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50 flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Destinos recomendados</h2>
          <p className="text-slate-400 text-xs mt-0.5">Selecciona los países y ajusta los días</p>
        </div>
        <div className={`text-sm font-bold px-3 py-1 rounded-full ${
          allGood ? 'bg-teal-400/10 text-teal-400' : 'bg-amber-400/10 text-amber-400'
        }`}>
          {assignedTotal}/{totalDays}d
        </div>
      </div>

      {destinations.map((dest) => {
        const selected = selectedIds.has(dest.country);
        const days = destinationDays[dest.country] ?? dest.recommendedDays;
        return (
          <div
            key={dest.country}
            className={`bg-navy-800 rounded-2xl border transition-colors ${
              selected ? 'border-sky-400/40' : 'border-slate-700/50'
            }`}
          >
            <button
              onClick={() => onToggle(dest.country)}
              className="w-full p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                  selected ? 'bg-sky-400 border-sky-400' : 'border-slate-500'
                }`}>
                  {selected && (
                    <svg className="w-3 h-3 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-2xl">{dest.flag}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold">{dest.country}</div>
                  <div className="text-slate-400 text-xs truncate">{dest.description}</div>
                </div>
              </div>

              {dest.highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pl-8">
                  {dest.highlights.slice(0, 3).map((h) => (
                    <span key={h} className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{h}</span>
                  ))}
                </div>
              )}
            </button>

            {selected && (
              <div className="flex items-center gap-3 px-4 pb-4 pl-12">
                <span className="text-slate-400 text-sm flex-1">Días:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onSetDays(dest.country, Math.max(1, days - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center text-lg font-bold active:scale-95"
                  >
                    −
                  </button>
                  <span className="text-white font-bold w-6 text-center">{days}</span>
                  <button
                    onClick={() => onSetDays(dest.country, days + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-700 text-white flex items-center justify-center text-lg font-bold active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {assignedTotal !== totalDays && selectedIds.size > 0 && (
        <p className="text-amber-400 text-sm text-center">
          {assignedTotal < totalDays
            ? `Faltan ${totalDays - assignedTotal} días por asignar`
            : `Tienes ${assignedTotal - totalDays} días extra — reduce algún destino`}
        </p>
      )}

      <button
        onClick={onSubmit}
        disabled={!allGood}
        className="w-full py-3.5 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
      >
        Elegir ciudades
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}

// ── Cities Stage ───────────────────────────────────────────────────────────────

function CitiesStage({
  cityGroups,
  selectedDestinations,
  destinationDays,
  selectedCities,
  onToggleCity,
  onSubmit,
  error,
}: {
  cityGroups: CityGroup[];
  selectedDestinations: ProposedDestination[];
  destinationDays: Record<string, number>;
  selectedCities: Record<string, string[]>;
  onToggleCity: (country: string, city: string) => void;
  onSubmit: () => void;
  error: string;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50">
        <h2 className="text-white font-semibold">Ciudades a visitar</h2>
        <p className="text-slate-400 text-xs mt-0.5">Selecciona las ciudades para cada país</p>
      </div>

      {cityGroups.map((group) => {
        const countryDays = destinationDays[group.country] ?? 0;
        const selCities   = selectedCities[group.country] ?? [];
        const dayMap      = cityDaysPreview(group.country, selCities, countryDays);

        return (
          <div key={group.country} className="bg-navy-800 rounded-2xl border border-slate-700/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-navy-900/40">
              <span className="text-xl">{group.flag}</span>
              <span className="text-white font-semibold">{group.country}</span>
              <span className="text-slate-400 text-xs ml-auto">{countryDays} días</span>
            </div>

            <div className="p-3 space-y-2">
              {group.cities.map((city) => {
                const selected = selCities.includes(city.name);
                const daysForCity = dayMap[city.name];
                return (
                  <button
                    key={city.name}
                    onClick={() => onToggleCity(group.country, city.name)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      selected
                        ? 'bg-sky-400/10 border-sky-400/30'
                        : 'bg-navy-900/40 border-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        selected ? 'bg-sky-400 border-sky-400' : 'border-slate-500'
                      }`}>
                        {selected && (
                          <svg className="w-2.5 h-2.5 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${selected ? 'text-sky-300' : 'text-white'}`}>
                            {city.name}
                          </span>
                          {selected && daysForCity !== undefined && (
                            <span className="text-xs text-sky-400 font-medium">{daysForCity}d</span>
                          )}
                        </div>
                        <p className="text-slate-500 text-xs truncate">{city.description}</p>
                      </div>
                    </div>
                    {selected && city.mustSee.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2 pl-6">
                        {city.mustSee.slice(0, 3).map((m) => (
                          <span key={m} className="text-xs text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">{m}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={onSubmit}
        className="w-full py-3.5 bg-teal-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Generar itinerario con IA
      </button>
    </div>
  );
}

// ── Generating Stage ───────────────────────────────────────────────────────────

function GeneratingStage({
  progress,
  totalDays,
  error,
  onRetry,
}: {
  progress: DayProgress[];
  totalDays: number;
  error: string;
  onRetry: () => void;
}) {
  const currentDay = progress.length + 1;

  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Generando itinerario</h2>
          <span className="text-sky-400 text-sm font-bold">{progress.length}/{totalDays}</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 to-teal-400 rounded-full transition-all duration-500"
            style={{ width: `${Math.round((progress.length / totalDays) * 100)}%` }}
          />
        </div>
        {!error && progress.length < totalDays && (
          <p className="text-slate-400 text-xs mt-2">
            Planificando día {currentDay}...
          </p>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm text-sky-400 font-semibold"
          >
            ← Volver y reintentar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {/* Future days (skeleton) */}
        {Array.from({ length: Math.max(0, totalDays - progress.length) }).map((_, i) => {
          const dayNum = progress.length + i + 1;
          const isCurrent = i === 0 && !error;
          return (
            <div
              key={`pending-${dayNum}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                isCurrent
                  ? 'bg-sky-400/5 border-sky-400/20'
                  : 'bg-navy-800/40 border-slate-700/30'
              }`}
            >
              {isCurrent ? (
                <svg className="w-4 h-4 text-sky-400 animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-slate-600 flex-shrink-0" />
              )}
              <span className={`text-sm ${isCurrent ? 'text-sky-300' : 'text-slate-600'}`}>
                Día {dayNum}
              </span>
            </div>
          );
        })}

        {/* Completed days (reversed to show newest first) */}
        {[...progress].reverse().map((day) => (
          <div
            key={day.dayNumber}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-400/5 border border-teal-400/20"
          >
            <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">Día {day.dayNumber}</span>
                {day.city && (
                  <span className="text-teal-400 text-xs">{day.city}</span>
                )}
              </div>
              <span className="text-slate-500 text-xs">{day.itemCount} actividades · {day.dayDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Done Stage ─────────────────────────────────────────────────────────────────

function DoneStage({
  daysGenerated,
  tripId,
  onViewItinerary,
}: {
  daysGenerated: number;
  tripId: string;
  onViewItinerary: () => void;
}) {
  return (
    <div className="space-y-5 animate-slide-up">
      <div className="bg-teal-400/10 border border-teal-400/30 rounded-2xl p-6 flex flex-col items-center text-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-400/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-white text-xl font-bold">¡Itinerario listo!</h2>
          <p className="text-slate-400 text-sm mt-1">{daysGenerated} días planificados con rutas optimizadas</p>
        </div>
      </div>

      <button
        onClick={onViewItinerary}
        className="w-full py-3.5 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform"
      >
        Ver mi itinerario
      </button>

      <Link
        href={`/trips/${tripId}/itinerary/plan`}
        className="block w-full py-3 text-center text-slate-400 text-sm"
      >
        Regenerar con otros destinos
      </Link>
    </div>
  );
}
