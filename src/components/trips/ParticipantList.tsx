'use client';

import { useState } from 'react';
import { TripParticipant } from '@/types';
import Link from 'next/link';

interface ParticipantListProps {
  participants: TripParticipant[];
  currentUserId: string;
  isLeader: boolean;
  tripId: string;
}

const ROLE_LABELS = { leader: 'Líder', member: 'Viajero' };
const STATUS_COLORS = { accepted: 'text-green-400', pending: 'text-amber-400', declined: 'text-red-400' };
const STATUS_LABELS = { accepted: 'Aceptado', pending: 'Pendiente', declined: 'Declinó' };

function PermissionToggle({
  participant, tripId, isCurrentUser,
}: { participant: TripParticipant; tripId: string; isCurrentUser: boolean }) {
  const [canEdit, setCanEdit] = useState(participant.canEdit);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !canEdit;
    const res = await fetch(`/api/trips/${tripId}/participants/${participant.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canEdit: next }),
    });
    if (res.ok) setCanEdit(next);
    setLoading(false);
  }

  if (isCurrentUser) return null;

  return (
    <button
      onClick={() => void toggle()}
      disabled={loading}
      title={canEdit ? 'Puede sugerir actividades. Click para cambiar a solo vista.' : 'Solo puede ver. Click para permitir sugerir.'}
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors disabled:opacity-50"
      style={canEdit
        ? { background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }
        : { background: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}
    >
      {loading ? '⏳' : canEdit ? '✏️ Puede sugerir' : '👁️ Solo ver'}
    </button>
  );
}

export function ParticipantList({ participants, currentUserId, isLeader, tripId }: ParticipantListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-slate-400 text-sm">
          {participants.length} {participants.length === 1 ? 'viajero' : 'viajeros'}
        </span>
        {isLeader && (
          <Link
            href={`/trips/${tripId}/invite`}
            className="text-sky-400 text-sm font-semibold flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Invitar
          </Link>
        )}
      </div>

      {isLeader && (
        <p className="text-slate-500 text-xs">
          Controla qué viajeros pueden sugerir actividades (requieren tu aprobación) o solo ver el itinerario.
        </p>
      )}

      <div className="space-y-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="bg-navy-800 rounded-xl p-4 border border-slate-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-400/20 flex items-center justify-center flex-shrink-0 text-sky-400 font-bold text-base">
                {p.userName.charAt(0).toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-medium text-sm truncate">{p.userName}</span>
                  {p.userId === currentUserId && (
                    <span className="text-xs text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded-full">Tú</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-slate-500 text-xs">{ROLE_LABELS[p.role]}</span>
                  <span className="text-slate-700">·</span>
                  <span className={`text-xs ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                  {p.userEmail && (
                    <>
                      <span className="text-slate-700">·</span>
                      <span className="text-slate-600 text-xs truncate max-w-[140px]">{p.userEmail}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Permission toggle — only leader sees this, only for non-leader members */}
              {isLeader && p.role !== 'leader' && (
                <PermissionToggle
                  participant={p}
                  tripId={tripId}
                  isCurrentUser={p.userId === currentUserId}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
