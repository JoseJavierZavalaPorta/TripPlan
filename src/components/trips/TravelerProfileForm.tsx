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
  { value: 'omnivore', label: 'Omnívoro' },
  { value: 'vegetarian', label: 'Vegetariano' },
  { value: 'vegan', label: 'Vegano' },
  { value: 'pescatarian', label: 'Pescetariano' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
  { value: 'other', label: 'Otro' },
];

const PACE_OPTIONS = [
  { value: 'slow', label: 'Tranquilo', desc: 'Pocas actividades, mucho tiempo libre' },
  { value: 'moderate', label: 'Moderado', desc: 'Balance entre actividades y descanso' },
  { value: 'fast', label: 'Intenso', desc: 'Máximo aprovechamiento del tiempo' },
];

const BUDGET_OPTIONS = [
  { value: 'budget', label: 'Económico', desc: 'Hostales, comida local, transporte público' },
  { value: 'mid', label: 'Intermedio', desc: 'Hoteles 3★, restaurantes variados' },
  { value: 'luxury', label: 'Premium', desc: 'Hoteles 4-5★, experiencias exclusivas' },
];

const INTEREST_OPTIONS = [
  'Museos', 'Arte', 'Historia', 'Gastronomía', 'Aventura', 'Naturaleza',
  'Playa', 'Montaña', 'Compras', 'Vida nocturna', 'Fotografía', 'Deportes',
  'Bienestar', 'Arquitectura', 'Mercados', 'Festivales',
];

export function TravelerProfileForm({
  tripId,
  tripTitle,
  existingProfile,
}: TravelerProfileFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const [arrivalDate, setArrivalDate] = useState(existingProfile?.arrivalDate ?? '');
  const [arrivalTime, setArrivalTime] = useState(existingProfile?.arrivalTime ?? '');
  const [departureDate, setDepartureDate] = useState(existingProfile?.departureDate ?? '');
  const [departureTime, setDepartureTime] = useState(existingProfile?.departureTime ?? '');
  const [dietType, setDietType] = useState(existingProfile?.dietType ?? '');
  const [foodAllergies, setFoodAllergies] = useState(existingProfile?.foodAllergies ?? '');
  const [cuisinePrefs, setCuisinePrefs] = useState(existingProfile?.cuisinePrefs ?? '');
  const [mobilityNeeds, setMobilityNeeds] = useState(existingProfile?.mobilityNeeds ?? '');
  const [travelPace, setTravelPace] = useState(existingProfile?.travelPace ?? '');
  const [interests, setInterests] = useState<string[]>(existingProfile?.interests ?? []);
  const [budgetRange, setBudgetRange] = useState(existingProfile?.budgetRange ?? '');
  const [specialRequests, setSpecialRequests] = useState(existingProfile?.specialRequests ?? '');

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/trips/${tripId}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Mi perfil viajero</h1>
          <p className="text-slate-400 text-sm truncate">{tripTitle}</p>
        </div>
      </div>

      {saved && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-green-400 text-sm text-center">
          Perfil guardado. Redirigiendo...
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Dates */}
        <Section title="Mis fechas de viaje">
          <div className="space-y-3">
            <div>
              <label className="field-label">Llegada al destino</label>
              <div className="flex gap-3 mt-1">
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-24 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                  />
                  <span className="text-slate-500 text-xs">opcional</span>
                </div>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <label className="field-label">Salida del país</label>
              <div className="flex gap-3 mt-1">
                <input
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
                  className="flex-1 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-24 bg-transparent text-white text-sm outline-none [color-scheme:dark]"
                  />
                  <span className="text-slate-500 text-xs">opcional</span>
                </div>
              </div>
              <p className="text-slate-600 text-xs mt-1.5">
                La IA ajustará el último día para que llegues al aeropuerto a tiempo
              </p>
            </div>
          </div>
        </Section>

        {/* Diet */}
        <Section title="Preferencias alimentarias">
          <div className="space-y-3">
            <div>
              <label className="field-label">Tipo de dieta</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {DIET_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDietType(dietType === opt.value ? '' : opt.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      dietType === opt.value
                        ? 'bg-sky-400 text-navy-900'
                        : 'bg-slate-700/50 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-700 pt-3">
              <label className="field-label">Alergias alimentarias</label>
              <input
                type="text"
                value={foodAllergies}
                onChange={(e) => setFoodAllergies(e.target.value)}
                placeholder="Ej: nueces, mariscos, gluten"
                className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none mt-1"
              />
            </div>
            <div className="border-t border-slate-700 pt-3">
              <label className="field-label">Cocinas favoritas</label>
              <input
                type="text"
                value={cuisinePrefs}
                onChange={(e) => setCuisinePrefs(e.target.value)}
                placeholder="Ej: italiana, peruana, japonesa"
                className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none mt-1"
              />
            </div>
          </div>
        </Section>

        {/* Accessibility */}
        <Section title="Necesidades de accesibilidad">
          <div>
            <label className="field-label">Movilidad</label>
            <input
              type="text"
              value={mobilityNeeds}
              onChange={(e) => setMobilityNeeds(e.target.value)}
              placeholder="Ej: uso silla de ruedas, evitar escaleras largas"
              className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none mt-1"
            />
          </div>
        </Section>

        {/* Travel pace */}
        <Section title="Ritmo de viaje">
          <div className="space-y-2">
            {PACE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTravelPace(travelPace === opt.value ? '' : opt.value)}
                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                  travelPace === opt.value
                    ? 'bg-sky-400/10 border-sky-400/40'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className={`font-semibold text-sm ${travelPace === opt.value ? 'text-sky-400' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Interests */}
        <Section title="Intereses">
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((interest) => (
              <button
                key={interest}
                type="button"
                onClick={() => toggleInterest(interest)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  interests.includes(interest)
                    ? 'bg-amber-400 text-navy-900'
                    : 'bg-slate-700/50 text-slate-400 hover:text-white'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </Section>

        {/* Budget */}
        <Section title="Rango de presupuesto">
          <div className="space-y-2">
            {BUDGET_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setBudgetRange(budgetRange === opt.value ? '' : opt.value)}
                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                  budgetRange === opt.value
                    ? 'bg-amber-400/10 border-amber-400/40'
                    : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                }`}
              >
                <div className={`font-semibold text-sm ${budgetRange === opt.value ? 'text-amber-400' : 'text-white'}`}>
                  {opt.label}
                </div>
                <div className="text-slate-500 text-xs mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Special requests */}
        <Section title="Peticiones especiales">
          <textarea
            value={specialRequests}
            onChange={(e) => setSpecialRequests(e.target.value)}
            placeholder="Cualquier otra información relevante para planificar tu viaje..."
            rows={4}
            maxLength={5000}
            className="w-full bg-transparent text-white text-sm placeholder-slate-600 outline-none resize-none"
          />
        </Section>

        <button
          type="submit"
          disabled={loading || saved}
          className="w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? 'Guardando...' : saved ? 'Guardado!' : 'Guardar perfil'}
        </button>
      </form>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-navy-800 rounded-xl p-4 border border-slate-700/50">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}
