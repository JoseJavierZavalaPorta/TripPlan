// src/app/trips/[id]/invite/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function InvitePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    inviteUrl: string;
    userExists: boolean;
  } | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${params.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as {
        data?: { inviteUrl: string; userExists: boolean };
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? 'Error al invitar');
        return;
      }
      setResult(data.data!);
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // fallback: select the text
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href={`/trips/${params.id}`} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Invitar viajeros</h1>
          <p className="text-slate-400 text-sm">Ingresa el email del invitado</p>
        </div>
      </div>

      {!result ? (
        <form onSubmit={handleInvite} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="bg-navy-800 rounded-xl p-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Email del invitado
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="amigo@email.com"
              required
              autoFocus
              className="w-full bg-transparent text-white text-base placeholder-slate-600 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? 'Enviando invitación...' : 'Invitar'}
          </button>
        </form>
      ) : (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-sm">
            {result.userExists
              ? `Invitación enviada. ${email} ya tiene cuenta — se les ha añadido al viaje.`
              : `Invitación creada. Comparte el enlace con ${email}.`}
          </div>

          <div className="bg-navy-800 rounded-xl p-4">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Enlace de invitación
            </label>
            <p className="text-slate-300 text-sm break-all mb-3">{result.inviteUrl}</p>
            <button
              onClick={() => copyLink(result.inviteUrl)}
              className="w-full h-11 border border-sky-400/30 text-sky-400 font-semibold text-sm rounded-xl active:scale-95 transition-transform"
            >
              Copiar enlace
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setResult(null); setEmail(''); }}
              className="flex-1 h-11 border border-slate-700 text-slate-400 font-medium text-sm rounded-xl active:scale-95 transition-transform"
            >
              Invitar otro
            </button>
            <button
              onClick={() => router.push(`/trips/${params.id}`)}
              className="flex-1 h-11 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform"
            >
              Volver al viaje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
