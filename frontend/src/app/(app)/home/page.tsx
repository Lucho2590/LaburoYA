"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useMatches } from "@/hooks/useMatches";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useDiscoveryOffers } from "@/hooks/useDiscovery";
import { useReceivedContactRequests } from "@/hooks/useContactRequests";
import { Badge } from "@/components/ui/badge";
import { IWorkerProfile } from "@/types";

export default function DashboardPage() {
  const router = useRouter();
  const { user, userData, loading, signOut, getEffectiveAppRole } = useAuth();
  const { matches, loading: matchesLoading } = useMatches();
  const { setPageConfig } = usePageTitle();
  const { offers, loading: offersLoading } = useDiscoveryOffers();
  const { requests: receivedRequests, loading: requestsLoading } = useReceivedContactRequests();

  const effectiveRole = getEffectiveAppRole();
  const isSuperuser = userData?.role === "superuser";

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
            {/* Employer: Matches */}
            <Link href="/matches">
              <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-3xl">🤝</span>
                  {!matchesLoading && pendingMatches > 0 && (
                    <Badge
                      variant="destructive"
                      className="text-xs bg-[#E10600]"
                    >
                      {pendingMatches}
                    </Badge>
                  )}
                </div>
                <p className="text-2xl font-bold theme-text-primary">
                  {matchesLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-[#E10600]/30 border-t-[#E10600] rounded-full animate-spin" />
                  ) : (
                    pendingMatches
                  )}
                </p>
                <p className="theme-text-secondary text-sm">Nuevos matches</p>
              </div>
            </Link>

            {/* Employer: Conversaciones */}
            <Link href="/chats">
              <div className="theme-bg-card rounded-2xl p-4 border theme-border active:scale-[0.98] transition-transform">
                <span className="text-3xl">💬</span>
                <p className="text-2xl font-bold theme-text-primary mt-2">
                  {matchesLoading ? (
                    <span className="inline-block w-5 h-5 border-2 border-[#E10600]/30 border-t-[#E10600] rounded-full animate-spin" />
                  ) : (
                    acceptedMatches
                  )}
                </p>
                <p className="theme-text-secondary text-sm">Conversaciones</p>
              </div>
            </Link>
          </>
        )}
      </div>

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
