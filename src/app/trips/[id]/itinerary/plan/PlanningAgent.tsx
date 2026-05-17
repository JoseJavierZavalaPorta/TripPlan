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

// ── Utility: parse a stored agent message ────────────────────────────────────

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

// ── Proposal Card ────────────────────────────────────────────────────────────

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
  // Group city assignments for display
  const cityGroups: Array<{ city: string; country: string; flag: string; days: number[] }> = [];
  for (const ca of proposal.cityAssignments) {
    const last = cityGroups[cityGroups.length - 1];
    if (last && last.city === ca.city && last.country === ca.country) {
      last.days.push(ca.day);
    } else {
      cityGroups.push({ city: ca.city, country: ca.country, flag: ca.flag, days: [ca.day] });
    }
  }

  function handleApprove() {
    const assignments: CityAssignment[] = proposal.cityAssignments.map((ca) => ({
      city: ca.city,
      country: ca.country,
      flag: ca.flag,
    }));
    onApprove(assignments);
  }

  const isComplete = proposal.cityAssignments.length === totalDays;

  return (
    <div className="bg-navy-900 border border-teal-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-teal-500/10 px-4 py-3 border-b border-teal-500/20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-teal-500/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-10l6-3m0 0l5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17m0-13v13" />
            </svg>
          </div>
          <span className="text-teal-400 text-xs font-bold uppercase tracking-wider">Plan propuesto</span>
        </div>
        <p className="text-white text-sm font-semibold mt-2">{proposal.summary}</p>
      </div>

      {/* City route */}
      <div className="px-4 py-3 space-y-2">
        {cityGroups.map((cg, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-700/50 flex items-center justify-center text-lg flex-shrink-0">
              {cg.flag}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-sm font-semibold">{cg.city}</div>
              <div className="text-slate-500 text-xs">{cg.country}</div>
            </div>
            <div className="flex-shrink-0">
              <span className="text-slate-400 text-xs bg-slate-700/50 px-2 py-0.5 rounded-full">
                {cg.days.length}d
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Highlights */}
      {proposal.highlights.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Destacados</div>
          <div className="space-y-1">
            {proposal.highlights.map((h, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-teal-400 text-xs mt-0.5">✦</span>
                <span className="text-slate-400 text-xs">{h}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation warning */}
      {!isComplete && (
        <div className="mx-4 mb-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          <p className="text-amber-400 text-xs">
            El plan tiene {proposal.cityAssignments.length} días asignados pero el viaje tiene {totalDays}. Puedes pedirle al agente que lo corrija.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-4 pb-4 flex gap-3">
        <button
          onClick={handleApprove}
          disabled={disabled || !isComplete}
          className="flex-1 h-11 bg-teal-500 text-white font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Aprobar y generar
        </button>
        <button
          onClick={onRequestChanges}
          disabled={disabled}
          className="flex-1 h-11 border border-slate-600 text-slate-300 font-semibold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50"
        >
          Pedir cambios
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
    <div className="space-y-4 py-4">
      <div className="text-center">
        <div className="text-white font-bold mb-1">
          {hasError ? 'Generación interrumpida' : doneDays === totalDays ? '¡Itinerario listo!' : 'Generando itinerario...'}
        </div>
        <div className="text-slate-400 text-sm">{doneDays} de {totalDays} días completados</div>
      </div>

      <div className="bg-slate-700/50 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${hasError ? 'bg-amber-400' : 'bg-teal-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {hasError && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <p className="text-amber-400 text-xs font-semibold mb-1">Error en la generación</p>
          <p className="text-amber-300/80 text-xs">{generationError}</p>
          <p className="text-slate-400 text-xs mt-1">Los días generados hasta ahora están guardados. Puedes ver el itinerario parcial o reintentar.</p>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {progress.map((day) => (
          <div key={day.dayNumber} className="flex items-center gap-3">
            {day.status === 'done' && (
              <div className="w-5 h-5 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {day.status === 'generating' && (
              <div className="w-5 h-5 rounded-full border-2 border-teal-400 border-t-transparent animate-spin flex-shrink-0" />
            )}
            {day.status === 'error' && (
              <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-amber-400 text-[10px] font-bold">!</span>
              </div>
            )}
            {day.status === 'pending' && (
              <div className="w-5 h-5 rounded-full border-2 border-slate-600 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${
                day.status === 'done' ? 'text-white' :
                day.status === 'generating' ? 'text-teal-400' :
                day.status === 'error' ? 'text-amber-400' :
                'text-slate-600'
              }`}>
                Día {day.dayNumber}
                {day.city && ` — ${day.city}`}
              </span>
            </div>
          </div>
        ))}
      </div>

      {(doneDays === totalDays || hasError) && (
        <button
          onClick={onDone}
          className={`w-full h-12 font-bold text-sm rounded-xl active:scale-95 transition-transform ${
            hasError ? 'bg-amber-500 text-white' : 'bg-teal-400 text-navy-900'
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

  // Load history on mount
  useEffect(() => {
    async function init() {
      setInitializing(true);
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary/agent`);
        const data = await res.json() as { data?: PlanningMessage[] };
        const history = data.data ?? [];

        if (history.length === 0) {
          // Auto-start: trigger agent's first response
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

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, generating]);

  async function sendMessage(text: string, isAutoStart = false) {
    if (!isAutoStart) {
      if (!text.trim()) return;
      // Add user message to UI immediately
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
    // Initialize progress skeleton — mark first batch as 'generating'
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
                    // Mark next batch as generating
                    if (d.dayNumber > dayNum && d.dayNumber <= nextBatchEnd && d.status === 'pending') {
                      return { ...d, status: 'generating' };
                    }
                    return d;
                  })
                );
              } else if (eventType === 'error') {
                const msg = (payload.message as string) ?? 'Error desconocido al generar';
                setGenerationError(msg);
                // Mark remaining pending/generating days as error
                setGenerationProgress((prev) =>
                  prev.map((d) =>
                    d.status === 'pending' || d.status === 'generating'
                      ? { ...d, status: 'error' }
                      : d
                  )
                );
              }
            } catch { /* ignore parse errors */ }
            eventType = '';
          }
        }
      }

      // If no error was received, mark any remaining days as done
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
      <div className="bg-navy-800 rounded-2xl p-4 border border-slate-700/50 mb-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-400/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-bold text-sm">Agente planificador</div>
                <div className="text-slate-500 text-xs">{destination} · {totalDays} días</div>
              </div>
            </div>
          </div>
          {messages.length > 0 && !generating && (
            <button onClick={handleReset} className="text-slate-600 text-xs hover:text-slate-400 transition-colors">
              Reiniciar
            </button>
          )}
        </div>
      </div>

      {/* Generating view */}
      {generating && (
        <div className="flex-1 overflow-y-auto px-1">
          <div className="bg-navy-800 rounded-2xl p-5 border border-teal-500/20">
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
                <div className="flex items-center gap-3 text-slate-500 text-sm">
                  <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                  Consultando contexto del viaje...
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] bg-sky-400/20 border border-sky-400/30 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-3 leading-relaxed">
                    {msg.content}
                  </div>
                ) : msg.type === 'proposal' && msg.proposal ? (
                  <div className="w-full">
                    <div className="text-slate-400 text-sm mb-3 leading-relaxed">{msg.content}</div>
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
                  <div className="max-w-[90%] bg-navy-800 border border-slate-700/50 text-slate-300 text-sm rounded-2xl rounded-tl-sm px-4 py-3 leading-relaxed">
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-navy-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 pt-3">
            {pendingChangesMode && hasProposal && (
              <div className="text-xs text-amber-400 mb-2 px-1">
                Describe los cambios que quieres en el plan:
              </div>
            )}
            <div className="flex gap-3 items-end bg-navy-800 border border-slate-700/50 rounded-2xl p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={hasProposal ? 'Responde al agente o pide cambios al plan...' : 'Escribe tu respuesta...'}
                rows={1}
                disabled={loading || initializing}
                className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 outline-none resize-none leading-relaxed max-h-32"
                style={{ field_sizing: 'content' } as React.CSSProperties}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || initializing || !input.trim()}
                className="w-9 h-9 bg-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform disabled:opacity-40"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
