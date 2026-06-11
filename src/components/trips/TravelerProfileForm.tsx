// src/components/trips/TravelerProfileForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TravelerProfile } from '@/types';

interface TravelerProfileFormProps {
  tripId: string;
  tripTitle: string;
  existingProfile: TravelerProfile | null;
}

const DIET_OPTIONS = [
  { value: 'omnivore',    label: 'Omnívoro' },
  { value: 'vegetarian',  label: 'Vegetariano' },
  { value: 'vegan',       label: 'Vegano' },
  { value: 'pescatarian', label: 'Pescetariano' },
  { value: 'halal',       label: 'Halal' },
  { value: 'kosher',      label: 'Kosher' },
  { value: 'other',       label: 'Otro' },
];

const PACE_OPTIONS = [
  { value: 'slow',     label: 'Tranquilo',  desc: 'Pocas actividades, mucho tiempo libre' },
  { value: 'moderate', label: 'Moderado',   desc: 'Balance entre actividades y descanso' },
  { value: 'fast',     label: 'Intenso',    desc: 'Máximo aprovechamiento del tiempo' },
];

const BUDGET_OPTIONS = [
  { value: 'budget', label: 'Económico', desc: 'Hostales, comida local, transporte público' },
  { value: 'mid',    label: 'Intermedio', desc: 'Hoteles 3★, restaurantes variados' },
  { value: 'luxury', label: 'Premium',    desc: 'Hoteles 4-5★, experiencias exclusivas' },
];

const INTEREST_OPTIONS = [
  'Museos', 'Arte', 'Historia', 'Gastronomía', 'Aventura', 'Naturaleza',
  'Playa', 'Montaña', 'Compras', 'Vida nocturna', 'Fotografía', 'Deportes',
  'Bienestar', 'Arquitectura', 'Mercados', 'Festivales',
];

// ── Section accent bar ────────────────────────────────────────────────────────

type SectionColor = 'sky' | 'adventure' | 'amber' | 'teal' | 'rose';

const sectionStyles: Record<SectionColor, { bar: string; icon: string; iconBg: string }> = {
  sky:       { bar: 'bg-sky-400',       icon: 'text-sky-600',       iconBg: 'bg-sky-100' },
  adventure: { bar: 'bg-adventure-500', icon: 'text-adventure-600', iconBg: 'bg-orange-100' },
  amber:     { bar: 'bg-amber-400',     icon: 'text-amber-600',     iconBg: 'bg-amber-100' },
  teal:      { bar: 'bg-teal-500',      icon: 'text-teal-600',      iconBg: 'bg-teal-100' },
  rose:      { bar: 'bg-rose-400',      icon: 'text-rose-600',      iconBg: 'bg-rose-100' },
};

function Section({
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
          <span className={`w-4 h-4 ${s.icon}`}>{icon}</span>
        </div>
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TravelerProfileForm({
  tripId,
  tripTitle,
  existingProfile,
}: TravelerProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [arrivalDate, setArrivalDate]       = useState(existingProfile?.arrivalDate ?? '');
  const [arrivalTime, setArrivalTime]       = useState(existingProfile?.arrivalTime ?? '');
  const [departureDate, setDepartureDate]   = useState(existingProfile?.departureDate ?? '');
  const [departureTime, setDepartureTime]   = useState(existingProfile?.departureTime ?? '');
  const [dietType, setDietType]             = useState(existingProfile?.dietType ?? '');
  const [foodAllergies, setFoodAllergies]   = useState(existingProfile?.foodAllergies ?? '');
  const [cuisinePrefs, setCuisinePrefs]     = useState(existingProfile?.cuisinePrefs ?? '');
  const [mobilityNeeds, setMobilityNeeds]   = useState(existingProfile?.mobilityNeeds ?? '');
  const [travelPace, setTravelPace]         = useState(existingProfile?.travelPace ?? '');
  const [interests, setInterests]           = useState<string[]>(existingProfile?.interests ?? []);
  const [showOtherInterest, setShowOtherInterest] = useState(false);
  const [otherInterestInput, setOtherInterestInput] = useState('');
  const [budgetRange, setBudgetRange]       = useState(existingProfile?.budgetRange ?? '');
  const [specialRequests, setSpecialRequests] = useState(existingProfile?.specialRequests ?? '');

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  }

  function confirmOtherInterest() {
    const val = otherInterestInput.trim();
    if (val && !interests.includes(val)) {
      setInterests((prev) => [...prev, val]);
    }
    setOtherInterestInput('');
    setShowOtherInterest(false);
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
          cuisinePrefs: cuisinePrefs || null,
          mobilityNeeds: mobilityNeeds || null,
          travelPace: travelPace || null,
          interests,
          budgetRange: budgetRange || null,
          specialRequests: specialRequests || null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Error al guardar');
        return;
      }
      setSaved(true);
      setTimeout(() => router.push(`/trips/${tripId}`), 1200);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/trips/${tripId}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-xl shadow-card transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-900">Mi perfil viajero</h1>
          <p className="text-adventure-500 text-sm font-medium truncate">{tripTitle}</p>
        </div>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm text-center font-medium">
          Perfil guardado correctamente — redirigiendo...
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Dates */}
        <Section title="Mis fechas de viaje" color="sky" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        }>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Llegada al destino</label>
              <div className="flex gap-2">
                <input
                  type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)}
                  className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 [color-scheme:light] transition-all"
                />
                <input
                  type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)}
                  className="w-28 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light] transition-all"
                />
                <span className="text-slate-400 text-xs self-center flex-shrink-0">hora</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Salida del país</label>
              <div className="flex gap-2">
                <input
                  type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)}
                  className="flex-1 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 [color-scheme:light] transition-all"
                />
                <input
                  type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-28 h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm focus:outline-none focus:border-sky-500 [color-scheme:light] transition-all"
                />
                <span className="text-slate-400 text-xs self-center flex-shrink-0">hora</span>
              </div>
              <p className="text-slate-400 text-xs mt-1.5">
                La IA ajustará el último día para que llegues al aeropuerto a tiempo
              </p>
            </div>
          </div>
        </Section>

        {/* Travel pace */}
        <Section title="Ritmo de viaje" color="adventure" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
        }>
          <div className="space-y-2">
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setTravelPace(travelPace === opt.value ? '' : opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border cursor-pointer ${
                  travelPace === opt.value
                    ? 'bg-adventure-500/5 border-adventure-300 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold text-sm ${travelPace === opt.value ? 'text-adventure-600' : 'text-slate-800'}`}>
                      {opt.label}
                    </div>
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
        </Section>

        {/* Interests */}
        <Section title="Intereses" color="adventure" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        }>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest} type="button"
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

            {/* Custom interests added via "Otro" */}
            {interests
              .filter((i) => !INTEREST_OPTIONS.includes(i))
              .map((custom) => (
                <span
                  key={custom}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-adventure-500 text-white border-adventure-500 border shadow-sm"
                >
                  {custom}
                  <button
                    type="button"
                    onClick={() => setInterests((prev) => prev.filter((i) => i !== custom))}
                    className="hover:opacity-70 transition-opacity cursor-pointer leading-none flex-shrink-0"
                    aria-label={`Quitar ${custom}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}

            {/* Otro button */}
            {!showOtherInterest ? (
              <button
                type="button"
                onClick={() => setShowOtherInterest(true)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-dashed border-slate-300 text-slate-400 hover:border-adventure-400 hover:text-adventure-500 transition-all cursor-pointer"
              >
                + Otro
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={otherInterestInput}
                  onChange={(e) => setOtherInterestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); confirmOtherInterest(); }
                    if (e.key === 'Escape') { setShowOtherInterest(false); setOtherInterestInput(''); }
                  }}
                  placeholder="Escribe y presiona Enter"
                  className="h-8 px-2.5 text-xs border border-adventure-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-adventure-500/20 bg-white text-slate-900 w-40"
                />
                <button type="button" onClick={confirmOtherInterest}
                  className="h-8 px-2.5 text-xs font-semibold bg-adventure-500 text-white rounded-lg cursor-pointer hover:bg-adventure-600 transition-colors">
                  OK
                </button>
                <button type="button" onClick={() => { setShowOtherInterest(false); setOtherInterestInput(''); }}
                  className="h-8 px-2 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors text-sm">
                  ✕
                </button>
              </div>
            )}
          </div>
          {interests.length > 0 && (
            <p className="text-xs text-adventure-500 font-semibold mt-3">{interests.length} seleccionado{interests.length !== 1 ? 's' : ''}</p>
          )}
        </Section>

        {/* Budget */}
        <Section title="Rango de presupuesto" color="amber" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
          </svg>
        }>
          <div className="space-y-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setBudgetRange(budgetRange === opt.value ? '' : opt.value)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all border cursor-pointer ${
                  budgetRange === opt.value
                    ? 'bg-amber-50 border-amber-300 shadow-sm'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`font-semibold text-sm ${budgetRange === opt.value ? 'text-amber-700' : 'text-slate-800'}`}>
                      {opt.label}
                    </div>
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
        </Section>

        {/* Diet */}
        <Section title="Preferencias alimentarias" color="teal" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
          </svg>
        }>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Tipo de dieta</label>
              <div className="flex flex-wrap gap-2">
                {DIET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value} type="button"
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
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Alergias alimentarias</label>
              <input
                type="text" value={foodAllergies} onChange={(e) => setFoodAllergies(e.target.value)}
                placeholder="Ej: nueces, mariscos, gluten"
                className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1.5">Cocinas favoritas</label>
              <input
                type="text" value={cuisinePrefs} onChange={(e) => setCuisinePrefs(e.target.value)}
                placeholder="Ej: italiana, peruana, japonesa"
                className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm placeholder-slate-400 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>
          </div>
        </Section>

        {/* Accessibility */}
        <Section title="Necesidades de accesibilidad" color="rose" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="4" r="1"/><path d="M9 9h6l-1 5-2 6M9 14l-2 4"/><path d="M15 14l1.5 4a1 1 0 01-.9 1.4h-3"/>
          </svg>
        }>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1.5">Movilidad</label>
            <input
              type="text" value={mobilityNeeds} onChange={(e) => setMobilityNeeds(e.target.value)}
              placeholder="Ej: uso silla de ruedas, evitar escaleras largas"
              className="w-full h-10 border border-slate-200 rounded-lg px-3 text-slate-900 bg-white text-sm placeholder-slate-400 focus:outline-none focus:border-rose-400 transition-colors"
            />
          </div>
        </Section>

        {/* Special requests */}
        <Section title="Peticiones especiales" color="sky" icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        }>
          <textarea
            value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Cualquier otra información relevante para planificar tu viaje..."
            rows={4} maxLength={5000}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-900 bg-white placeholder-slate-400 text-sm focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all resize-none leading-relaxed"
          />
        </Section>

        <button
          type="submit"
          disabled={loading || saved}
          className="w-full h-12 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl active:scale-95 transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </>
          ) : saved ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Guardado
            </>
          ) : 'Guardar perfil'}
        </button>
      </form>
    </div>
  );
}
