"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches } from "@/hooks/useMatches";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useDiscoveryOffers } from "@/hooks/useDiscovery";
import { useReceivedContactRequests } from "@/hooks/useContactRequests";
import { Badge } from "@/components/ui/badge";
import { IWorkerProfile } from "@/types";
import { api } from "@/services/api";
import { Users, UserCheck, Clock, Eye, Briefcase, MessageCircle } from "lucide-react";

interface EmployerDashboard {
  summary: {
    totalOffers: number;
    activeOffers: number;
    totalInterested: number;
    interestedNotContacted: number;
    totalCandidates: number;
    totalMatches: number;
  };
  offers: {
    id: string;
    rubro: string;
    puesto: string;
    active: boolean;
    isExpired: boolean;
    expiresAt?: string;
    stats: {
      interested: number;
      interestedNotContacted: number;
      candidates: number;
      matches: number;
    };
  }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, userData, loading, signOut, getEffectiveAppRole } = useAuth();
  const { matches, loading: matchesLoading } = useMatches();
  const { setPageConfig } = usePageTitle();
  const { offers, loading: offersLoading } = useDiscoveryOffers();
  const { requests: receivedRequests, loading: requestsLoading } = useReceivedContactRequests();

  const effectiveRole = getEffectiveAppRole();
  const isSuperuser = userData?.role === "superuser";
  const isEmployer = effectiveRole === "employer";

  // Employer dashboard state
  const [employerDashboard, setEmployerDashboard] = useState<EmployerDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  const fetchEmployerDashboard = useCallback(async () => {
    if (!isEmployer) return;
    setDashboardLoading(true);
    try {
      const data = await api.getEmployerDashboard();
      setEmployerDashboard(data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
    } finally {
      setDashboardLoading(false);
    }
  }, [isEmployer]);

  useEffect(() => {
    if (isEmployer && user && !loading) {
      fetchEmployerDashboard();
    }
  }, [isEmployer, user, loading, fetchEmployerDashboard]);

  // Set page config
  useEffect(() => {
    setPageConfig({ title: "" });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
    if (!loading && user && !userData?.role) {
      router.push("/onboarding");
    }
    // Si tiene rol pero no completó onboarding, ir al form de datos básicos
    if (!loading && user && userData?.role && !userData?.onboardingCompleted) {
      router.push("/onboarding/basic-info");
    }
    // Superuser without secondaryRole should go to admin panel to set it
    if (!loading && user && isSuperuser && !userData?.secondaryRole) {
      router.push("/sudo");
    }
  }, [loading, user, userData, router, isSuperuser]);

  // Calculate worker profile completion (must be before early returns)
  const workerProfileCompletion = useMemo(() => {
    const isWorkerRole = effectiveRole === "worker";
    if (!isWorkerRole || !userData?.profile) return null;

    const profile = userData.profile as IWorkerProfile;
    const fields = [
      { filled: !!profile.rubro },
      { filled: !!profile.puesto },
      { filled: !!profile.zona },
      { filled: !!profile.localidad },
      { filled: !!profile.experience },
      { filled: !!profile.description },
      { filled: profile.skills && profile.skills.length > 0 },
      { filled: !!profile.videoUrl },
    ];

    const filledCount = fields.filter((f) => f.filled).length;
    const percentage = Math.round((filledCount / fields.length) * 100);

    return percentage;
  }, [effectiveRole, userData?.profile]);

  if (loading || !userData?.role) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // Superuser without secondaryRole - show loading while redirecting
  if (isSuperuser && !effectiveRole) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const isWorker = effectiveRole === "worker";
  const pendingMatches = matches.filter((m) => m.status === "pending").length;
  const acceptedMatches = matches.filter((m) => m.status === "accepted").length;

  // Helper for time remaining
  const getTimeRemaining = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    if (diffMs <= 0) return "Expirada";
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays > 0) return `${diffDays}d`;
    return `${diffHours}h`;
  };

  // Worker specific: count offers and pending requests
  const totalOffers = offers?.total || 0;
  const pendingReceivedRequests = receivedRequests.filter(
    (r) => r.status === "pending",
  ).length;

  return (
    <div className="px-4 py-6">
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold theme-text-primary">
          ¡Hola {userData?.firstName}! 👋
        </h1>
        <p className="theme-text-secondary text-sm mt-1">
          {isWorker
            ? "Encontrá tu próximo trabajo"
            : "Encontrá al empleado ideal"}
        </p>
      </div>

      {/* Profile Alert - No profile */}
      {!userData.profile && (
        <Link href={isWorker ? "/worker/profile" : "/employer/profile"}>
          <div className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-2xl p-4 mb-6 text-white active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Completá tu perfil</p>
                <p className="text-white/80 text-sm">Para recibir matches</p>
              </div>
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Link>
      )}

      {/* Profile Completion Alert - Worker with incomplete profile */}
      {isWorker &&
        workerProfileCompletion !== null &&
        workerProfileCompletion < 100 && (
          <Link href="/worker/profile">
            <div className="theme-bg-card border theme-border rounded-2xl p-4 mb-6 active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold theme-text-primary text-sm">
                      Perfil {workerProfileCompletion}% completo
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        workerProfileCompletion >= 75
                          ? "text-[#F79009]"
                          : "text-[#F04438]"
                      }`}
                    >
                      {workerProfileCompletion >= 75
                        ? "¡Casi listo!"
                        : "Completar"}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        workerProfileCompletion >= 75
                          ? "bg-[#F79009]"
                          : "bg-[#F04438]"
                      }`}
                      style={{ width: `${workerProfileCompletion}%` }}
                    />
                  </div>
                  <p className="theme-text-muted text-xs mt-2">
                    Un perfil completo tiene más visibilidad
                  </p>
                </div>
                <svg
                  className="w-5 h-5 theme-text-muted flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </Link>
        )}

      {/* Stats Cards - Different for Worker vs Employer */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {isWorker ? (
          <>
            {/* Worker: Oportunidades */}
            <Link href="/discover">
              <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">💼</span>
                  {!offersLoading && totalOffers > 0 && (
                    <Badge className="text-xs bg-[#12B76A]">
                      {totalOffers}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold theme-text-primary">
                  {offersLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-[#E10600]/30 border-t-[#E10600] rounded-full animate-spin" />
                  ) : (
                    totalOffers
                  )}
                </p>
                <p className="theme-text-secondary text-sm">Oportunidades</p>
              </div>
            </Link>

            {/* Worker: Solicitudes recibidas */}
            <Link href="/matches">
              <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">📩</span>
                  {!requestsLoading && pendingReceivedRequests > 0 && (
                    <Badge
                      variant="destructive"
                      className="text-xs bg-[#E10600]"
                    >
                      {pendingReceivedRequests}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold theme-text-primary">
                  {requestsLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-[#E10600]/30 border-t-[#E10600] rounded-full animate-spin" />
                  ) : (
                    pendingReceivedRequests
                  )}
                </p>
                <p className="theme-text-secondary text-sm">Solicitudes</p>
              </div>
            </Link>
          </>
        ) : (
          <>
            {/* Employer Dashboard Stats */}
            {dashboardLoading ? (
              <>
                <div className="theme-bg-card rounded-2xl p-4 border theme-border animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="theme-bg-card rounded-2xl p-4 border theme-border animate-pulse">
                  <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </>
            ) : (
              <>
                {/* Interesados sin contactar */}
                <Link href="/employer/jobs">
                  <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[#E10600]/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-[#E10600]" />
                      </div>
                      {(employerDashboard?.summary.interestedNotContacted ?? 0) > 0 && (
                        <Badge variant="destructive" className="text-xs bg-[#E10600]">
                          Nuevo
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold theme-text-primary">
                      {employerDashboard?.summary.interestedNotContacted ?? 0}
                    </p>
                    <p className="theme-text-secondary text-sm">Interesados</p>
                  </div>
                </Link>

                {/* Candidatos potenciales */}
                <Link href="/discover">
                  <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-10 h-10 rounded-xl bg-[#12B76A]/10 flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-[#12B76A]" />
                      </div>
                    </div>
                    <p className="text-2xl font-bold theme-text-primary">
                      {employerDashboard?.summary.totalCandidates ?? 0}
                    </p>
                    <p className="theme-text-secondary text-sm">Candidatos</p>
                  </div>
                </Link>
              </>
            )}
          </>
        )}
      </div>

      {/* Employer: Summary row */}
      {isEmployer && !dashboardLoading && employerDashboard && (
        <div className="flex items-center justify-around mb-6 theme-bg-card rounded-2xl p-3 border theme-border">
          <Link href="/employer/jobs" className="text-center px-4">
            <p className="text-lg font-bold theme-text-primary">{employerDashboard.summary.activeOffers}</p>
            <p className="theme-text-muted text-xs">Ofertas activas</p>
          </Link>
          <div className="w-px h-8 theme-bg-secondary"></div>
          <Link href="/matches" className="text-center px-4">
            <p className="text-lg font-bold theme-text-primary">{employerDashboard.summary.totalMatches}</p>
            <p className="theme-text-muted text-xs">Matches</p>
          </Link>
          <div className="w-px h-8 theme-bg-secondary"></div>
          <Link href="/chats" className="text-center px-4">
            <p className="text-lg font-bold theme-text-primary">{acceptedMatches}</p>
            <p className="theme-text-muted text-xs">Chats</p>
          </Link>
        </div>
      )}

      {/* Employer: Offers with stats */}
      {isEmployer && !dashboardLoading && employerDashboard && employerDashboard.offers.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold theme-text-primary">Tus ofertas</h2>
            <Link href="/employer/jobs" className="text-sm text-[#E10600]">
              Ver todas
            </Link>
          </div>
          <div className="space-y-3">
            {employerDashboard.offers.slice(0, 3).map((offer) => (
              <Link key={offer.id} href="/employer/jobs">
                <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold theme-text-primary">{offer.puesto}</h3>
                        {offer.isExpired ? (
                          <Badge className="text-xs bg-gray-500">Expirada</Badge>
                        ) : !offer.active ? (
                          <Badge variant="secondary" className="text-xs">Pausada</Badge>
                        ) : (
                          <Badge className="text-xs bg-[#12B76A]">Activa</Badge>
                        )}
                      </div>
                      <p className="theme-text-muted text-sm">{offer.rubro}</p>
                    </div>
                    {offer.expiresAt && !offer.isExpired && offer.active && (
                      <div className="flex items-center gap-1 text-xs theme-text-muted">
                        <Clock className="w-3 h-3" />
                        {getTimeRemaining(offer.expiresAt)}
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Users className={`w-4 h-4 ${offer.stats.interestedNotContacted > 0 ? 'text-[#E10600]' : 'theme-text-muted'}`} />
                      <span className={offer.stats.interestedNotContacted > 0 ? 'text-[#E10600] font-medium' : 'theme-text-muted'}>
                        {offer.stats.interested} interesado{offer.stats.interested !== 1 ? 's' : ''}
                      </span>
                      {offer.stats.interestedNotContacted > 0 && (
                        <Badge variant="destructive" className="text-xs bg-[#E10600] ml-1">
                          {offer.stats.interestedNotContacted} nuevo{offer.stats.interestedNotContacted !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 theme-text-muted">
                      <Eye className="w-4 h-4" />
                      <span>{offer.stats.candidates} candidatos</span>
                    </div>
                    {offer.stats.matches > 0 && (
                      <div className="flex items-center gap-1.5 text-[#12B76A]">
                        <MessageCircle className="w-4 h-4" />
                        <span>{offer.stats.matches}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Employer: No offers yet */}
      {isEmployer && !dashboardLoading && employerDashboard && employerDashboard.offers.length === 0 && (
        <Link href="/employer/jobs">
          <div className="mb-6 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-2xl p-4 text-white active:scale-[0.98] transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Publicá tu primera oferta</p>
                <p className="text-white/80 text-sm">Encontrá candidatos ideales</p>
              </div>
              <Briefcase className="w-8 h-8 text-white/80" />
            </div>
          </div>
        </Link>
      )}

      {/* Quick Actions */}
      <h2 className="text-lg font-semibold theme-text-primary mb-3">
        Acciones rápidas
      </h2>

      <div className="space-y-3">
        <Link href={isWorker ? "/worker/profile" : "/employer/profile"}>
          <div className="m-2 theme-bg-card rounded-2xl p-4 border theme-border flex items-center active:scale-[0.98] transition-transform">
            <div className="w-12 h-12 bg-[#E10600]/20 rounded-xl flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-[#E10600]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium theme-text-primary">Mi Perfil</p>
              <p className="theme-text-secondary text-sm">
                {userData.profile ? "Ver y editar" : "Completar perfil"}
              </p>
            </div>
            <svg
              className="w-5 h-5 theme-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        {!isWorker && (
          <Link href="/employer/jobs">
            <div className="m-2 theme-bg-card rounded-2xl p-4 border theme-border flex items-center active:scale-[0.98] transition-transform">
              <div className="w-12 h-12 bg-[#12B76A]/20 rounded-xl flex items-center justify-center mr-4">
                <svg
                  className="w-6 h-6 text-[#12B76A]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium theme-text-primary">Nueva Oferta</p>
                <p className="theme-text-secondary text-sm">
                  Publicar búsqueda
                </p>
              </div>
              <svg
                className="w-5 h-5 theme-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </Link>
        )}

        <Link href="/matches">
          <div className="m-2 theme-bg-card rounded-2xl p-4 border theme-border flex items-center active:scale-[0.98] transition-transform">
            <div className="w-12 h-12 bg-[#FF6A00]/20 rounded-xl flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-[#FF6A00]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium theme-text-primary">Ver Matches</p>
              <p className="theme-text-secondary text-sm">
                {pendingMatches > 0
                  ? `${pendingMatches} pendientes`
                  : "Sin pendientes"}
              </p>
            </div>
            <svg
              className="w-5 h-5 theme-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>

        <Link href="/settings">
          <div className="theme-bg-card rounded-2xl p-4 border theme-border flex items-center active:scale-[0.98] transition-transform m-2">
            <div className="w-12 h-12 bg-[#667085]/20 rounded-xl flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-[#667085]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium theme-text-primary">Mis datos</p>
              <p className="theme-text-secondary text-sm">
                {userData?.firstName} {userData?.lastName}
              </p>
            </div>
            <svg
              className="w-5 h-5 theme-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>
      </div>

      {/* Sign Out */}
      <button
        onClick={() => signOut().then(() => router.push("/"))}
        className="w-full mt-8 py-3 text-[#667085] text-sm hover:text-[#98A2B3] transition-colors"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
