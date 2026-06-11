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
    <div className="min-h-dvh bg-sand-50 flex flex-col overflow-hidden">
      {/* Decorative blobs */}
      <div className="pointer-events-none fixed top-0 left-0 w-80 h-80 bg-sky-100 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl opacity-70" />
      <div className="pointer-events-none fixed bottom-0 right-0 w-72 h-72 bg-orange-100 rounded-full translate-x-1/3 translate-y-1/3 blur-3xl opacity-70" />

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center relative z-10">
        {/* Logo mark */}
        <div className="w-20 h-20 rounded-2xl bg-adventure-500 flex items-center justify-center mb-8 shadow-glow mx-auto">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 leading-tight">
          Planifica el viaje<br />
          <span className="text-adventure-500">perfecto juntos</span>
        </h1>

        <p className="text-slate-500 text-lg max-w-sm mb-10 mx-auto leading-relaxed">
          Itinerarios personalizados con IA, coordina con tu grupo y gestiona el presupuesto compartido.
        </p>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mb-10 max-w-sm w-full mx-auto">
          {[
            {
              icon: (
                <svg className="w-5 h-5 text-adventure-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              ),
              label: 'IA Generativa',
              bg: 'bg-orange-50 border-orange-100',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-sky-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              ),
              label: 'Colaborativo',
              bg: 'bg-sky-50 border-sky-100',
            },
            {
              icon: (
                <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              ),
              label: 'Mapas',
              bg: 'bg-teal-50 border-teal-100',
            },
          ].map((f) => (
            <div key={f.label} className={`${f.bg} border rounded-xl p-3 text-center`}>
              <div className="flex justify-center mb-1.5">{f.icon}</div>
              <div className="text-slate-600 text-xs font-semibold">{f.label}</div>
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="w-full max-w-sm space-y-3 mx-auto">
          <Link
            href="/auth/register"
            className="block w-full h-12 bg-adventure-500 hover:bg-adventure-600 text-white font-bold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-colors"
          >
            Crear cuenta gratis
          </Link>
          <Link
            href="/auth/login"
            className="block w-full h-12 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-xl flex items-center justify-center active:scale-95 transition-colors"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>

      <p className="text-center text-slate-400 text-xs pb-6 relative z-10">
        TripPlan &copy; {new Date().getFullYear()}
      </p>
    </div>
  );
}
