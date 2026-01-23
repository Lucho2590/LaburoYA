'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/hooks/useMatches';
import { Match } from '@/types';
import { JOB_CATEGORIES, Rubro } from '@/config/constants';
import { MobileLayout } from '@/components/MobileLayout';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function MatchesPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { matches, loading: matchesLoading, updateMatchStatus } = useMatches();
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted'>('pending');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const handleAccept = async (matchId: string) => {
    try {
      await updateMatchStatus(matchId, 'accepted');
      toast.success('¡Match aceptado! Ya podés chatear');
    } catch {
      toast.error('Error al aceptar');
    }
  };

  const handleReject = async (matchId: string) => {
    try {
      await updateMatchStatus(matchId, 'rejected');
      toast.success('Match rechazado');
    } catch {
      toast.error('Error al rechazar');
    }
  };

  if (loading || matchesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isWorker = userData?.role === 'worker';
  const pendingMatches = matches.filter(m => m.status === 'pending');
  const acceptedMatches = matches.filter(m => m.status === 'accepted');

  const MatchCard = ({ match }: { match: Match }) => {
    const isPending = match.status === 'pending';

    return (
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {/* Header with emoji/avatar */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-4 text-white">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl mr-3">
              {isWorker ? '🏢' : '👤'}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {isWorker
                  ? match.employer?.businessName || 'Empresa'
                  : match.worker?.puesto || match.puesto}
              </h3>
              <p className="text-white/80 text-sm">
                {JOB_CATEGORIES[match.rubro as Rubro]?.label || match.rubro}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isWorker ? (
            <>
              <div className="flex items-center text-gray-600 text-sm mb-2">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {match.puesto}
              </div>
              {match.jobOffer?.salary && (
                <div className="flex items-center text-gray-600 text-sm mb-2">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {match.jobOffer.salary}
                </div>
              )}
              {match.jobOffer?.description && (
                <p className="text-gray-500 text-sm line-clamp-2">{match.jobOffer.description}</p>
              )}
            </>
          ) : (
            <>
              {match.worker?.zona && (
                <div className="flex items-center text-gray-600 text-sm mb-2">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {match.worker.zona}
                </div>
              )}
              {match.worker?.description && (
                <p className="text-gray-500 text-sm line-clamp-2">{match.worker.description}</p>
              )}
              {match.worker?.videoUrl && (
                <Badge variant="secondary" className="mt-2">
                  🎥 Tiene video
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {isPending ? (
          <div className="flex border-t">
            <button
              onClick={() => handleReject(match.id)}
              className="flex-1 py-4 text-gray-500 font-medium active:bg-gray-100 transition-colors"
            >
              ✕ Pasar
            </button>
            <div className="w-px bg-gray-200" />
            <button
              onClick={() => handleAccept(match.id)}
              className="flex-1 py-4 text-blue-600 font-medium active:bg-blue-50 transition-colors"
            >
              ✓ Aceptar
            </button>
          </div>
        ) : (
          <Link href={`/chat/${match.id}`}>
            <div className="border-t py-4 text-center text-blue-600 font-medium active:bg-blue-50 transition-colors">
              💬 Ir al chat
            </div>
          </Link>
        )}
      </div>
    );
  };

  return (
    <MobileLayout title="Matches">
      <div className="px-4 py-4">
        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'pending'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Pendientes ({pendingMatches.length})
          </button>
          <button
            onClick={() => setActiveTab('accepted')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'accepted'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Aceptados ({acceptedMatches.length})
          </button>
        </div>

        {/* List */}
        {activeTab === 'pending' ? (
          pendingMatches.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-5xl">📋</span>
              <p className="text-gray-500 mt-4">No hay matches pendientes</p>
              <p className="text-gray-400 text-sm mt-1">
                {isWorker
                  ? 'Completá tu perfil para recibir ofertas'
                  : 'Publicá ofertas para encontrar candidatos'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>
          )
        ) : acceptedMatches.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">✅</span>
            <p className="text-gray-500 mt-4">No hay matches aceptados</p>
            <p className="text-gray-400 text-sm mt-1">
              Aceptá matches para poder chatear
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {acceptedMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
