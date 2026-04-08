'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useMatches } from '@/hooks/useMatches';
import { useReceivedContactRequests } from '@/hooks/useContactRequests';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { IMatch, IContactRequest } from '@/types';
import { JOB_CATEGORIES, TRubro } from '@/config/constants';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function MatchesPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { matches, loading: matchesLoading, refetch: refetchMatches } = useMatches();
  const { requests: pendingRequests, loading: requestsLoading, respondToRequest } = useReceivedContactRequests();
  const { setPageConfig } = usePageTitle();
  const [activeTab, setActiveTab] = useState<'pending' | 'accepted'>('pending');
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  const acceptedMatches = matches.filter(m => m.status === 'accepted');

  // Set page config
  useEffect(() => {
    setPageConfig({ title: 'Matches', showBack: false, onBack: undefined });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Auto-switch to "Aceptados" tab if there are accepted matches but no pending requests
  useEffect(() => {
    if (!matchesLoading && !requestsLoading && acceptedMatches.length > 0 && pendingRequests.length === 0) {
      setActiveTab('accepted');
    }
  }, [matchesLoading, requestsLoading, acceptedMatches.length, pendingRequests.length]);

  const handleAcceptRequest = async (requestId: string) => {
    setRespondingTo(requestId);
    try {
      const result = await respondToRequest(requestId, 'accepted');
      if (result.matchCreated) {
        toast.success('¡Match aceptado! Ya podés chatear');
        await refetchMatches();
        setActiveTab('accepted');
      } else {
        toast.success('Solicitud aceptada');
      }
    } catch {
      toast.error('Error al aceptar');
    } finally {
      setRespondingTo(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setRespondingTo(requestId);
    try {
      await respondToRequest(requestId, 'rejected');
      toast.success('Solicitud rechazada');
    } catch {
      toast.error('Error al rechazar');
    } finally {
      setRespondingTo(null);
    }
  };

  if (loading || matchesLoading || requestsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const isWorker = userData?.role === 'worker' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'worker');
  const isEmployer = userData?.role === 'employer' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'employer');

  const RequestCard = ({ request }: { request: IContactRequest }) => {
    const isResponding = respondingTo === request.id;
    const fromEmployer = request.fromType === 'employer';

    return (
      <div className="theme-bg-card rounded-2xl border theme-border overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF6A00] to-[#E10600] p-4 text-white">
          <div className="flex items-center">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-2xl mr-3">
              {fromEmployer ? '🏢' : '👤'}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {fromEmployer
                  ? request.employer?.businessName || 'Empresa'
                  : request.worker?.puesto || 'Trabajador'}
              </h3>
              <p className="text-white/80 text-sm">
                Te quiere contactar
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-2">
          {/* Job offer info */}
          {request.jobOffer && (
            <>
              <div className="flex items-center theme-text-secondary text-sm">
                <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">{request.jobOffer.puesto}</span>
                <span className="mx-1">•</span>
                <span>{JOB_CATEGORIES[request.jobOffer.rubro as TRubro]?.label || request.jobOffer.rubro}</span>
              </div>
              {request.jobOffer.salary && (
                <div className="flex items-center theme-text-secondary text-sm">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {request.jobOffer.salary}
                </div>
              )}
              {request.jobOffer.schedule && (
                <div className="flex items-center theme-text-muted text-sm">
                  <span className="mr-2">🕐</span>
                  {request.jobOffer.schedule}
                </div>
              )}
              {request.jobOffer.description && (
                <p className="theme-text-muted text-sm line-clamp-2 mt-1">{request.jobOffer.description}</p>
              )}
            </>
          )}

          {/* Worker info (when employer receives from worker) */}
          {!fromEmployer && request.worker && (
            <>
              {request.worker.zona && (
                <div className="flex items-center theme-text-secondary text-sm">
                  <span className="mr-2">📍</span>
                  {request.worker.zona}
                </div>
              )}
              {request.worker.description && (
                <p className="theme-text-muted text-sm line-clamp-2">{request.worker.description}</p>
              )}
              {request.worker.videoUrl && (
                <Badge variant="secondary" className="bg-[#FF6A00]/20 text-[#FF6A00] border-0">
                  🎥 Tiene video
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex border-t theme-border">
          <button
            onClick={() => handleRejectRequest(request.id)}
            disabled={isResponding}
            className="flex-1 py-4 theme-text-muted font-medium active:opacity-70 transition-colors cursor-pointer disabled:opacity-50"
          >
            ✕ Rechazar
          </button>
          <div className="w-px theme-border bg-current" />
          <button
            onClick={() => handleAcceptRequest(request.id)}
            disabled={isResponding}
            className="flex-1 py-4 text-[#E10600] font-medium active:bg-[#E10600]/10 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isResponding ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#E10600]"></span>
              </span>
            ) : (
              '✓ Aceptar'
            )}
          </button>
        </div>
      </div>
    );
  };

  const MatchCard = ({ match }: { match: IMatch }) => {
    return (
      <div className="theme-bg-card rounded-2xl border theme-border overflow-hidden">
        {/* Header with emoji/avatar */}
        <div className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] p-4 text-white">
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
                {JOB_CATEGORIES[match.rubro as TRubro]?.label || match.rubro}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {isWorker ? (
            <>
              <div className="flex items-center theme-text-secondary text-sm mb-2">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {match.puesto}
              </div>
              {match.jobOffer?.salary && (
                <div className="flex items-center theme-text-secondary text-sm mb-2">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {match.jobOffer.salary}
                </div>
              )}
              {match.jobOffer?.description && (
                <p className="theme-text-muted text-sm line-clamp-2">{match.jobOffer.description}</p>
              )}
            </>
          ) : (
            <>
              {match.worker?.zona && (
                <div className="flex items-center theme-text-secondary text-sm mb-2">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {match.worker.zona}
                </div>
              )}
              {match.worker?.description && (
                <p className="theme-text-muted text-sm line-clamp-2">{match.worker.description}</p>
              )}
              {match.worker?.videoUrl && (
                <Badge variant="secondary" className="mt-2 bg-[#FF6A00]/20 text-[#FF6A00] border-0">
                  🎥 Tiene video
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Chat action */}
        {isEmployer ? (
          <Link href={`/chat/${match.id}`}>
            <div className="border-t theme-border py-4 text-center text-[#FF6A00] font-medium active:bg-[#FF6A00]/10 transition-colors cursor-pointer">
              💬 Iniciar chat
            </div>
          </Link>
        ) : (
          <div className="border-t theme-border p-4">
            <p className="text-center text-xs theme-text-muted mb-2">
              La empresa se va a comunicar con vos por el chat
            </p>
            <Link href="/chats">
              <div className="py-3 text-center text-[#FF6A00] font-medium rounded-xl bg-[#FF6A00]/10 active:bg-[#FF6A00]/20 transition-colors cursor-pointer">
                💬 Ir a mis chats
              </div>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-4">
      {/* Tabs */}
      <div className="flex theme-bg-secondary rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'pending'
              ? 'theme-bg-card theme-text-primary'
              : 'theme-text-muted'
          }`}
        >
          Solicitudes ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('accepted')}
          className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-colors cursor-pointer ${
            activeTab === 'accepted'
              ? 'theme-bg-card theme-text-primary'
              : 'theme-text-muted'
          }`}
        >
          Matches ({acceptedMatches.length})
        </button>
      </div>

      {/* List */}
      {activeTab === 'pending' ? (
        pendingRequests.length === 0 ? (
          <div className="text-center py-12">
            <span className="text-5xl">📭</span>
            <p className="theme-text-secondary mt-4">No tenés solicitudes pendientes</p>
            <p className="theme-text-muted text-sm mt-1">
              {isWorker
                ? 'Cuando un empleador quiera contactarte, va a aparecer acá'
                : 'Cuando un trabajador se interese en tu oferta, va a aparecer acá'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )
      ) : acceptedMatches.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-5xl">🤝</span>
          <p className="theme-text-secondary mt-4">No hay matches todavía</p>
          <p className="theme-text-muted text-sm mt-1">
            Aceptá solicitudes para generar un match y poder chatear
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
  );
}
