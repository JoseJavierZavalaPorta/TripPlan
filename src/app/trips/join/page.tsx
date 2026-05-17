'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface InviteInfo {
  email: string;
  tripId: string;
  tripTitle: string;
  userExists: boolean;
}

function JoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') ?? '';

  const [info, setInfo]         = useState<InviteInfo | null>(null);
  const [tokenError, setTokenError] = useState('');
  const [name, setName]         = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!token) { setTokenError('No se encontró el enlace de invitación.'); return; }
    fetch(`/api/invite?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then((d: { data?: InviteInfo; error?: string }) => {
        if (d.error || !d.data) setTokenError(d.error ?? 'Enlace inválido');
        else setInfo(d.data);
      })
      .catch(() => setTokenError('Error al verificar el enlace'));
  }, [token]);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!info) return;
    setError('');
    setLoading(true);
    try {
      const body: Record<string, string> = { token };
      if (!info.userExists) {
        if (!name.trim()) { setError('Tu nombre es requerido'); setLoading(false); return; }
        if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); setLoading(false); return; }
        body.name = name.trim();
        body.password = password;
      }

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { data?: { tripId: string; email: string }; error?: string };
      if (!res.ok) { setError(data.error ?? 'Error al unirse'); setLoading(false); return; }

      // Sign in and redirect to the trip
      await signIn('email-password', {
        email: info.email,
        password: info.userExists ? password : password,
        callbackUrl: `/trips/${data.data!.tripId}`,
        redirect: false,
      });
      router.push(`/trips/${data.data!.tripId}`);
    } catch {
      setError('Error inesperado. Intenta de nuevo.');
      setLoading(false);
    }
  }

  if (tokenError) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">🔗</div>
        <h2 className="text-xl font-bold text-white">Enlace inválido</h2>
        <p className="text-slate-400 text-sm">{tokenError}</p>
        <Link href="/trips" className="block w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl flex items-center justify-center">
          Ir a mis viajes
        </Link>
      </div>
    );
  }

  if (!info) {
    return <p className="text-center text-slate-400 text-sm animate-pulse">Verificando invitación...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl mb-3">✈️</div>
        <h1 className="text-2xl font-bold text-white">¡Te invitaron a un viaje!</h1>
        <p className="text-slate-400 text-sm mt-1">
          <span className="text-sky-400 font-semibold">{info.tripTitle}</span>
        </p>
      </div>

      <form onSubmit={handleJoin} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="bg-navy-800 rounded-xl p-4 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email (invitado)</label>
            <p className="text-white text-base">{info.email}</p>
          </div>

          {!info.userExists && (
            <>
              <div className="border-t border-slate-700 pt-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tu nombre</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Nombre completo" required autoFocus
                  className="w-full bg-transparent text-white text-base placeholder-slate-600 outline-none"
                />
              </div>
              <div className="border-t border-slate-700 pt-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Crea tu contraseña</label>
                <div className="flex items-center">
                  <input
                    type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres" required
                    className="flex-1 bg-transparent text-white text-base placeholder-slate-600 outline-none"
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="text-slate-500 ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    {showPw ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </>
          )}

          {info.userExists && (
            <div className="border-t border-slate-700 pt-3">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Contraseña</label>
              <div className="flex items-center">
                <input
                  type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Tu contraseña" required
                  className="flex-1 bg-transparent text-white text-base placeholder-slate-600 outline-none"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="text-slate-500 ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl active:scale-95 transition-transform disabled:opacity-60"
        >
          {loading ? 'Uniéndose...' : info.userExists ? 'Iniciar sesión y unirme' : 'Crear cuenta y unirme'}
        </button>

        {!info.userExists && (
          <p className="text-center text-slate-500 text-xs">
            ¿Ya tienes cuenta?{' '}
            <Link href={`/auth/login?callbackUrl=/trips/join?token=${token}`} className="text-sky-400">
              Inicia sesión aquí
            </Link>
          </p>
        )}
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-dvh bg-navy-900 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Suspense fallback={<p className="text-center text-slate-400 text-sm animate-pulse">Cargando...</p>}>
          <JoinContent />
        </Suspense>
      </div>
    </div>
  );
}
