// src/app/trips/[id]/itinerary/plan/PlanningAgent.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { AgentResponse, AgentProposal, PlanningMessage } from '@/types';
import { CityAssignment } from '@/lib/oci-ai';

interface PlanningAgentProps {
  tripId: string;
  tripTitle: string;
  destination: string;
  totalDays: number;
}

interface DisplayMessage {
  id: string;
  role: 'user' | 'agent';
  type: 'question' | 'proposal' | 'message' | 'user';
  content: string;
  proposal?: AgentProposal;
}

function parseAgentMessage(raw: PlanningMessage): DisplayMessage {
  if (raw.role === 'user') {
    return { id: raw.id, role: 'user', type: 'user', content: raw.content };
  }
  try {
    const parsed = JSON.parse(raw.content) as AgentResponse;
    return { id: raw.id, role: 'agent', type: parsed.type, content: parsed.content, proposal: parsed.proposal };
  } catch {
    return { id: raw.id, role: 'agent', type: 'message', content: raw.content };
  }
}

// ── Transport connector ───────────────────────────────────────────────────────

const TRANSPORT_LINKS = [
  {
    key: 'rome2rio',
    label: 'Rome2rio',
    sublabel: 'Vuelos · trenes · buses · ferry',
    getUrl: (from: string, to: string) =>
      `https://www.rome2rio.com/s/${encodeURIComponent(from)}/${encodeURIComponent(to)}`,
    dot: 'bg-orange-400',
  },
  {
    key: 'flights',
    label: 'Google Flights',
    sublabel: 'Comparar vuelos',
    getUrl: (from: string, to: string) =>
      `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(from)}+to+${encodeURIComponent(to)}`,
    dot: 'bg-sky-400',
  },
  {
    key: 'maps',
    label: 'Google Maps',
    sublabel: 'Rutas en transporte público',
    getUrl: (from: string, to: string) =>
      `https://www.google.com/maps/dir/${encodeURIComponent(from)}/${encodeURIComponent(to)}/`,
    dot: 'bg-green-400',
  },
  {
    key: 'trainline',
    label: 'Trainline',
    sublabel: 'Trenes en Europa',
    getUrl: (from: string, to: string) =>
      `https://www.thetrainline.com/train-times/${from.toLowerCase().replace(/\s+/g, '-')}-to-${to.toLowerCase().replace(/\s+/g, '-')}`,
    dot: 'bg-violet-400',
  },
];

function TransportConnector({ from, to }: { from: EditableGroup; to: EditableGroup }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ml-10 my-0.5">
      {/* Vertical line above */}
      <div className="w-px h-2 bg-slate-200 ml-[5px]" />

      {/* Toggle trigger */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-sky-600 transition-colors cursor-pointer group py-0.5"
      >
        <div className="w-3 h-3 rounded-full border border-slate-300 group-hover:border-sky-400 flex items-center justify-center flex-shrink-0">
          <div className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-sky-400 transition-colors" />
        </div>
        <span className="group-hover:underline">
          {expanded ? 'Ocultar traslados' : `Traslados: ${from.city} → ${to.city}`}
        </span>
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded panel — instant, no API needed */}
      {expanded && (
        <div className="mt-1.5 ml-4 border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
              {from.city} → {to.city} · buscar en
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {TRANSPORT_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.getUrl(from.city, to.city)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-sky-50 transition-colors group cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${link.dot}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-slate-800 group-hover:text-sky-700 transition-colors">
                    {link.label}
                  </span>
                  <span className="text-xs text-slate-400 ml-2">{link.sublabel}</span>
                </div>
                <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-sky-500 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ))}
          </div>
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">Abre en nueva pestaña · precios en tiempo real</p>
          </div>
        </div>
      )}

      {/* Vertical line below */}
      <div className="w-px h-2 bg-slate-200 ml-[5px] mt-0.5" />
    </div>
  );
}

// ── City types ────────────────────────────────────────────────────────────────

interface EditableGroup {
  city: string;
  country: string;
  flag: string;
  days: number;
}

interface CityPreview {
  description: string;
  images: Array<{ url: string; caption: string }>;
  wikiUrl: string;
}

function buildEditableGroups(proposal: AgentProposal): EditableGroup[] {
  const groups: EditableGroup[] = [];
  for (const ca of proposal.cityAssignments) {
    const last = groups[groups.length - 1];
    if (last && last.city === ca.city && last.country === ca.country) {
      last.days++;
    } else {
      groups.push({ city: ca.city, country: ca.country, flag: ca.flag, days: 1 });
    }
  }
  return groups;
}

// ── City Preview Panel ────────────────────────────────────────────────────────

function CityPreviewPanel({ city, country, wikiUrl }: { city: string; country: string; wikiUrl?: string }) {
  const [preview, setPreview] = useState<CityPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cities/preview?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`)
      .then((r) => r.json())
      .then((d: CityPreview & { error?: string }) => {
        if (!d.error) setPreview(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [city, country]);

  if (loading) {
    return (
      <div className="mt-2 mb-1 space-y-2 animate-pulse">
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-32 h-20 rounded-xl bg-slate-200 flex-shrink-0" />
          ))}
        </div>
        <div className="h-3 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    );
  }

  if (!preview) {
    return (
      <p className="text-xs text-slate-400 mt-2 mb-1 italic">
        No se encontró información para esta ciudad.
      </p>
    );
  }

  const validImages = preview.images.filter((img) => !imgErrors.has(img.url));

  return (
    <div className="mt-2 mb-1 space-y-2">
      {/* Photo gallery */}
      {validImages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          {validImages.map((img) => (
            <div key={img.url} className="flex-shrink-0 w-32 h-20 rounded-xl overflow-hidden bg-slate-100 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.caption}
                className="w-full h-full object-cover"
                onError={() => setImgErrors((prev) => { const s = new Set(prev); s.add(img.url); return s; })}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 pb-1">
                <p className="text-white text-[9px] leading-tight truncate">{img.caption}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Description */}
      {preview.description && (
        <p className="text-xs text-slate-600 leading-relaxed">{preview.description}</p>
      )}

      {/* Wikipedia link */}
      <a
        href={preview.wikiUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-sky-500 hover:text-sky-700 transition-colors flex items-center gap-1"
      >
        Ver más en Wikipedia
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    </div>
  );
}

// ── Proposal Card ─────────────────────────────────────────────────────────────

function ProposalCard({
  proposal,
  totalDays,
  onApprove,
  onRequestChanges,
  disabled,
}: {
  proposal: AgentProposal;
  totalDays: number;
  onApprove: (assignments: CityAssignment[]) => void;
  onRequestChanges: () => void;
  disabled: boolean;
}) {
  const [groups, setGroups] = useState<EditableGroup[]>(() => buildEditableGroups(proposal));
  const [edited, setEdited] = useState(false);
  const [expandedCity, setExpandedCity] = useState<string | null>(null);

  const assignedDays = groups.reduce((s, g) => s + g.days, 0);
  const delta = assignedDays - totalDays; // + = too many, - = too few
  const isComplete = delta === 0;

  function adjustDays(idx: number, change: number) {
    setGroups((prev) => {
      const next = prev.map((g, i) => i === idx ? { ...g, days: Math.max(1, g.days + change) } : g);
      return next;
    });
    setEdited(true);
  }

  function removeCity(idx: number) {
    setGroups((prev) => prev.filter((_, i) => i !== idx));
    setEdited(true);
  }

  function handleApprove() {
    const assignments: CityAssignment[] = [];
    for (const g of groups) {
      for (let d = 0; d < g.days; d++) {
        assignments.push({ city: g.city, country: g.country, flag: g.flag });
      }
    }
    onApprove(assignments);
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-card">
      {/* Header */}
      <div className="bg-sky-50 px-4 py-3 border-b border-sky-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 0l5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17m0-13v13" />
              </svg>
            </div>
            <span className="text-sky-600 text-xs font-bold uppercase tracking-wider">
              {edited ? 'Plan editado' : 'Plan propuesto'}
            </span>
          </div>
          {/* Day counter */}
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
            isComplete
              ? 'bg-green-100 text-green-700'
              : delta > 0
              ? 'bg-red-100 text-red-600'
              : 'bg-amber-100 text-amber-700'
          }`}>
            {assignedDays}/{totalDays}d
            {!isComplete && (
              <span className="font-normal ml-0.5">
                {delta > 0 ? `(${delta} de más)` : `(faltan ${-delta})`}
              </span>
            )}
          </div>
        </div>
        <p className="text-slate-700 text-sm mt-2">{proposal.summary}</p>
      </div>

      {/* Editable city route */}
      <div className="px-4 py-3 space-y-0.5">
        <p className="text-xs text-slate-400 mb-3">
          Toca el nombre de una ciudad para ver fotos e información.
          Luego ajusta los días con <span className="font-semibold">−</span> y <span className="font-semibold">+</span>, o usa <span className="font-semibold">✕</span> para quitarla.
        </p>
        {groups.map((g, idx) => {
          const key = `${g.city}-${idx}`;
          const isExpanded = expandedCity === key;
          return (
            <div key={key}>
              <div className="py-1.5">
                {/* Main row */}
                <div className="flex items-center gap-2">
                  {/* Flag + click to expand */}
                  <button
                    type="button"
                    onClick={() => setExpandedCity(isExpanded ? null : key)}
                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-base flex-shrink-0 transition-colors cursor-pointer"
                    title="Ver fotos e info"
                  >
                    {g.flag}
                  </button>

                  {/* City info — click to expand */}
                  <button
                    type="button"
                    onClick={() => setExpandedCity(isExpanded ? null : key)}
                    className="flex-1 min-w-0 text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-900 text-sm font-semibold truncate group-hover:text-sky-600 transition-colors">{g.city}</span>
                      <svg
                        className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <div className="text-slate-400 text-xs">{g.country}</div>
                  </button>

                  {/* Day controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => adjustDays(idx, -1)}
                      disabled={disabled || g.days <= 1}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-base disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-slate-900">{g.days}d</span>
                    <button
                      type="button"
                      onClick={() => adjustDays(idx, +1)}
                      disabled={disabled}
                      className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-base disabled:opacity-30 cursor-pointer transition-colors"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCity(idx)}
                      disabled={disabled || groups.length <= 1}
                      className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-slate-300 hover:text-red-400 disabled:opacity-30 cursor-pointer transition-colors ml-1"
                      title="Quitar ciudad"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expandable preview */}
                {isExpanded && (
                  <div className="mt-1 ml-10 border-l-2 border-sky-100 pl-3">
                    <CityPreviewPanel city={g.city} country={g.country} />
                  </div>
                )}
              </div>
              {idx < groups.length - 1 && (
                <TransportConnector from={g} to={groups[idx + 1]} />
              )}
            </div>
          );
        })}
      </div>

      {/* Day balance warning */}
      {!isComplete && (
        <div className={`mx-4 mb-3 rounded-xl px-3 py-2 border ${
          delta > 0
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}>
          <p className="text-xs font-semibold">
            {delta > 0
              ? `Sobran ${delta} día${delta > 1 ? 's' : ''} — reduce días en alguna ciudad o quita una.`
              : `Faltan ${-delta} día${-delta > 1 ? 's' : ''} — agrégalos a alguna ciudad o pide cambios al agente.`
            }
          </p>
        </div>
      )}

      {/* Highlights */}
      {proposal.highlights.length > 0 && (
        <div className="px-4 pb-3 border-t border-slate-100 pt-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Destacados</div>
          <div className="space-y-1">
            {proposal.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-adventure-400 text-xs mt-0.5 flex-shrink-0">✦</span>
                <span className="text-slate-600 text-xs">{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-3 border-t border-slate-100 pt-3">
        <button
          onClick={handleApprove}
          disabled={disabled || !isComplete}
          className="flex-1 h-11 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Aprobar y generar
        </button>
        <button
          onClick={onRequestChanges}
          disabled={disabled}
          className="flex-1 h-11 border border-slate-200 text-slate-600 font-semibold text-sm rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer hover:bg-slate-50"
        >
          Pedir cambios al agente
        </button>
      </div>
    </div>
  );
}

// ── Generation Progress ───────────────────────────────────────────────────────

interface DayProgress {
  dayNumber: number;
  dayDate: string;
  city?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
}

function GeneratingView({
  progress,
  totalDays,
  generationError,
  onDone,
}: {
  progress: DayProgress[];
  totalDays: number;
  generationError: string;
  onDone: () => void;
}) {
  const doneDays = progress.filter((d) => d.status === 'done').length;
  const pct = Math.round((doneDays / totalDays) * 100);
  const hasError = !!generationError;

  return (
    <div className="space-y-4 py-2">
      <div className="text-center">
        <div className="text-slate-900 font-bold text-base">
          {hasError ? 'Generación interrumpida' : doneDays === totalDays ? '¡Itinerario listo!' : 'Generando itinerario...'}
        </div>
        <div className="text-slate-500 text-sm mt-0.5">{doneDays} de {totalDays} días completados</div>
      </div>

      <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${hasError ? 'bg-amber-400' : 'bg-adventure-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {hasError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
          <p className="text-amber-700 text-xs font-semibold mb-1">Error en la generación</p>
          <p className="text-amber-600 text-xs">{generationError}</p>
          <p className="text-slate-500 text-xs mt-1">Los días generados hasta ahora están guardados.</p>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {progress.map((day) => (
          <div key={day.dayNumber} className="flex items-center gap-3">
            {day.status === 'done' && (
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {day.status === 'generating' && (
              <div className="w-5 h-5 rounded-full border-2 border-adventure-500 border-t-transparent animate-spin flex-shrink-0" />
            )}
            {day.status === 'error' && (
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-600 text-[10px] font-bold">!</span>
              </div>
            )}
            {day.status === 'pending' && (
              <div className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0" />
            )}
            <span className={`text-sm ${
              day.status === 'done'      ? 'text-slate-900' :
              day.status === 'generating'? 'text-adventure-500 font-medium' :
              day.status === 'error'     ? 'text-amber-600' :
              'text-slate-400'
            }`}>
              Día {day.dayNumber}{day.city && ` — ${day.city}`}
            </span>
          </div>
        ))}
      </div>

      {(doneDays === totalDays || hasError) && (
        <button
          onClick={onDone}
          className={`w-full h-12 font-bold text-sm rounded-xl active:scale-95 transition-all cursor-pointer ${
            hasError ? 'bg-amber-500 text-white' : 'bg-adventure-500 hover:bg-adventure-600 text-white'
          }`}
        >
          {hasError ? `Ver ${doneDays} días generados` : 'Ver itinerario completo'}
        </button>
      )}
    </div>
  );
}

// ── Main PlanningAgent Component ──────────────────────────────────────────────

export function PlanningAgent({ tripId, tripTitle, destination, totalDays }: PlanningAgentProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<DayProgress[]>([]);
  const [generationError, setGenerationError] = useState('');
  const [pendingChangesMode, setPendingChangesMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function init() {
      setInitializing(true);
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary/agent`);
        const data = await res.json() as { data?: PlanningMessage[] };
        const history = data.data ?? [];

        if (history.length === 0) {
          await sendMessage('__start__', true);
        } else {
          setMessages(history.map(parseAgentMessage));
        }
      } finally {
        setInitializing(false);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  async function sendMessage(text: string, isAutoStart = false) {
    if (!isAutoStart) {
      if (!text.trim()) return;
      const userMsg: DisplayMessage = {
        id: Date.now().toString(),
        role: 'user',
        type: 'user',
        content: text.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json() as { data?: AgentResponse; error?: string };

      if (!res.ok || !data.data) {
        setMessages((prev) => [...prev, {
          id: Date.now().toString(),
          role: 'agent',
          type: 'message',
          content: data.error ?? 'Hubo un error. Inténtalo de nuevo.',
        }]);
        return;
      }

      const agentMsg: DisplayMessage = {
        id: Date.now().toString() + '_agent',
        role: 'agent',
        type: data.data.type,
        content: data.data.content,
        proposal: data.data.proposal,
      };
      setMessages((prev) => [...prev, agentMsg]);
    } finally {
      setLoading(false);
      setPendingChangesMode(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleApprove(cityAssignments: CityAssignment[]) {
    setGenerating(true);
    setGenerationError('');
    const skeleton: DayProgress[] = Array.from({ length: totalDays }, (_, i) => ({
      dayNumber: i + 1,
      dayDate: '',
      city: cityAssignments[i]?.city,
      status: i < 3 ? 'generating' : 'pending',
    }));
    setGenerationProgress(skeleton);

    try {
      const response = await fetch(`/api/trips/${tripId}/itinerary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityAssignments }),
      });

      if (!response.ok || !response.body) {
        setGenerationError('No se pudo iniciar la generación. Inténtalo de nuevo.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completedCount = 0;

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
              if (eventType === 'day_complete') {
                const dayNum = payload.dayNumber as number;
                completedCount++;
                const nextBatchEnd = completedCount + 3;
                setGenerationProgress((prev) =>
                  prev.map((d) => {
                    if (d.dayNumber === dayNum) return { ...d, status: 'done' };
                    if (d.dayNumber > dayNum && d.dayNumber <= nextBatchEnd && d.status === 'pending') {
                      return { ...d, status: 'generating' };
                    }
                    return d;
                  })
                );
              } else if (eventType === 'error') {
                const msg = (payload.message as string) ?? 'Error desconocido al generar';
                setGenerationError(msg);
                setGenerationProgress((prev) =>
                  prev.map((d) =>
                    d.status === 'pending' || d.status === 'generating' ? { ...d, status: 'error' } : d
                  )
                );
              }
            } catch { /* ignore parse errors */ }
            eventType = '';
          }
        }
      }

      setGenerationProgress((prev) =>
        prev.map((d) => (d.status === 'pending' || d.status === 'generating' ? { ...d, status: 'done' } : d))
      );
    } catch (e) {
      setGenerationError((e as Error).message ?? 'Error de conexión');
      setGenerationProgress((prev) =>
        prev.map((d) =>
          d.status === 'pending' || d.status === 'generating' ? { ...d, status: 'error' } : d
        )
      );
    }
  }

  async function handleReset() {
    if (!confirm('¿Reiniciar la conversación con el agente?')) return;
    await fetch(`/api/trips/${tripId}/itinerary/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
    setMessages([]);
    setGenerating(false);
    setGenerationProgress([]);
    setGenerationError('');
    setInitializing(true);
    await sendMessage('__start__', true);
    setInitializing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const lastProposal = messages.findLast((m) => m.type === 'proposal');
  const hasProposal = !!lastProposal;

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] animate-fade-in">
      {/* Header */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-card mb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-adventure-500/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-adventure-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <div className="text-slate-900 font-bold text-sm">Agente planificador</div>
              <div className="text-slate-400 text-xs">{destination} · {totalDays} días</div>
            </div>
          </div>
          {messages.length > 0 && !generating && (
            <button
              onClick={handleReset}
              className="text-slate-400 text-xs hover:text-slate-600 transition-colors cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100"
            >
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Generating view */}
      {generating && (
        <div className="flex-1 overflow-y-auto px-1">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-card">
            <GeneratingView
              progress={generationProgress}
              totalDays={totalDays}
              generationError={generationError}
              onDone={() => router.push(`/trips/${tripId}`)}
            />
          </div>
        </div>
      )}

      {/* Chat messages */}
      {!generating && (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pb-2 px-1">
            {initializing && (
              <div className="flex justify-center py-8">
                <div className="flex items-center gap-3 text-slate-400 text-sm">
                  <div className="w-5 h-5 border-2 border-adventure-500 border-t-transparent rounded-full animate-spin" />
                  Preparando el agente...
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] bg-adventure-500 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                ) : msg.type === 'proposal' && msg.proposal ? (
                  <div className="w-full">
                    {msg.content && (
                      <div className="text-slate-600 text-sm mb-3 leading-relaxed">{msg.content}</div>
                    )}
                    <ProposalCard
                      proposal={msg.proposal}
                      totalDays={totalDays}
                      onApprove={handleApprove}
                      onRequestChanges={() => {
                        setPendingChangesMode(true);
                        setInput('Me gustaría cambiar: ');
                        setTimeout(() => {
                          inputRef.current?.focus();
                          inputRef.current?.setSelectionRange(99, 99);
                        }, 50);
                      }}
                      disabled={loading || generating || msg.id !== lastProposal?.id}
                    />
                  </div>
                ) : (
                  <div className="max-w-[90%] bg-white border border-slate-200 text-slate-700 text-sm rounded-2xl rounded-tl-sm px-4 py-3 leading-relaxed shadow-sm">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 pt-3">
            {pendingChangesMode && hasProposal && (
              <div className="text-xs text-amber-600 mb-2 px-1 font-medium">
                Describe los cambios que quieres en el plan:
              </div>
            )}
            <div className="flex gap-3 items-end bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasProposal ? 'Responde al agente o pide cambios al plan...' : 'Escribe tu respuesta...'}
                rows={1}
                disabled={loading || initializing}
                className="flex-1 bg-transparent text-slate-900 text-sm placeholder-slate-400 outline-none resize-none leading-relaxed max-h-32"
                style={{ field_sizing: 'content' } as React.CSSProperties}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || initializing || !input.trim()}
                className="w-9 h-9 bg-adventure-500 hover:bg-adventure-600 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-all disabled:opacity-40 cursor-pointer"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5 px-1">Enter para enviar · Shift+Enter para nueva línea</p>
          </div>
        </>
      )}
    </div>
  );
}
