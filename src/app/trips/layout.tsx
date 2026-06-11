// src/app/trips/layout.tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { NavLink } from '@/components/ui/NavLink';
import { UserMenu } from '@/components/ui/UserMenu';

export default async function TripsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-dvh bg-sand-50 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/trips" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-adventure-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-lg">TripPlan</span>
          </Link>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1">
              <NavLink href="/trips">Mis Viajes</NavLink>
              <NavLink href="/trips/new">+ Nuevo</NavLink>
            </nav>
            <UserMenu
              userName={session.user.name ?? 'Usuario'}
              userEmail={session.user.email}
            />
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {children}
      </main>
    </div>
  );
}
