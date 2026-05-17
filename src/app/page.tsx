// src/app/page.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function HomePage() {
  const session = await auth();

  // Authenticated users go straight to their trips
  if (session?.user) {
    redirect('/trips');
  }

  return (
    <div className="min-h-dvh bg-navy-900 flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        {/* Logo mark */}
        <div className="w-20 h-20 rounded-2xl bg-sky-400 flex items-center justify-center mb-8 shadow-glow">
          <svg className="w-10 h-10 text-navy-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight">
          Planifica el viaje<br />
          <span className="text-sky-400">perfecto juntos</span>
        </h1>

        <p className="text-slate-400 text-lg max-w-sm mb-10">
          Itinerarios personalizados con IA, coordina con tu grupo y gestiona el presupuesto compartido.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-4 mb-12 max-w-sm w-full">
          {[
            { icon: '🤖', label: 'IA Generativa' },
            { icon: '👥', label: 'Colaborativo' },
            { icon: '🗺️', label: 'Mapas' },
          ].map((f) => (
            <div key={f.label} className="bg-navy-800 rounded-xl p-3 text-center">
              <div className="text-2xl mb-1">{f.icon}</div>
              <div className="text-slate-400 text-xs font-medium">{f.label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="w-full max-w-sm space-y-3">
          <Link
            href="/auth/register"
            className="block w-full h-12 bg-sky-400 text-navy-900 font-bold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/auth/login"
            className="block w-full h-12 border border-slate-600 text-slate-300 font-semibold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-transform"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      <p className="text-center text-slate-600 text-xs pb-6">
        TripPlan &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
