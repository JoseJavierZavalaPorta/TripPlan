'use client';

import { useState, useEffect, useCallback } from 'react';
import { ItineraryDay, ItineraryItem, TripMedia, ItemVote, TravelerProfile } from '@/types';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// ── Design tokens ─────────────────────────────────────────────────────────────

const CARD_BG    = '#151e32';
const CARD2_BG   = '#1a2540';
const TEAL       = '#00d4aa';
const TEAL_DIM   = 'rgba(0,212,170,0.12)';
const TEAL_RING  = 'rgba(0,212,170,0.3)';
const BLUE       = '#0ea5e9';
const BLUE_DIM   = 'rgba(14,165,233,0.12)';
const BLUE_RING  = 'rgba(14,165,233,0.3)';
const AMBER      = '#f59e0b';
const AMBER_DIM  = 'rgba(245,158,11,0.08)';
const AMBER_RING = 'rgba(245,158,11,0.3)';

type ItemMeta = { icon: string; label: string; dot: string; tagBg: string; tagColor: string; tagBorder: string };

const TYPE_META: Record<ItineraryItem['itemType'], ItemMeta> = {
  activity:      { icon: '🏛️', label: 'Actividad',    dot: TEAL,  tagBg: TEAL_DIM,  tagColor: TEAL,  tagBorder: TEAL_RING  },
  meal:          { icon: '🍽️', label: 'Comida',       dot: AMBER, tagBg: AMBER_DIM, tagColor: AMBER, tagBorder: AMBER_RING },
  transport:     { icon: '🚌', label: 'Transporte',   dot: BLUE,  tagBg: BLUE_DIM,  tagColor: BLUE,  tagBorder: BLUE_RING  },
  rest:          { icon: '😴', label: 'Descanso',     dot: '#64748b', tagBg: 'rgba(100,116,139,0.1)', tagColor: '#94a3b8', tagBorder: 'rgba(100,116,139,0.3)' },
  accommodation: { icon: '🏨', label: 'Alojamiento',  dot: '#a855f7', tagBg: 'rgba(168,85,247,0.1)',  tagColor: '#c084fc', tagBorder: 'rgba(168,85,247,0.3)' },
  free_time:     { icon: '🎭', label: 'Tiempo libre', dot: '#64748b', tagBg: 'rgba(100,116,139,0.1)', tagColor: '#94a3b8', tagBorder: 'rgba(100,116,139,0.3)' },
};

const CURRENCY: Record<string, string> = { PEN: 'S/', USD: '$', EUR: '€', GBP: '£', CHF: 'CHF' };
const sym = (currency: string) => CURRENCY[currency] ?? currency;

// ── Time helpers ──────────────────────────────────────────────────────────────

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ── Duplicate detection ────────────────────────────────────────────────────────

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(el|la|los|las|un|una|unos|unas|de|del|en|al|a|y|o|por|para|con|al|visita)\b/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findDuplicate(title: string, items: ItineraryItem[]): ItineraryItem | null {
  if (!title.trim() || items.length === 0) return null;
  const words = normalizeForMatch(title).split(' ').filter(w => w.length >= 4);
  if (words.length === 0) return null;
  for (const item of items) {
    const existingWords = normalizeForMatch(item.title).split(' ').filter(w => w.length >= 4);
    if (words.some(w => existingWords.includes(w))) return item;
  }
  return null;
}

// ── AI suggestion type ────────────────────────────────────────────────────────

interface AiSuggestion {
  title: string;
  description: string;
  locationName?: string;
  address?: string;
  estimatedCost?: number;
  notes?: string;
}

// ── DayItinerary — top-level collapsible day card ─────────────────────────────

interface DayItineraryProps {
  day: ItineraryDay;
  tripId: string;
  isLeader: boolean;
  canSuggest: boolean;   // true for members with can_edit=true
  currentUserId: string;
  myProfile: TravelerProfile | null;
  defaultOpen?: boolean;
}

export function DayItinerary({ day, tripId, isLeader, canSuggest, currentUserId, myProfile, defaultOpen = false }: DayItineraryProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [items, setItems] = useState<ItineraryItem[]>(day.items);
  const [locked, setLocked] = useState(day.locked);
  const [lockLoading, setLockLoading] = useState(false);
  const [votes, setVotes] = useState<ItemVote[]>([]);

  // Fetch open votes for this day whenever the day panel opens
  const refreshVotes = useCallback(() => {
    fetch(`/api/trips/${tripId}/votes?open=1`)
      .then(r => r.json())
      .then((d: { data?: ItemVote[] }) => {
        const all = d.data ?? [];
        // Filter to votes relevant to this day:
        // - 'add' proposals with dayId matching this day
        // - 'remove' proposals targeting an item in this day
        const dayItemIds = new Set(items.map(i => i.id));
        const dayVotes = all.filter(v => {
          if (v.actionType === 'add') {
            const rd = v.replacementData as { dayId?: string } | null;
            return rd?.dayId === day.id;
          }
          return v.itemId ? dayItemIds.has(v.itemId) : false;
        });
        setVotes(dayVotes);
      })
      .catch(() => {});
  }, [tripId, day.id, items]);

  useEffect(() => {
    if (open) refreshVotes();
  }, [open, refreshVotes]);

  const date = parseISO(day.dayDate);
  const dayLabel = format(date, "EEEE d 'de' MMMM", { locale: es });
  const totalCost = items.reduce((s, i) => s + (i.estimatedCost ?? 0), 0);
  const currency  = items[0]?.currency ?? 'EUR';

  async function handleToggleLock() {
    setLockLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/days/${day.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked: !locked }),
      });
      if (res.ok) setLocked((v) => !v);
    } finally {
      setLockLoading(false);
    }
  }

  function handleItemAdded(newItem: ItineraryItem) {
    setItems((prev) => {
      const next = [...prev, newItem].sort((a, b) => a.position - b.position);
      return next;
    });
  }

  function handleItemUpdated(updated: ItineraryItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleItemRemoved(itemId: string) {
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  function handleVoteClosed(voteId: string, newItem?: ItineraryItem) {
    setVotes(prev => prev.filter(v => v.id !== voteId));
    if (newItem) {
      setItems(prev => [...prev, newItem].sort((a, b) => a.position - b.position));
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: '1px solid rgba(148,163,184,0.08)' }}>

      {/* ── Day header ── */}
      <div
        className="flex items-center gap-2 px-4 py-3.5"
        style={{
          background: CARD2_BG,
          borderLeft: `4px solid ${locked ? '#f59e0b' : TEAL}`,
        }}
      >
        {/* Expand button — takes most of the row */}
        <button
          onClick={() => setOpen(v => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: locked ? AMBER : TEAL }}>
              Día {day.dayNumber}
            </span>
            {locked && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: AMBER_DIM, color: AMBER, border: `1px solid ${AMBER_RING}` }}>
                🔒 Protegido
              </span>
            )}
            {/* City + country badge */}
            {day.city && (
              <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.3)' }}>
                {day.flag && <span>{day.flag}</span>}
                {day.city}{day.country ? `, ${day.country}` : ''}
              </span>
            )}
            {totalCost > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: TEAL_DIM, color: TEAL, border: `1px solid ${TEAL_RING}` }}>
                {sym(currency)} {totalCost.toFixed(0)}
              </span>
            )}
          </div>
          <div className="text-white font-bold text-[0.95rem] capitalize">{dayLabel}</div>
          <div className="text-slate-400 text-xs mt-0.5">{items.length} actividades</div>
        </button>

        {/* Lock toggle — only for leader, separate from expand */}
        {isLeader && (
          <button
            onClick={handleToggleLock}
            disabled={lockLoading}
            title={locked ? 'Quitar protección (puede regenerarse)' : 'Proteger este día (no se regenera)'}
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50"
            style={locked
              ? { background: AMBER_DIM, border: `1px solid ${AMBER_RING}` }
              : { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)' }}
          >
            <span className="text-base">{locked ? '🔒' : '🔓'}</span>
          </button>
        )}

        <svg
          onClick={() => setOpen(v => !v)}
          className="w-5 h-5 text-slate-500 flex-shrink-0 cursor-pointer transition-transform duration-300"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* ── Timeline ── */}
      {open && (
        <div className="px-4 py-4">
          {items.length === 0 ? (
            <>
              <p className="text-center text-slate-600 text-sm py-4">Sin actividades programadas</p>
              {isLeader && (
                <AddActivityButton
                  dayId={day.id} tripId={tripId}
                  dayCity={day.city} dayCountry={day.country}
                  position={1} currency={items[0]?.currency ?? 'EUR'}
                  prevEndTime={null} existingItems={[]}
                  onAdded={handleItemAdded}
                />
              )}
              {canSuggest && !isLeader && (
                <SuggestActivityButton
                  dayId={day.id} tripId={tripId}
                  dayCity={day.city} dayCountry={day.country}
                  position={1} currency="EUR" existingItems={[]}
                  onProposed={refreshVotes}
                />
              )}
            </>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[9px] top-3 bottom-3 w-px"
                style={{ background: 'linear-gradient(to bottom, #475569, rgba(71,85,105,0.1))' }} />

              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={item.id}>
                    {isLeader && (
                      <InsertSlot
                        dayId={day.id} tripId={tripId}
                        dayCity={day.city} dayCountry={day.country}
                        position={item.position} currency={item.currency}
                        prevEndTime={items[idx - 1]?.endTime ?? null}
                        existingItems={items}
                        onAdded={handleItemAdded}
                      />
                    )}
                    <TimelineItem
                      item={item} tripId={tripId} isLeader={isLeader}
                      canSuggest={canSuggest}
                      isLast={idx === items.length - 1} dayId={day.id}
                      currentUserId={currentUserId}
                      myProfile={myProfile}
                      onUpdated={handleItemUpdated}
                      onRemoved={handleItemRemoved}
                      removeVote={votes.find(v => v.actionType === 'remove' && v.itemId === item.id)}
                      onVoted={refreshVotes}
                    />
                  </div>
                ))}

                {isLeader && (
                  <AddActivityButton
                    dayId={day.id} tripId={tripId}
                    dayCity={day.city} dayCountry={day.country}
                    position={(items[items.length - 1]?.position ?? 0) + 1}
                    currency={items[0]?.currency ?? 'EUR'}
                    prevEndTime={items[items.length - 1]?.endTime ?? null}
                    existingItems={items}
                    onAdded={handleItemAdded}
                  />
                )}

                {/* Member suggestion button */}
                {canSuggest && !isLeader && (
                  <SuggestActivityButton
                    dayId={day.id} tripId={tripId}
                    dayCity={day.city} dayCountry={day.country}
                    position={(items[items.length - 1]?.position ?? 0) + 1}
                    currency={items[0]?.currency ?? 'EUR'}
                    existingItems={items}
                    onProposed={refreshVotes}
                  />
                )}

                {/* Pending vote proposals for this day */}
                {votes.filter(v => v.actionType === 'add').map(vote => (
                  <ProposalCard
                    key={vote.id}
                    vote={vote}
                    tripId={tripId}
                    isLeader={isLeader}
                    currentUserId={currentUserId}
                    onClosed={handleVoteClosed}
                    onVoted={refreshVotes}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── InsertSlot — thin "+" button between existing activities ──────────────────

function InsertSlot({
  dayId, tripId, dayCity, dayCountry, position, currency, prevEndTime, existingItems, onAdded,
}: {
  dayId: string; tripId: string; dayCity?: string | null; dayCountry?: string | null;
  position: number; currency: string; prevEndTime: string | null | undefined;
  existingItems: ItineraryItem[]; onAdded: (item: ItineraryItem) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 py-1 opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity group"
        title="Insertar actividad aquí"
      >
        <div className="h-px flex-1 bg-slate-700/50 group-hover:bg-teal-500/30 transition-colors" />
        <span className="text-[10px] text-slate-600 group-hover:text-teal-400 transition-colors font-bold">+ añadir aquí</span>
        <div className="h-px flex-1 bg-slate-700/50 group-hover:bg-teal-500/30 transition-colors" />
      </button>
    );
  }

  return (
    <div className="my-2">
      <ManualItemForm
        dayId={dayId} tripId={tripId} dayCity={dayCity} dayCountry={dayCountry}
        position={position} currency={currency} prevEndTime={prevEndTime}
        existingItems={existingItems}
        onAdded={(item) => { onAdded(item); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

// ── AddActivityButton — prominent "+" button at the end of the day ────────────

function AddActivityButton({
  dayId, tripId, dayCity, dayCountry, position, currency, prevEndTime, existingItems, onAdded,
}: {
  dayId: string; tripId: string; dayCity?: string | null; dayCountry?: string | null;
  position: number; currency: string; prevEndTime: string | null | undefined;
  existingItems: ItineraryItem[]; onAdded: (item: ItineraryItem) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        style={{ border: '1px dashed rgba(0,212,170,0.3)', color: TEAL, background: 'rgba(0,212,170,0.04)' }}
      >
        + Añadir actividad
      </button>
    );
  }

  return (
    <div className="mt-3">
      <ManualItemForm
        dayId={dayId} tripId={tripId} dayCity={dayCity} dayCountry={dayCountry}
        position={position} currency={currency} prevEndTime={prevEndTime}
        existingItems={existingItems}
        onAdded={(item) => { onAdded(item); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

// ── EnrichedPlace shape (matches API response) ────────────────────────────────

interface EnrichedPlace {
  title: string;
  description: string;
  locationName: string;
  locationLat: number | null;
  locationLng: number | null;
  address: string | null;
  itemType: ItineraryItem['itemType'];
  durationMin: number;
  source: 'osm+wiki' | 'osm' | 'wiki' | 'ai' | 'none';
}

const SOURCE_LABELS: Record<EnrichedPlace['source'], string> = {
  'osm+wiki': 'OpenStreetMap + Wikipedia',
  'osm':      'OpenStreetMap',
  'wiki':     'Wikipedia',
  'ai':       'IA',
  'none':     '',
};

// ── ManualItemForm — form to create a new manual activity ─────────────────────

function ManualItemForm({
  dayId, tripId, dayCity, dayCountry, position, currency,
  prevEndTime, existingItems, suggestMode, onAdded, onCancel,
}: {
  dayId: string; tripId: string; dayCity?: string | null; dayCountry?: string | null;
  position: number; currency: string; prevEndTime?: string | null;
  existingItems: ItineraryItem[]; suggestMode?: boolean;
  onAdded: (item: ItineraryItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle]           = useState('');
  const [itemType, setItemType]     = useState<ItineraryItem['itemType']>('activity');
  const [startTime, setStartTime]   = useState('');
  const [endTime, setEndTime]       = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat]   = useState<number | null>(null);
  const [locationLng, setLocationLng]   = useState<number | null>(null);
  const [address, setAddress]           = useState('');
  const [durationMin, setDurationMin]   = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [enrichSource, setEnrichSource] = useState<EnrichedPlace['source'] | null>(null);
  const [enriching, setEnriching]   = useState(false);
  const [enrichError, setEnrichError] = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [enriched, setEnriched]     = useState(false);
  const [duplicate, setDuplicate]   = useState<ItineraryItem | null>(null);

  function handleTitleChange(value: string) {
    setTitle(value);
    setEnriched(false);
    setEnrichSource(null);
    setDuplicate(findDuplicate(value, existingItems));
  }

  async function handleEnrich() {
    if (!title.trim()) return;
    setEnriching(true);
    setEnrichError('');
    try {
      const res = await fetch('/api/places/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: title.trim(), city: dayCity, country: dayCountry }),
      });
      const data = await res.json() as { data?: EnrichedPlace; error?: string };
      if (!res.ok || !data.data) throw new Error(data.error ?? 'No se encontró información');

      const p = data.data;
      if (p.description) setDescription(p.description);
      if (p.locationName) setLocationName(p.locationName);
      if (p.locationLat) setLocationLat(p.locationLat);
      if (p.locationLng) setLocationLng(p.locationLng);
      if (p.address)     setAddress(p.address);

      // Auto-schedule: set start = prevEndTime, end = start + durationMin
      if (p.durationMin) {
        setDurationMin(String(p.durationMin));
        if (prevEndTime) {
          setStartTime(prevEndTime);
          setEndTime(addMinutes(prevEndTime, p.durationMin));
        }
      }

      setItemType(p.itemType);
      setEnrichSource(p.source);
      setEnriched(true);
    } catch (e) {
      setEnrichError((e as Error).message);
    } finally {
      setEnriching(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) return;
    setError('');
    setLoading(true);
    try {
      const payload = {
        dayId,
        position,
        itemType,
        title: title.trim(),
        description: description || undefined,
        locationName: locationName || undefined,
        locationLat: locationLat ?? undefined,
        locationLng: locationLng ?? undefined,
        address: address || undefined,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        durationMin: durationMin !== '' ? parseInt(durationMin) : undefined,
        estimatedCost: estimatedCost !== '' ? parseFloat(estimatedCost) : undefined,
        currency,
      };

      if (suggestMode) {
        // Member suggestion: create a vote proposal instead of inserting directly
        const res = await fetch(`/api/trips/${tripId}/votes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actionType: 'add', replacementData: payload }),
        });
        const data = await res.json() as { data?: unknown; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Error al proponer');
        // Signal onAdded with a dummy item (parent will refresh votes)
        onAdded({} as ItineraryItem);
      } else {
        const res = await fetch(`/api/trips/${tripId}/itinerary/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json() as { data?: ItineraryItem; error?: string };
        if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
        onAdded(data.data!);
      }
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && title.trim() && !enriched) {
      e.preventDefault();
      void handleEnrich();
    }
  }

  const typeIcons: Record<ItineraryItem['itemType'], string> = {
    activity: '🏛️', meal: '🍽️', transport: '🚌', rest: '😴', accommodation: '🏨', free_time: '🎭',
  };

  return (
    <div className="rounded-xl p-3 space-y-3"
      style={{ background: CARD2_BG, border: `1px solid ${TEAL_RING}` }}>
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: suggestMode ? '#c084fc' : TEAL }}>
        {suggestMode ? '💡 Sugerir actividad' : 'Nueva actividad'}
      </p>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      {/* Duplicate warning */}
      {duplicate && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-amber-400 text-xs flex-shrink-0">⚠️</span>
          <p className="text-amber-300 text-xs leading-snug">
            Ya existe una actividad similar: <span className="font-bold">"{duplicate.title}"</span>
          </p>
        </div>
      )}

      {/* ── Smart search: name + enrich button ── */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Nombre del lugar *</label>
        <div className="flex gap-2">
          <input
            value={title} onChange={e => handleTitleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={300}
            placeholder="Ej: Puerta de Alcalá, Museo del Prado..."
            className="flex-1 bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-teal-400/50 placeholder-slate-600"
          />
          <button
            onClick={() => void handleEnrich()}
            disabled={!title.trim() || enriching}
            title="Buscar información del lugar en OpenStreetMap y Wikipedia"
            className="px-3 h-10 rounded-lg text-xs font-bold flex-shrink-0 transition-colors disabled:opacity-40"
            style={{ background: enriched ? 'rgba(0,212,170,0.15)' : 'rgba(255,255,255,0.06)', color: enriched ? TEAL : '#94a3b8', border: `1px solid ${enriched ? TEAL_RING : 'rgba(148,163,184,0.15)'}` }}
          >
            {enriching ? '⏳' : enriched ? '✓' : '🔍'}
          </button>
        </div>

        {/* Source badge */}
        {enrichSource && enrichSource !== 'none' && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[10px] font-semibold" style={{ color: enrichSource === 'ai' ? '#c084fc' : TEAL }}>
              {enrichSource === 'ai' ? '✨ Completado por IA' : `✓ Datos de ${SOURCE_LABELS[enrichSource]}`}
            </span>
          </div>
        )}
        {enrichError && <p className="text-amber-400 text-[10px] mt-1">{enrichError} — completa manualmente</p>}
        {!enriched && title.trim() && (
          <p className="text-slate-600 text-[10px] mt-1">Presiona 🔍 para autocompletar descripción, ubicación y tipo</p>
        )}
      </div>

      {/* Type selector */}
      <div className="flex gap-1.5 flex-wrap">
        {(Object.keys(typeIcons) as ItineraryItem['itemType'][]).map((t) => (
          <button
            key={t}
            onClick={() => setItemType(t)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
            style={itemType === t
              ? { background: TEAL, color: '#0b1220' }
              : { background: 'rgba(255,255,255,0.05)', color: '#64748b' }}
          >
            {typeIcons[t]} {TYPE_META[t].label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Descripción</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          rows={2} maxLength={2000} placeholder="Descripción (se autocompleta al buscar)..."
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 resize-none placeholder-slate-600"
        />
      </div>

      {/* Location (pre-filled by enrich, editable) */}
      {(locationName || address) && (
        <div className="rounded-lg px-3 py-2 space-y-0.5" style={{ background: 'rgba(0,212,170,0.06)', border: `1px solid ${TEAL_RING}` }}>
          {locationName && <div className="text-white text-xs font-semibold">📍 {locationName}</div>}
          {address && <div className="text-slate-400 text-xs">{address}</div>}
          {locationLat && locationLng && (
            <div className="text-slate-600 text-[10px]">{locationLat.toFixed(5)}, {locationLng.toFixed(5)}</div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Inicio</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 [color-scheme:dark]" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Fin</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 [color-scheme:dark]" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Duración (min)</label>
          <input type="number" value={durationMin} onChange={e => setDurationMin(e.target.value)}
            min={5} step={5} placeholder="60"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Costo ({currency})</label>
          <input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)}
            min={0} step={1} placeholder="0"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10" />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave} disabled={loading || !title.trim()}
          className="flex-1 h-9 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
          style={{ background: TEAL, color: '#0b1220' }}
        >
          {loading ? (suggestMode ? 'Enviando...' : 'Guardando...') : (suggestMode ? 'Enviar propuesta' : 'Guardar actividad')}
        </button>
        <button
          onClick={onCancel}
          className="h-9 px-4 text-xs font-semibold rounded-lg"
          style={{ border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── TimelineItem — individual event with expand/edit/suggest ──────────────────

function TimelineItem({
  item, tripId, isLeader, canSuggest, isLast, dayId, currentUserId,
  myProfile, onUpdated, onRemoved, removeVote, onVoted,
}: {
  item: ItineraryItem; tripId: string; isLeader: boolean; canSuggest: boolean;
  isLast: boolean; dayId: string; currentUserId: string;
  myProfile: TravelerProfile | null;
  onUpdated: (updated: ItineraryItem) => void;
  onRemoved: (itemId: string) => void;
  removeVote?: ItemVote;
  onVoted: () => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [editing, setEditing]       = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<AiSuggestion | null>(null);
  const [suggestErr, setSuggestErr] = useState('');
  const [proposingRemove, setProposingRemove] = useState(false);

  const meta = TYPE_META[item.itemType];
  const isHighlight = item.itemType === 'transport';

  async function handleSuggest() {
    setSuggesting(true);
    setSuggestion(null);
    setSuggestErr('');
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/items/${item.id}/suggest`, { method: 'POST' });
      const data = await res.json() as { data?: AiSuggestion; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setSuggestion(data.data!);
    } catch (e) {
      setSuggestErr((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function handleProposeRemove() {
    setProposingRemove(true);
    try {
      await fetch(`/api/trips/${tripId}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, actionType: 'remove' }),
      });
      onVoted();
    } finally {
      setProposingRemove(false);
    }
  }

  async function handleVoteOnRemove(response: 'yes' | 'no') {
    if (!removeVote) return;
    await fetch(`/api/trips/${tripId}/votes/${removeVote.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    });
    onVoted();
  }

  async function handleCloseRemoveVote(outcome: 'approved' | 'rejected') {
    if (!removeVote) return;
    const res = await fetch(`/api/trips/${tripId}/votes/${removeVote.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    if (res.ok && outcome === 'approved') {
      onRemoved(item.id);
    }
    onVoted();
  }

  return (
    <div className={`relative ${isLast ? 'pb-0' : 'pb-3'}`}>

      {/* Timeline dot */}
      <div
        className="absolute -left-[24px] top-[16px] w-[10px] h-[10px] rounded-full z-10"
        style={{
          background: isHighlight ? meta.dot : '#0b1220',
          border: `2px solid ${meta.dot}`,
          boxShadow: isHighlight ? `0 0 8px ${meta.dot}` : undefined,
        }}
      />

      {/* Collapsed row */}
      <button
        onClick={() => { setExpanded(v => !v); if (!expanded) setEditing(false); }}
        className="w-full text-left rounded-xl px-3 py-2.5 transition-colors"
        style={{ background: expanded ? 'rgba(255,255,255,0.04)' : 'transparent' }}
      >
        {(item.startTime || item.endTime) && (
          <div className="inline-block text-[11px] font-bold tracking-wide text-white/80 bg-white/[0.07] px-2 py-0.5 rounded mb-1.5">
            {item.startTime}{item.endTime ? ` — ${item.endTime}` : ''}
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <span className="text-lg flex-shrink-0 mt-0.5">{meta.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[0.88rem] leading-snug">{item.title}</div>
            {!expanded && item.description && (
              <div className="text-slate-400 text-xs mt-0.5 line-clamp-1">{item.description}</div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <Tag bg={meta.tagBg} color={meta.tagColor} border={meta.tagBorder}>
                {meta.label}
              </Tag>
              {item.estimatedCost !== null && item.estimatedCost > 0 && (
                <Tag bg={TEAL_DIM} color={TEAL} border={TEAL_RING}>
                  {sym(item.currency)} {item.estimatedCost.toFixed(0)}
                </Tag>
              )}
              {item.aiGenerated && (
                <Tag bg="rgba(168,85,247,0.1)" color="#c084fc" border="rgba(168,85,247,0.3)">
                  ✨ IA
                </Tag>
              )}
              {!item.aiGenerated && (
                <Tag bg="rgba(0,212,170,0.08)" color={TEAL} border={TEAL_RING}>
                  ✏️ Manual
                </Tag>
              )}
              {removeVote && (
                <Tag bg="rgba(245,158,11,0.1)" color={AMBER} border={AMBER_RING}>
                  ✋ {removeVote.responses?.length ?? 0} proponen quitar
                </Tag>
              )}
            </div>
          </div>
          <svg
            className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1 transition-transform duration-200"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="mt-1 mx-0 rounded-xl p-3 space-y-3"
          style={{ background: CARD2_BG, border: '1px solid rgba(148,163,184,0.1)' }}
        >
          {item.description && (
            <p className="text-slate-300 text-sm leading-relaxed">{item.description}</p>
          )}

          {(item.locationName || item.address) && (
            <div className="flex items-start gap-1.5 text-slate-400 text-xs">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{item.locationName}{item.address ? ` · ${item.address}` : ''}</span>
            </div>
          )}

          {item.notes && (
            <p className="text-slate-500 text-xs italic leading-relaxed">{item.notes}</p>
          )}

          <MediaAlbum itemId={item.id} tripId={tripId} currentUserId={currentUserId} />

          <CompatibilityBadge
            itemId={item.id}
            tripId={tripId}
            currentUserId={currentUserId}
            myProfile={myProfile}
          />

          {editing && (
            <EditForm
              item={item}
              tripId={tripId}
              onDone={(updated) => {
                setEditing(false);
                if (updated) onUpdated(updated);
              }}
            />
          )}

          {suggestion && !editing && (
            <SuggestionPanel
              suggestion={suggestion}
              item={item}
              tripId={tripId}
              isLeader={isLeader}
              onDismiss={() => setSuggestion(null)}
              onApplied={onUpdated}
            />
          )}

          {suggestErr && <p className="text-red-400 text-xs">{suggestErr}</p>}

          {/* Remove vote section */}
          {removeVote && (
            <div className="rounded-lg p-2.5 space-y-2"
              style={{ background: AMBER_DIM, border: `1px solid ${AMBER_RING}` }}>
              <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: AMBER }}>
                ✋ Propuesta de eliminar — {removeVote.proposedByName}
              </p>
              <div className="flex gap-1.5 text-xs text-slate-400">
                <span>👍 {removeVote.responses?.filter(r => r.response === 'yes').length ?? 0}</span>
                <span>👎 {removeVote.responses?.filter(r => r.response === 'no').length ?? 0}</span>
                {removeVote.responses?.find(r => r.userId === currentUserId) && (
                  <span className="ml-1 text-teal-400">✓ Ya votaste</span>
                )}
              </div>
              {!removeVote.responses?.find(r => r.userId === currentUserId) && (
                <div className="flex gap-2">
                  <button onClick={() => void handleVoteOnRemove('yes')}
                    className="flex-1 h-7 text-xs font-bold rounded-lg"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
                    👍 Sí, quitar
                  </button>
                  <button onClick={() => void handleVoteOnRemove('no')}
                    className="flex-1 h-7 text-xs font-bold rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    👎 No, mantener
                  </button>
                </div>
              )}
              {isLeader && (
                <div className="flex gap-2 pt-1 border-t border-white/10">
                  <button onClick={() => void handleCloseRemoveVote('approved')}
                    className="flex-1 h-7 text-[10px] font-bold rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                    ✓ Aprobar (eliminar)
                  </button>
                  <button onClick={() => void handleCloseRemoveVote('rejected')}
                    className="flex-1 h-7 text-[10px] font-bold rounded-lg"
                    style={{ background: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.2)' }}>
                    ✗ Rechazar
                  </button>
                </div>
              )}
            </div>
          )}

          {!editing && (
            <div className="flex gap-2 pt-1 flex-wrap">
              {isLeader && (
                <button
                  onClick={() => { setEditing(true); setSuggestion(null); }}
                  className="flex-1 h-8 text-xs font-semibold rounded-lg transition-colors"
                  style={{ border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}
                >
                  ✏️ Editar
                </button>
              )}
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                className="flex-1 h-8 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
              >
                {suggesting ? '⏳ Pensando...' : '✨ Sugerir alternativa'}
              </button>
              {canSuggest && !isLeader && !removeVote && (
                <button
                  onClick={() => void handleProposeRemove()}
                  disabled={proposingRemove}
                  className="h-8 px-3 text-xs font-semibold rounded-lg disabled:opacity-40"
                  style={{ background: AMBER_DIM, color: AMBER, border: `1px solid ${AMBER_RING}` }}
                >
                  {proposingRemove ? '⏳' : '✋ Proponer quitar'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── EditForm — inline edit for leaders ────────────────────────────────────────

function EditForm({
  item,
  tripId,
  onDone,
}: {
  item: ItineraryItem;
  tripId: string;
  onDone: (updated: ItineraryItem | null) => void;
}) {
  const [title, setTitle]               = useState(item.title);
  const [description, setDescription]   = useState(item.description ?? '');
  const [startTime, setStartTime]       = useState(item.startTime ?? '');
  const [endTime, setEndTime]           = useState(item.endTime ?? '');
  const [estimatedCost, setEstimatedCost] = useState(String(item.estimatedCost ?? ''));
  const [notes, setNotes]               = useState(item.notes ?? '');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  async function handleSave() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || undefined,
          description: description || null,
          startTime: startTime || null,
          endTime: endTime || null,
          estimatedCost: estimatedCost !== '' ? parseFloat(estimatedCost) : null,
          notes: notes || null,
        }),
      });
      const data = await res.json() as { data?: ItineraryItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar');
      onDone(data.data ?? null);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2.5 pt-1 border-t border-white/10">
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: TEAL }}>Editar actividad</p>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Título</label>
        <input
          value={title} onChange={e => setTitle(e.target.value)} maxLength={300}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-teal-400/50"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Inicio</label>
          <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 [color-scheme:dark]" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Fin</label>
          <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 [color-scheme:dark]" />
        </div>
      </div>

      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Descripción</label>
        <textarea
          value={description} onChange={e => setDescription(e.target.value)}
          rows={2} maxLength={2000}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10 resize-none"
        />
      </div>

      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">
          Costo estimado ({item.currency})
        </label>
        <input type="number" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)}
          min={0} step={0.01}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10" />
      </div>

      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Notas</label>
        <input value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000}
          className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 outline-none border border-white/10" />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave} disabled={loading || !title}
          className="flex-1 h-9 text-xs font-bold rounded-lg disabled:opacity-50 transition-colors"
          style={{ background: TEAL, color: '#0b1220' }}
        >
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
        <button
          onClick={() => onDone(null)}
          className="h-9 px-4 text-xs font-semibold rounded-lg"
          style={{ border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── SuggestionPanel — AI suggestion with apply / dismiss ──────────────────────

function SuggestionPanel({
  suggestion,
  item,
  tripId,
  isLeader,
  onDismiss,
  onApplied,
}: {
  suggestion: AiSuggestion;
  item: ItineraryItem;
  tripId: string;
  isLeader: boolean;
  onDismiss: () => void;
  onApplied: (updated: ItineraryItem) => void;
}) {
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState('');

  async function applyDirectly() {
    setApplying(true);
    setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: suggestion.title,
          description: suggestion.description,
          locationName: suggestion.locationName ?? null,
          address: suggestion.address ?? null,
          estimatedCost: suggestion.estimatedCost ?? null,
          notes: suggestion.notes ?? null,
        }),
      });
      const data = await res.json() as { data?: ItineraryItem; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error');
      if (data.data) onApplied(data.data);
      onDismiss();
    } catch (e) {
      setError((e as Error).message);
      setApplying(false);
    }
  }

  return (
    <div className="rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)' }}>

      <p className="text-[10px] font-bold tracking-widest uppercase text-purple-400">✨ Sugerencia de la IA</p>

      <div>
        <div className="text-white font-bold text-sm">{suggestion.title}</div>
        <div className="text-slate-300 text-xs mt-1 leading-relaxed">{suggestion.description}</div>
        {suggestion.locationName && (
          <div className="text-slate-400 text-xs mt-1">📍 {suggestion.locationName}</div>
        )}
        {suggestion.estimatedCost !== undefined && suggestion.estimatedCost > 0 && (
          <div className="text-xs mt-1" style={{ color: TEAL }}>
            {sym(item.currency)} {suggestion.estimatedCost.toFixed(0)}
          </div>
        )}
        {suggestion.notes && (
          <div className="text-slate-500 text-xs mt-1 italic">{suggestion.notes}</div>
        )}
      </div>

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <div className="flex gap-2 pt-1">
        {isLeader && (
          <button
            onClick={applyDirectly} disabled={applying}
            className="flex-1 h-8 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.4)' }}
          >
            {applying ? 'Aplicando...' : '✓ Aplicar'}
          </button>
        )}
        <button
          onClick={onDismiss}
          className="flex-1 h-8 text-xs font-semibold rounded-lg"
          style={{ border: '1px solid rgba(148,163,184,0.15)', color: '#64748b' }}
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

// ── SuggestActivityButton — member suggestion button (creates a vote) ─────────

function SuggestActivityButton({
  dayId, tripId, dayCity, dayCountry, position, currency, existingItems, onProposed,
}: {
  dayId: string; tripId: string; dayCity?: string | null; dayCountry?: string | null;
  position: number; currency: string; existingItems: ItineraryItem[];
  onProposed: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full h-9 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
        style={{ border: '1px dashed rgba(168,85,247,0.4)', color: '#c084fc', background: 'rgba(168,85,247,0.05)' }}
      >
        💡 Sugerir actividad (requiere aprobación)
      </button>
    );
  }

  return (
    <div className="mt-3">
      <ManualItemForm
        dayId={dayId} tripId={tripId} dayCity={dayCity} dayCountry={dayCountry}
        position={position} currency={currency} prevEndTime={null}
        existingItems={existingItems} suggestMode
        onAdded={() => { onProposed(); setOpen(false); }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

// ── ProposalCard — shows a pending 'add' vote for a day ───────────────────────

function ProposalCard({
  vote, tripId, isLeader, currentUserId, onClosed, onVoted,
}: {
  vote: ItemVote; tripId: string; isLeader: boolean; currentUserId: string;
  onClosed: (voteId: string, newItem?: ItineraryItem) => void;
  onVoted: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [voting, setVoting]   = useState(false);
  const data = vote.replacementData as { title?: string; description?: string; itemType?: string; startTime?: string; endTime?: string } | null;
  const yesCount = vote.responses?.filter(r => r.response === 'yes').length ?? 0;
  const noCount  = vote.responses?.filter(r => r.response === 'no').length ?? 0;
  const myVote   = vote.responses?.find(r => r.userId === currentUserId);

  async function handleVote(response: 'yes' | 'no') {
    setVoting(true);
    await fetch(`/api/trips/${tripId}/votes/${vote.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    });
    setVoting(false);
    onVoted();
  }

  async function handleClose(outcome: 'approved' | 'rejected') {
    setClosing(true);
    const res = await fetch(`/api/trips/${tripId}/votes/${vote.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    if (res.ok && outcome === 'approved') {
      // Refresh itinerary to show new item
      onClosed(vote.id, undefined);
      // Give server a tick then refresh
      setTimeout(() => window.location.reload(), 800);
    } else {
      onClosed(vote.id);
    }
    setClosing(false);
  }

  return (
    <div className="mt-2 rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(168,85,247,0.07)', border: '1px solid rgba(168,85,247,0.25)' }}>
      <div className="flex items-center gap-2">
        <span className="text-purple-400 text-sm">💡</span>
        <p className="text-[10px] font-bold tracking-widest uppercase text-purple-400">
          Propuesta de {vote.proposedByName}
        </p>
      </div>
      <div>
        <div className="text-white font-bold text-sm">{data?.title ?? 'Sin título'}</div>
        {data?.description && <div className="text-slate-400 text-xs mt-0.5 line-clamp-2">{data.description}</div>}
        {(data?.startTime || data?.endTime) && (
          <div className="text-[11px] text-slate-500 mt-0.5">
            {data.startTime}{data.endTime ? ` — ${data.endTime}` : ''}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="text-green-400">👍 {yesCount}</span>
        <span className="text-red-400">👎 {noCount}</span>
        {myVote && <span className="text-teal-400">✓ Votaste: {myVote.response === 'yes' ? 'Sí' : 'No'}</span>}
      </div>

      {!myVote && !isLeader && (
        <div className="flex gap-2">
          <button onClick={() => void handleVote('yes')} disabled={voting}
            className="flex-1 h-8 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
            👍 Sí
          </button>
          <button onClick={() => void handleVote('no')} disabled={voting}
            className="flex-1 h-8 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            👎 No
          </button>
        </div>
      )}

      {isLeader && (
        <div className="flex gap-2 border-t border-white/10 pt-2">
          <button onClick={() => void handleClose('approved')} disabled={closing}
            className="flex-1 h-8 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>
            ✓ Aprobar
          </button>
          <button onClick={() => void handleClose('rejected')} disabled={closing}
            className="flex-1 h-8 text-xs font-bold rounded-lg disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            ✗ Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

// ── MediaAlbum — per-activity photo/link gallery ──────────────────────────────

const MEDIA_ICONS: Record<string, string> = {
  youtube: '▶️', tiktok: '🎵', instagram: '📷', image: '🖼️', link: '🔗',
};

function MediaAlbum({
  itemId, tripId, currentUserId,
}: {
  itemId: string; tripId: string; currentUserId: string;
}) {
  const [media, setMedia]       = useState<TripMedia[] | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding]     = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    fetch(`/api/trips/${tripId}/itinerary/items/${itemId}/media`)
      .then(r => r.json())
      .then((d: { data?: TripMedia[] }) => setMedia(d.data ?? []))
      .catch(() => setMedia([]));
  }, [tripId, itemId]);

  async function handleAdd() {
    if (!urlInput.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/items/${itemId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await res.json() as { data?: TripMedia[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Error');
      setMedia(data.data ?? []);
      setUrlInput('');
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(mediaId: string) {
    const res = await fetch(`/api/trips/${tripId}/itinerary/items/${itemId}/media/${mediaId}`, {
      method: 'DELETE',
    });
    const data = await res.json() as { data?: TripMedia[] };
    if (res.ok) setMedia(data.data ?? []);
  }

  return (
    <div className="space-y-2 pt-2 border-t border-white/5">
      <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#a855f7' }}>📸 Álbum</p>

      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleAdd(); }}
          placeholder="Pega un enlace: YouTube, TikTok, Instagram, imagen..."
          className="flex-1 bg-white/5 text-white text-xs rounded-lg px-3 py-2 outline-none border border-white/10 focus:border-purple-400/50 placeholder-slate-600"
        />
        <button
          onClick={() => void handleAdd()}
          disabled={!urlInput.trim() || adding}
          className="px-3 h-9 rounded-lg text-xs font-bold flex-shrink-0 transition-colors disabled:opacity-40"
          style={{ background: 'rgba(168,85,247,0.2)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.3)' }}
        >
          {adding ? '⏳' : '+'}
        </button>
      </div>

      {addError && <p className="text-red-400 text-[10px]">{addError}</p>}

      {media === null ? (
        <p className="text-slate-600 text-xs text-center py-1">Cargando...</p>
      ) : media.length === 0 ? (
        <p className="text-slate-600 text-[10px] text-center py-1">Sin medios — pega un enlace arriba</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {media.map(m => (
            <div key={m.id} className="relative group rounded-lg overflow-hidden aspect-square"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(148,163,184,0.1)' }}>
              {m.thumbnailUrl ? (
                <img src={m.thumbnailUrl} alt={m.title ?? ''} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  <span className="text-xl">{MEDIA_ICONS[m.mediaType] ?? '🔗'}</span>
                  <span className="text-[9px] text-slate-500 text-center leading-tight line-clamp-2">
                    {m.url.replace(/^https?:\/\//, '').slice(0, 28)}
                  </span>
                </div>
              )}
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="absolute inset-0" />
              {m.userId === currentUserId && (
                <button
                  onClick={(e) => { e.preventDefault(); void handleDelete(m.id); }}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px] z-10"
                  style={{ background: 'rgba(0,0,0,0.75)', color: 'white' }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CompatibilityBadge — AI dietary/accessibility analysis for this user ──────

interface CompatResult {
  level: 'green' | 'yellow' | 'red';
  summary: string;
}

const COMPAT_COLORS = {
  green:  { bg: 'rgba(34,197,94,0.1)',   color: '#4ade80', border: 'rgba(34,197,94,0.3)',   icon: '🟢' },
  yellow: { bg: 'rgba(245,158,11,0.1)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)',  icon: '🟡' },
  red:    { bg: 'rgba(239,68,68,0.1)',   color: '#f87171', border: 'rgba(239,68,68,0.3)',   icon: '🔴' },
};

function CompatibilityBadge({
  itemId, tripId, currentUserId, myProfile,
}: {
  itemId: string; tripId: string; currentUserId: string; myProfile: TravelerProfile | null;
}) {
  const [result, setResult] = useState<CompatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const hasNeeds = myProfile && (
    (myProfile.dietType && myProfile.dietType !== 'omnivore') ||
    myProfile.foodAllergies || myProfile.mobilityNeeds ||
    myProfile.visualNeeds || myProfile.hearingNeeds || myProfile.otherAccessibility
  );

  useEffect(() => {
    if (!hasNeeds) return;

    // Check localStorage cache first (TTL: 24h)
    const cacheKey = `compat_${itemId}_${currentUserId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { data, ts } = JSON.parse(cached) as { data: CompatResult; ts: number };
        if (Date.now() - ts < 86_400_000) { setResult(data); return; }
      }
    } catch { /* ignore */ }

    setLoading(true);
    fetch(`/api/trips/${tripId}/itinerary/items/${itemId}/compatibility`, { method: 'POST' })
      .then(r => r.json())
      .then((d: { data?: CompatResult; error?: string }) => {
        if (d.data) {
          setResult(d.data);
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ data: d.data, ts: Date.now() }));
          } catch { /* ignore */ }
        } else {
          setErr(d.error ?? 'Error');
        }
      })
      .catch(() => setErr('Error de conexión'))
      .finally(() => setLoading(false));
  }, [itemId, tripId, currentUserId, hasNeeds]);

  if (!hasNeeds) return null;
  if (loading) return (
    <div className="flex items-center gap-1.5 pt-1">
      <div className="w-3 h-3 rounded-full border border-slate-600 border-t-transparent animate-spin" />
      <span className="text-[10px] text-slate-600">Analizando compatibilidad...</span>
    </div>
  );
  if (err) return null;
  if (!result) return null;

  const c = COMPAT_COLORS[result.level];
  return (
    <div className="rounded-lg px-3 py-2 space-y-1" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm">{c.icon}</span>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: c.color }}>
          {result.level === 'green' ? 'Compatible contigo' : result.level === 'yellow' ? 'Verifica antes' : 'Posible problema'}
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: c.color }}>{result.summary}</p>
    </div>
  );
}

// ── Tag — reusable inline tag ─────────────────────────────────────────────────

function Tag({ bg, color, border, children }: {
  bg: string; color: string; border: string; children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded"
      style={{ background: bg, color, border: `1px solid ${border}` }}>
      {children}
    </span>
  );
}
