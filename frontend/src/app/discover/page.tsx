'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscoveryOffers, useDiscoveryWorkers } from '@/hooks/useDiscovery';
import { IRelevantOffer, IRelevantWorker } from '@/types';
import { JOB_CATEGORIES, TRubro } from '@/config/constants';
import { AppLayout } from '@/components/AppLayout';
import { OfferDetailModal } from '@/components/OfferDetailModal';
import { WorkerProfileModal } from '@/components/WorkerProfileModal';
import { toast } from 'sonner';
import { MapPin, Video } from 'lucide-react';

type MatchSection = 'full' | 'partial' | 'skills';

// Configuración de secciones - nombres cortos para mobile
const SECTION_CONFIG = {
  full: {
    label: 'Perfectas',
    emoji: '🎯',
    color: 'bg-green-500',
    emptyTitle: 'No hay ofertas perfectas aún',
    emptySubtitle: 'Completá tu perfil para mejorar tus coincidencias'
  },
  partial: {
    label: 'Buenas',
    emoji: '👍',
    color: 'bg-yellow-500',
    emptyTitle: 'No hay buenas opciones aún',
    emptySubtitle: 'Agregá más skills a tu perfil'
  },
  skills: {
    label: 'Otras',
    emoji: '💡',
    color: 'bg-blue-500',
    emptyTitle: 'No hay sugerencias',
    emptySubtitle: 'Explorá otros rubros o puestos'
  }
};

export default function DiscoverPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<MatchSection>('full');
  const [selectedOffer, setSelectedOffer] = useState<IRelevantOffer | null>(null);
  const [selectedWorker, setSelectedWorker] = useState<IRelevantWorker | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  const isWorker = userData?.role === 'worker' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'worker');
  const isEmployer = userData?.role === 'employer' ||
    (userData?.role === 'superuser' && userData?.secondaryRole === 'employer');

  const {
    offers,
    loading: offersLoading,
    requestOffer
  } = useDiscoveryOffers();

  const {
    workers,
    loading: workersLoading,
    requestWorker
  } = useDiscoveryWorkers();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  const handleContactOffer = async (offer: IRelevantOffer) => {
    try {
      setIsRequesting(true);
      const result = await requestOffer(offer.id);

      if (result.matchCreated) {
        // Worker: ir a matches, el employer iniciará el chat
        toast.success('¡Match! El empleador te va a contactar pronto');
        router.push('/matches');
      } else {
        toast.success('Solicitud enviada');
      }
      setSelectedOffer(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar solicitud');
    } finally {
      setIsRequesting(false);
    }
  };

  const handleContactWorker = async (worker: IRelevantWorker) => {
    if (!worker.bestOffer?.id) {
      toast.error('No hay oferta asociada');
      return;
    }

    try {
      setIsRequesting(true);
      console.log('[Discovery] Sending employer request:', { workerId: worker.uid, offerId: worker.bestOffer.id });
      const result = await requestWorker(worker.uid!, worker.bestOffer.id);
      console.log('[Discovery] Request result:', result);

      if (result.matchCreated && result.match?.id) {
        // Employer: match creado, ir a matches para que pueda iniciar chat cuando quiera
        console.log('[Discovery] Match created, redirecting to matches:', result.match.id);
        toast.success('¡Match! Podés iniciar el chat desde Matches');
        router.push('/matches');
      } else if (result.matchCreated) {
        // Match created but no ID (shouldn't happen)
        console.error('[Discovery] Match created but no ID:', result);
        toast.success('¡Match creado! Revisá tus matches');
        router.push('/matches');
      } else {
        toast.success('Solicitud enviada. Te avisaremos cuando responda.');
      }
      setSelectedWorker(null);
    } catch (err) {
      console.error('[Discovery] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Error al enviar solicitud');
    } finally {
      setIsRequesting(false);
    }
  };

  if (loading || (isWorker && offersLoading) || (isEmployer && workersLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Worker view - show offers
  if (isWorker) {
    const sections = {
      full: offers?.fullMatch || [],
      partial: offers?.partialMatch || [],
      skills: offers?.skillsMatch || []
    };

    const currentOffers = sections[activeSection];
    const config = SECTION_CONFIG[activeSection];

    return (
      <AppLayout title="Oportunidades">
        <div className="px-4 py-4">
          {/* Section Tabs - Compactos para mobile */}
          <div className="flex gap-2 mb-4">
            {(Object.keys(SECTION_CONFIG) as MatchSection[]).map((key) => {
              const cfg = SECTION_CONFIG[key];
              const count = sections[key].length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeSection === key
                      ? `${cfg.color} text-white`
                      : 'theme-bg-card theme-text-secondary border theme-border'
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Offers List */}
          {currentOffers.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl">{config.emoji}</span>
              <p className="theme-text-primary font-medium mt-4">
                {config.emptyTitle}
              </p>
              <p className="theme-text-muted text-sm mt-1">
                {config.emptySubtitle}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  onClick={() => setSelectedOffer(offer)}
                />
              ))}
            </div>
          )}
        </div>

        <OfferDetailModal
          offer={selectedOffer}
          open={!!selectedOffer}
          onClose={() => setSelectedOffer(null)}
          onContact={handleContactOffer}
          isRequesting={isRequesting}
        />
      </AppLayout>
    );
  }

  // Employer view - show workers
  if (isEmployer) {
    const sections = {
      full: workers?.fullMatch || [],
      partial: workers?.partialMatch || [],
      skills: workers?.skillsMatch || []
    };

    const currentWorkers = sections[activeSection];
    const config = SECTION_CONFIG[activeSection];

    return (
      <AppLayout title="Candidatos disponibles">
        <div className="px-4 py-4">
          {/* Section Tabs - Compactos para mobile */}
          <div className="flex gap-2 mb-4">
            {(Object.keys(SECTION_CONFIG) as MatchSection[]).map((key) => {
              const cfg = SECTION_CONFIG[key];
              const count = sections[key].length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeSection === key
                      ? `${cfg.color} text-white`
                      : 'theme-bg-card theme-text-secondary border theme-border'
                  }`}
                >
                  <span>{cfg.emoji}</span>
                  <span>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Workers List */}
          {currentWorkers.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl">{config.emoji}</span>
              <p className="theme-text-primary font-medium mt-4">
                {config.emptyTitle.replace('ofertas', 'candidatos')}
              </p>
              <p className="theme-text-muted text-sm mt-1">
                Publicá ofertas con skills para encontrar candidatos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {currentWorkers.map((worker) => (
                <WorkerCard
                  key={worker.uid}
                  worker={worker}
                  onClick={() => setSelectedWorker(worker)}
                />
              ))}
            </div>
          )}
        </div>

        <WorkerProfileModal
          worker={selectedWorker}
          open={!!selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onContact={handleContactWorker}
          isRequesting={isRequesting}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Descubrir">
      <div className="text-center py-12">
        <p className="theme-text-secondary">
          Completá tu perfil para empezar a descubrir
        </p>
      </div>
    </AppLayout>
  );
}

// ============================================
// Offer Card - Minimalista para Workers
// ============================================
function OfferCard({
  offer,
  onClick,
}: {
  offer: IRelevantOffer;
  onClick: () => void;
}) {
  return (
    <div
      className="theme-bg-card rounded-xl border theme-border p-4 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold theme-text-primary truncate">
            {offer.puesto}
          </h3>
          <p className="theme-text-secondary text-sm truncate">
            {offer.employer?.businessName || 'Empresa'}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs theme-text-muted">
            {offer.zona && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {offer.zona}
              </span>
            )}
            {offer.salary && (
              <span className="text-green-600 font-medium">
                {offer.salary}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {offer.hasRequested ? (
          <span className="text-xs theme-text-muted px-2 py-1 theme-bg-secondary rounded-lg">
            Enviada
          </span>
        ) : (
          <span className="text-xs text-[#E10600]">Ver más →</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// Worker Card - Para Employers
// ============================================
function WorkerCard({
  worker,
  onClick,
}: {
  worker: IRelevantWorker;
  onClick: () => void;
}) {
  const displayName = worker.firstName && worker.lastName
    ? `${worker.firstName} ${worker.lastName}`
    : worker.puesto;

  return (
    <div
      className="theme-bg-card rounded-xl border theme-border p-4 active:scale-[0.98] transition-transform cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold theme-text-primary truncate">
              {displayName}
            </h3>
            {worker.videoUrl && (
              <Video className="h-4 w-4 text-orange-500 flex-shrink-0" />
            )}
          </div>

          {/* Puesto del worker */}
          <p className="theme-text-secondary text-sm truncate">
            {worker.puesto} • {JOB_CATEGORIES[worker.rubro as TRubro]?.label || worker.rubro}
          </p>

          {/* Para qué oferta matchea */}
          {worker.bestOffer && (
            <p className="text-xs text-[#12B76A] mt-1 truncate">
              → Para tu búsqueda: {worker.bestOffer.puesto}
            </p>
          )}

          <div className="flex items-center gap-2 mt-1 text-xs theme-text-muted">
            {worker.zona && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {worker.zona}
              </span>
            )}
            {/* TODO: Temporal - mostrar email para testing */}
            {worker.email && (
              <span className="truncate">
                📧 {worker.email}
              </span>
            )}
          </div>
        </div>

        {/* Status indicator */}
        {worker.hasRequested ? (
          <span className="text-xs theme-text-muted px-2 py-1 theme-bg-secondary rounded-lg">
            Enviada
          </span>
        ) : (
          <span className="text-xs text-[#E10600]">Ver más →</span>
        )}
      </div>
    </div>
  );
}
