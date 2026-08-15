"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useDiscoveryOffers, useDiscoveryWorkers } from "@/hooks/useDiscovery";
import { IRelevantOffer, IRelevantWorker, IWorkerProfile } from "@/types";
import { scoreToStars, STAR_MAX, STAR_FILTERS } from "@/lib/stars";
import { getWorkerProfileCompletion } from "@/lib/workerProfile";
import { JOB_CATEGORIES, TRubro } from "@/config/constants";
import { OfferDetailModal } from "@/components/OfferDetailModal";
import { WorkerProfileModal } from "@/components/WorkerProfileModal";
import { BlockProfileModal } from "@/components/BlockProfileModal";
import { api } from "@/services/api";
import { toast } from "sonner";
import { MapPin, Video, Share2 } from "lucide-react";


function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userData, loading } = useAuth();
  const { setPageConfig } = usePageTitle();
  const [selectedOffer, setSelectedOffer] = useState<IRelevantOffer | null>(
    null,
  );
  const [selectedWorker, setSelectedWorker] = useState<IRelevantWorker | null>(
    null,
  );
  const [isRequesting, setIsRequesting] = useState(false);
  const [minStars, setMinStars] = useState(0);

  const isWorker =
    userData?.role === "worker" ||
    (userData?.role === "superuser" && userData?.secondaryRole === "worker");
  // Empresa y superuser impersonando una empresa usan la vista de empleador.
  const isEmployer =
    userData?.role === "employer" ||
    userData?.role === "company" ||
    (userData?.role === "superuser" &&
      (userData?.secondaryRole === "employer" || !!userData?.impersonating?.companyId));

  const { offers, loading: offersLoading, requestOffer, markNotInterested } = useDiscoveryOffers();

  const {
    workers,
    loading: workersLoading,
    requestWorker,
    removeWorker,
  } = useDiscoveryWorkers();

  // Bloqueo de un candidato (worker) desde el detalle. No vuelve a aparecer.
  const [blockTarget, setBlockTarget] = useState<
    null | { workerUid: string; offerId: string | null; name: string }
  >(null);
  const [blocking, setBlocking] = useState(false);

  const handleBlockWorker = async (reason: string, note: string) => {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await api.blockProfile({
        source: "match",
        workerUid: blockTarget.workerUid,
        offerId: blockTarget.offerId,
        candidateName: blockTarget.name,
        reason,
        note,
      });
      removeWorker(blockTarget.workerUid);
      setBlockTarget(null);
      setSelectedWorker(null);
      toast.success("Perfil bloqueado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo bloquear");
    } finally {
      setBlocking(false);
    }
  };

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

  // Derivados memoizados: evitan el map+filter+sort O(n log n) en cada render.
  // Van al tope del componente (no dentro de los if de rama) por reglas de hooks.
  const allOffers = useMemo(
    () =>
      [
        ...(offers?.fullMatch || []),
        ...(offers?.partialMatch || []),
        ...(offers?.skillsMatch || []),
      ]
        .map((o) => ({
          ...o,
          matchLevel: o.relevance.stars ?? scoreToStars(o.relevance.score),
        }))
        .filter((o) => o.matchLevel >= minStars)
        .sort((a, b) => b.matchLevel - a.matchLevel || b.relevance.score - a.relevance.score),
    [offers, minStars],
  );

  const allWorkers = useMemo(
    () =>
      [
        ...(workers?.fullMatch || []),
        ...(workers?.partialMatch || []),
        ...(workers?.skillsMatch || []),
      ]
        .map((w) => ({
          ...w,
          matchLevel: w.relevance.stars ?? w.bestStars ?? scoreToStars(w.relevance.score),
        }))
        .filter((w) => w.matchLevel >= minStars)
        .sort((a, b) => b.matchLevel - a.matchLevel || b.relevance.score - a.relevance.score),
    [workers, minStars],
  );

  // Handlers estables para que React.memo en las cards sea efectivo.
  const handleSelectOffer = useCallback((o: IRelevantOffer) => setSelectedOffer(o), []);
  const handleSelectWorker = useCallback((w: IRelevantWorker) => setSelectedWorker(w), []);

  const pinnedOffer = offers?.pinned ?? null;

  // Perfil laboral incompleto: sugerimos completarlo (no bloquea postularse).
  const profileCompletion = isWorker
    ? getWorkerProfileCompletion(userData?.profile as IWorkerProfile | undefined)
    : null;
  const shouldSuggestProfile =
    isWorker && (offers?.hasWorkerProfile === false || (profileCompletion ?? 0) < 100);

  // Al venir del link/QR (/home redirige con ?offer=<id>) abrimos el detalle
  // directo, así la persona ve la búsqueda que la trajo sin buscarla. El ref
  // evita que un refetch lo reabra después de que lo cerró.
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    const offerId = searchParams.get("offer");
    if (!offerId || !pinnedOffer || pinnedOffer.id !== offerId) return;
    if (autoOpenedRef.current === offerId) return;
    autoOpenedRef.current = offerId;
    setSelectedOffer(pinnedOffer);
    router.replace("/discover");
  }, [searchParams, pinnedOffer, router]);

  // Empresa con plan vencido: no se muestran candidatos.
  if (isEmployer && userData?.companySubscription?.expired) {
    return (
      <div className="theme-bg-card border theme-border rounded-xl p-8 text-center m-4">
        <p className="theme-text-primary font-medium">Tu plan venció</p>
        <p className="theme-text-muted text-sm mt-1">
          La búsqueda de candidatos está deshabilitada. Contactá al administrador para renovar el plan.
        </p>
      </div>
    );
  }

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
    const totalCount = allOffers.length;

    return (
      <>
        <div className="px-4 py-4">
          {/* Búsqueda compartida por link/QR: va fijada arriba, aunque todavía
              no matchee con el perfil. */}
          {pinnedOffer && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-[#E10600]">
                <Share2 className="h-3.5 w-3.5" />
                Te compartieron esta búsqueda
              </div>
              <div className="rounded-xl ring-2 ring-[#E10600]">
                <OfferCard
                  offer={pinnedOffer}
                  matchLevel={pinnedOffer.relevance.stars ?? scoreToStars(pinnedOffer.relevance.score)}
                  onSelect={handleSelectOffer}
                />
              </div>
              {shouldSuggestProfile && (
                <Link
                  href="/worker/profile"
                  className="mt-2 block rounded-xl theme-bg-secondary px-3 py-2.5 text-xs theme-text-secondary"
                >
                  Antes de postularte, completá tu perfil para que el empleador
                  sepa quién sos.{" "}
                  <span className="text-[#E10600] font-medium">Completar ahora →</span>
                </Link>
              )}
            </div>
          )}

          {/* Filtro + leyenda de estrellas (1 a 5) */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs theme-text-muted">
              <span className="text-yellow-500">★</span> afinidad (1 a 5)
            </span>
            <span className="text-xs theme-text-muted">
              {totalCount} oferta{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto mb-4">
            {STAR_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setMinStars(f.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition active:scale-95 cursor-pointer ${
                  minStars === f.value
                    ? 'bg-[#E10600] text-white'
                    : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Offers List */}
          {allOffers.length === 0 ? (
            // Con una búsqueda compartida arriba no tiene sentido el vacío grande.
            !pinnedOffer && (
              <div className="text-center py-16">
                <span className="text-5xl">💼</span>
                <p className="theme-text-primary font-medium mt-4">
                  No hay ofertas disponibles
                </p>
                <p className="theme-text-muted text-sm mt-1">
                  Completá tu perfil para encontrar oportunidades
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {allOffers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  matchLevel={offer.matchLevel}
                  onSelect={handleSelectOffer}
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
    const totalCount = allWorkers.length;

    return (
      <>
        <div className="px-4 py-4">
          {/* Filtro + leyenda de estrellas (1 a 5) */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs theme-text-muted">
              <span className="text-yellow-500">★</span> afinidad (1 a 5)
            </span>
            <span className="text-xs theme-text-muted">
              {totalCount} candidato{totalCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto mb-4">
            {STAR_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setMinStars(f.value)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition active:scale-95 cursor-pointer ${
                  minStars === f.value
                    ? 'bg-[#E10600] text-white'
                    : 'theme-bg-secondary theme-text-secondary hover:opacity-80'
                }`}
              >
                {f.label}
              </button>
            ))}
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
                  onSelect={handleSelectWorker}
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
          onBlock={(w) => setBlockTarget({
            workerUid: w.uid!,
            offerId: w.bestOffer?.id ?? null,
            name: (w.firstName && w.lastName ? `${w.firstName} ${w.lastName}` : (w.puesto || 'Candidato')),
          })}
          isRequesting={isRequesting}
        />

        <BlockProfileModal
          open={!!blockTarget}
          name={blockTarget?.name}
          submitting={blocking}
          onClose={() => setBlockTarget(null)}
          onConfirm={handleBlockWorker}
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

// useSearchParams (para el ?offer= del link compartido) necesita un límite de
// Suspense; mismo patrón que /register y /evaluar-cv.
export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center theme-bg-primary">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      }
    >
      <DiscoverContent />
    </Suspense>
  );
}

// ============================================
// Offer Card - Para Workers (con estrellas de match)
// ============================================
const OfferCard = memo(function OfferCard({
  offer,
  matchLevel,
  onSelect,
}: {
  offer: IRelevantOffer;
  matchLevel?: number;
  onSelect: (offer: IRelevantOffer) => void;
}) {
  // Renderizar estrellas según nivel de match (1-5)
  const renderStars = (level: number) => {
    const stars = "★".repeat(level);
    const emptyStars = "☆".repeat(Math.max(0, STAR_MAX - level));
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
      onClick={() => onSelect(offer)}
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
            {typeof offer.relevance?.details?.distanceKm === 'number' && (
              <span className="flex items-center gap-0.5 text-[#E10600] font-medium">
                a {offer.relevance.details.approximate ? '~' : ''}{offer.relevance.details.distanceKm} km
              </span>
            )}
            {offer.salary && (
              <span className="text-green-600 font-medium">{offer.salary}</span>
            )}
          </div>

          {/* Por qué hace match (razones) */}
          {(() => {
            const d = offer.relevance?.details;
            if (!d) return null;
            const reasons: string[] = [];
            if (d.puestoMatch) reasons.push('Mismo puesto');
            else if (d.rubroMatch) reasons.push('Mismo rubro');
            if (d.zonaMatch) reasons.push('En tu zona');
            if (d.matchingSkills?.length) reasons.push(`${d.matchingSkills.length} skill${d.matchingSkills.length > 1 ? 's' : ''} en común`);
            if (reasons.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1 mt-2">
                {reasons.map((r) => (
                  <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#E10600]/10 text-[#E10600] font-medium">
                    {r}
                  </span>
                ))}
              </div>
            );
          })()}
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
});

// ============================================
// Worker Card - Para Employers (con estrellas de match)
// ============================================
const WorkerCard = memo(function WorkerCard({
  worker,
  matchLevel,
  onSelect,
}: {
  worker: IRelevantWorker;
  matchLevel?: number;
  onSelect: (worker: IRelevantWorker) => void;
}) {
  const displayName =
    worker.firstName && worker.lastName
      ? `${worker.firstName} ${worker.lastName}`
      : worker.puesto;

  // Renderizar estrellas según nivel de match (1-5)
  const renderStars = (level: number) => {
    const stars = "★".repeat(level);
    const emptyStars = "☆".repeat(Math.max(0, STAR_MAX - level));
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
      onClick={() => onSelect(worker)}
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
            {typeof worker.relevance?.details?.distanceKm === 'number' && (
              <span className="flex items-center gap-0.5 text-[#E10600] font-medium">
                a {worker.relevance.details.approximate ? '~' : ''}{worker.relevance.details.distanceKm} km
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
});
