"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/AuthLayout";
import { toast } from "sonner";
import { EUserRole } from "@/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { user, userData, loading, setRole } = useAuth();
  const [selecting, setSelecting] = useState(false);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const [checkingReferral, setCheckingReferral] = useState(true);

  const handleSelectRole = useCallback(async (role: EUserRole) => {
    setSelecting(true);
    try {
      await setRole(role);
      router.push("/onboarding/basic-info");
    } catch (error) {
      toast.error("Error al guardar");
      setSelecting(false);
    }
  }, [setRole, router]);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    // Si tiene rol pero no completó onboarding, ir al form de datos básicos
    if (userData?.role && !userData?.onboardingCompleted) {
      router.push("/onboarding/basic-info");
      return;
    }

    // Si tiene rol y completó onboarding, ir a home
    if (userData?.role && userData?.onboardingCompleted) {
      router.push("/home");
      return;
    }

    // Auto-asignar rol si viene de un QR con rol específico
    if (user && !userData?.role && !autoSelectDone) {
      const referralRole = localStorage.getItem("referralRole");
      if (referralRole === "worker" || referralRole === "employer") {
        setAutoSelectDone(true);
        localStorage.removeItem("referralRole");
        handleSelectRole(referralRole as EUserRole);
        return; // Don't set checkingReferral false, we're redirecting
      }
    }

    // Done checking for referral, can show the page
    setCheckingReferral(false);
  }, [loading, user, userData, router, autoSelectDone, handleSelectRole]);

  if (loading || selecting || checkingReferral) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-16 pb-8 text-center">
          <span className="text-5xl">👋</span>
          <h1 className="text-2xl font-bold theme-text-primary mt-4">
            ¡Bienvenido!
          </h1>
          <p className="theme-text-secondary mt-2">¿Qué estás buscando?</p>
        </div>

        {/* Options */}
        <div className="flex-1 px-6 space-y-4">
          {/* Worker */}
          <button
            onClick={() => handleSelectRole(EUserRole.WORKER)}
            disabled={selecting}
            className="w-full theme-bg-card border-2 theme-border rounded-2xl p-6 text-left active:scale-[0.98] active:border-[#E10600] transition-all disabled:opacity-50"
          >
            <div className="flex items-start">
              <span className="text-4xl mr-4">💼</span>
              <div>
                <h2 className="text-xl font-semibold theme-text-primary">
                  Busco trabajo
                </h2>
                <p className="theme-text-secondary mt-1">
                  Quiero encontrar oportunidades laborales
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs bg-[#E10600]/20 text-[#E10600] px-2 py-1 rounded-full">
                    Creá tu perfil
                  </span>
                  <span className="text-xs bg-[#E10600]/20 text-[#E10600] px-2 py-1 rounded-full">
                    Subí un video
                  </span>
                  <span className="text-xs bg-[#E10600]/20 text-[#E10600] px-2 py-1 rounded-full">
                    Recibí ofertas
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* Employer */}
          <button
            onClick={() => handleSelectRole(EUserRole.EMPLOYER)}
            disabled={selecting}
            className="w-full theme-bg-card border-2 theme-border rounded-2xl p-6 text-left active:scale-[0.98] active:border-[#12B76A] transition-all disabled:opacity-50"
          >
            <div className="flex items-start">
              <span className="text-4xl mr-4">🏢</span>
              <div>
                <h2 className="text-xl font-semibold theme-text-primary">
                  Busco empleados
                </h2>
                <p className="theme-text-secondary mt-1">
                  Quiero encontrar trabajadores para mi negocio
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="text-xs bg-[#12B76A]/20 text-[#12B76A] px-2 py-1 rounded-full">
                    Publicá ofertas
                  </span>
                  <span className="text-xs bg-[#12B76A]/20 text-[#12B76A] px-2 py-1 rounded-full">
                    Mirá videos
                  </span>
                  <span className="text-xs bg-[#12B76A]/20 text-[#12B76A] px-2 py-1 rounded-full">
                    Encontrá candidatos
                  </span>
                </div>
              </div>
            </div>
          </button>

          {/* User email */}
          {user?.email && (
            <p className="text-center text-sm theme-text-muted mt-4">
              Ingresando como{" "}
              <span className="font-medium theme-text-secondary">
                {user.email}
              </span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-8 text-center">
          <p className="text-sm theme-text-muted">Mar del Plata, Argentina</p>
        </div>
      </div>
    </AuthLayout>
  );
}
