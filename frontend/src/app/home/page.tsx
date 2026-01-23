'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/hooks/useMatches';
import { MobileLayout } from '@/components/MobileLayout';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const router = useRouter();
  const { user, userData, loading, signOut } = useAuth();
  const { matches, loading: matchesLoading } = useMatches();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && user && !userData?.role) {
      router.push('/onboarding');
    }
  }, [loading, user, userData, router]);

  if (loading || !userData?.role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isWorker = userData.role === 'worker';
  const pendingMatches = matches.filter(m => m.status === 'pending').length;
  const acceptedMatches = matches.filter(m => m.status === 'accepted').length;

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            ¡Hola! 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isWorker ? 'Encontrá tu próximo trabajo' : 'Encontrá al empleado ideal'}
          </p>
        </div>

        {/* Profile Alert */}
        {!userData.profile && (
          <Link href={isWorker ? '/worker/profile' : '/employer/profile'}>
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-4 mb-6 text-white active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Completá tu perfil</p>
                  <p className="text-blue-100 text-sm">Para recibir matches</p>
                </div>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Link href="/matches">
            <div className="bg-white rounded-2xl p-4 shadow-sm border active:scale-[0.98] transition-transform">
              <div className="flex items-center justify-between mb-2">
                <span className="text-3xl">🤝</span>
                {pendingMatches > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {pendingMatches}
                  </Badge>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">{pendingMatches}</p>
              <p className="text-gray-500 text-sm">Nuevos matches</p>
            </div>
          </Link>

          <Link href="/chats">
            <div className="bg-white rounded-2xl p-4 shadow-sm border active:scale-[0.98] transition-transform">
              <span className="text-3xl">💬</span>
              <p className="text-2xl font-bold text-gray-900 mt-2">{acceptedMatches}</p>
              <p className="text-gray-500 text-sm">Conversaciones</p>
            </div>
          </Link>
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Acciones rápidas</h2>

        <div className="space-y-3">
          <Link href={isWorker ? '/worker/profile' : '/employer/profile'}>
            <div className="bg-white rounded-2xl p-4 shadow-sm border flex items-center active:scale-[0.98] transition-transform">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Mi Perfil</p>
                <p className="text-gray-500 text-sm">
                  {userData.profile ? 'Ver y editar' : 'Completar perfil'}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          {!isWorker && (
            <Link href="/employer/jobs">
              <div className="bg-white rounded-2xl p-4 shadow-sm border flex items-center active:scale-[0.98] transition-transform">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Nueva Oferta</p>
                  <p className="text-gray-500 text-sm">Publicar búsqueda</p>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          )}

          <Link href="/matches">
            <div className="bg-white rounded-2xl p-4 shadow-sm border flex items-center active:scale-[0.98] transition-transform">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Ver Matches</p>
                <p className="text-gray-500 text-sm">
                  {pendingMatches > 0 ? `${pendingMatches} pendientes` : 'Sin pendientes'}
                </p>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        </div>

        {/* Sign Out */}
        <button
          onClick={() => signOut().then(() => router.push('/'))}
          className="w-full mt-8 py-3 text-gray-500 text-sm"
        >
          Cerrar sesión
        </button>
      </div>
    </MobileLayout>
  );
}
