"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useDiscoveryOffers, useDiscoveryWorkers } from "@/hooks/useDiscovery";
import { IRelevantOffer, IRelevantWorker } from "@/types";
import { JOB_CATEGORIES, TRubro } from "@/config/constants";
import { OfferDetailModal } from "@/components/OfferDetailModal";
import { WorkerProfileModal } from "@/components/WorkerProfileModal";
import { toast } from "sonner";
import { MapPin, Video } from "lucide-react";


export default function DiscoverPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { setPageConfig } = usePageTitle();
  const [selectedOffer, setSelectedOffer] = useState<IRelevantOffer | null>(
    null,
  );
  const [selectedWorker, setSelectedWorker] = useState<IRelevantWorker | null>(
    null,
  );
  const [isRequesting, setIsRequesting] = useState(false);

  const isWorker =
    userData?.role === "worker" ||
    (userData?.role === "superuser" && userData?.secondaryRole === "worker");
  const isEmployer =
    userData?.role === "employer" ||
    (userData?.role === "superuser" && userData?.secondaryRole === "employer");

  const { offers, loading: offersLoading, requestOffer, markNotInterested } = useDiscoveryOffers();

  const {
    workers,
    loading: workersLoading,
    requestWorker,
  } = useDiscoveryWorkers();

  // Set page config based on role
  useEffect(() => {
    const title = isWorker ? "Oportunidades" : "Candidatos disponibles";
    setPageConfig({ title });
  }, [setPageConfig, isWorker]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  const handleContactOffer = async (offer: IRelevantOffer) => {
    try {
      setIsRequesting(true);
      const result = await requestOffer(offer.id);

      if (result.matchCreated) {
        // Worker: ir a matches, el employer iniciará el chat
        toast.success("¡Match! El empleador te va a contactar pronto");
        router.push("/matches");
      } else {
        toast.success("Solicitud enviada");
      }
      setSelectedOffer(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al enviar solicitud",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const handleNotInterested = async (offer: IRelevantOffer) => {
    try {
      await markNotInterested(offer.id);
      toast.success("Oferta descartada");
      setSelectedOffer(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al descartar",
      );
    }
  };

  const handleContactWorker = async (worker: IRelevantWorker) => {
    if (!worker.bestOffer?.id) {
      toast.error("No hay oferta asociada");
      return;
    }

    try {
      setIsRequesting(true);
      console.log("[Discovery] Sending employer request:", {
        workerId: worker.uid,
        offerId: worker.bestOffer.id,
      });
      const result = await requestWorker(worker.uid!, worker.bestOffer.id);
      console.log("[Discovery] Request result:", result);

      if (result.matchCreated && result.match?.id) {
        // Employer: match creado, ir a matches para que pueda iniciar chat cuando quiera
        console.log(
          "[Discovery] Match created, redirecting to matches:",
          result.match.id,
        );
        toast.success("¡Match! Podés iniciar el chat desde Matches");
        router.push("/matches");
      } else if (result.matchCreated) {
        // Match created but no ID (shouldn't happen)
        console.error("[Discovery] Match created but no ID:", result);
        toast.success("¡Match creado! Revisá tus matches");
        router.push("/matches");
      } else {
        toast.success("Solicitud enviada. Te avisaremos cuando responda.");
      }
      setSelectedWorker(null);
    } catch (err) {
      console.error("[Discovery] Error:", err);
      toast.error(
        err instanceof Error ? err.message : "Error al enviar solicitud",
      );
    } finally {
      setIsRequesting(false);
    }
  };

  if (
    loading ||
    (isWorker && offersLoading) ||
    (isEmployer && workersLoading)
  ) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Worker view - show offers (con estrellas como el employer)
  if (isWorker) {
    // Combinar todas las ofertas con su nivel de match
    const allOffers = [
      ...(offers?.fullMatch || []).map((o) => ({
        ...o,
        matchLevel: 3 as const,
      })),
      ...(offers?.partialMatch || []).map((o) => ({
        ...o,
        matchLevel: 2 as const,
      })),
      ...(offers?.skillsMatch || []).map((o) => ({
        ...o,
        matchLevel: 1 as const,
      })),
    ];

    const totalCount = allOffers.length;

    return (
      <>
        <div className="px-4 py-4">
          {/* Header con leyenda de estrellas */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-xs theme-text-muted">
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★★★</span>
                <span>Perfecto</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★★</span>
                <span>Bueno</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                <span>Sugerido</span>
              </span>
            </div>
            <span className="text-xs theme-text-muted">
              {totalCount} ofertas
            </span>
          </div>

          {/* Offers List */}
          {allOffers.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl">💼</span>
              <p className="theme-text-primary font-medium mt-4">
                No hay ofertas disponibles
              </p>
              <p className="theme-text-muted text-sm mt-1">
                Completá tu perfil para encontrar oportunidades
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  matchLevel={offer.matchLevel}
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
          onNotInterested={handleNotInterested}
          isRequesting={isRequesting}
        />
      </>
    );
  }

  // Employer view - show workers (todos en una lista con estrellas)
  if (isEmployer) {
    // Combinar todos los workers con su nivel de match
    const allWorkers = [
      ...(workers?.fullMatch || []).map((w) => ({
        ...w,
        matchLevel: 3 as const,
      })),
      ...(workers?.partialMatch || []).map((w) => ({
        ...w,
        matchLevel: 2 as const,
      })),
      ...(workers?.skillsMatch || []).map((w) => ({
        ...w,
        matchLevel: 1 as const,
      })),
    ];

    const totalCount = allWorkers.length;

    return (
      <>
        <div className="px-4 py-4">
          {/* Header con leyenda de estrellas */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-xs theme-text-muted">
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★★★</span>
                <span>Perfecto</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★★</span>
                <span>Bueno</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-yellow-500">★</span>
                <span>Recomendados</span>
              </span>
            </div>
            <span className="text-xs theme-text-muted">
              {totalCount} candidatos
            </span>
          </div>

          {/* Workers List */}
          {allWorkers.length === 0 ? (
            <div className="text-center py-16">
              <span className="text-5xl">👥</span>
              <p className="theme-text-primary font-medium mt-4">
                No hay candidatos aún
              </p>
              <p className="theme-text-muted text-sm mt-1">
                Publicá ofertas con skills para encontrar candidatos
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allWorkers.map((worker) => (
                <WorkerCard
                  key={`${worker.uid}-${worker.matchLevel}`}
                  worker={worker}
                  matchLevel={worker.matchLevel}
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
      </>
    );
  }

  return (
    <div className="text-center py-12">
      <p className="theme-text-secondary">
        Completá tu perfil para empezar a descubrir
      </p>
    </div>
  );
}

// ============================================
// Offer Card - Para Workers (con estrellas de match)
// ============================================
function OfferCard({
  offer,
  matchLevel,
  onClick,
}: {
  offer: IRelevantOffer;
  matchLevel?: 1 | 2 | 3;
  onClick: () => void;
}) {
  // Renderizar estrellas según nivel de match
  const renderStars = (level: number) => {
    const stars = "★".repeat(level);
    const emptyStars = "☆".repeat(3 - level);
    return (
      <span className="text-sm">
        <span className="text-yellow-500">{stars}</span>
        <span className="text-gray-300">{emptyStars}</span>
      </span>
    );
  };

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
              {offer.puesto}
            </h3>
            {matchLevel && renderStars(matchLevel)}
          </div>
          <p className="theme-text-secondary text-sm truncate">
            {offer.employer?.businessName || "Empresa"}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs theme-text-muted">
            {offer.zona && (
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {offer.zona}
              </span>
            )}
            {offer.salary && (
              <span className="text-green-600 font-medium">{offer.salary}</span>
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
// Worker Card - Para Employers (con estrellas de match)
// ============================================
function WorkerCard({
  worker,
  matchLevel,
  onClick,
}: {
  worker: IRelevantWorker;
  matchLevel?: 1 | 2 | 3;
  onClick: () => void;
}) {
  const displayName =
    worker.firstName && worker.lastName
      ? `${worker.firstName} ${worker.lastName}`
      : worker.puesto;

  // Renderizar estrellas según nivel de match
  const renderStars = (level: number) => {
    const stars = "★".repeat(level);
    const emptyStars = "☆".repeat(3 - level);
    return (
      <span className="text-sm">
        <span className="text-yellow-500">{stars}</span>
        <span className="text-gray-300">{emptyStars}</span>
      </span>
    );
  };

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
            {matchLevel && renderStars(matchLevel)}
            {worker.videoUrl && (
              <Video className="h-4 w-4 text-orange-500 flex-shrink-0" />
            )}
          </div>

          {/* Puesto del worker */}
          <p className="theme-text-secondary text-sm truncate">
            {worker.puesto} •{" "}
            {JOB_CATEGORIES[worker.rubro as TRubro]?.label || worker.rubro}
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
              <span className="truncate">📧 {worker.email}</span>
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
