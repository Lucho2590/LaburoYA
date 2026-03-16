"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/AuthLayout";
import { toast } from "sonner";
import { Mail, RefreshCw, CheckCircle, ArrowLeft } from "lucide-react";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, resendVerificationEmail, reloadUser, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Redirect if no user or already verified
  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (user.email?.endsWith("@laburoya.com")) {
      router.push("/home");
    } else if (user.emailVerified) {
      router.push("/onboarding");
    }
  }, [user, router]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerificationEmail();
      toast.success("Email de verificación reenviado");
      setCooldown(60); // 60 seconds cooldown
    } catch (error) {
      toast.error("Error al reenviar. Intentá de nuevo en unos minutos.");
    } finally {
      setResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setChecking(true);
    try {
      const isVerified = await reloadUser();
      if (isVerified) {
        toast.success("Email verificado correctamente");
        router.push("/onboarding");
      } else {
        toast.error("Email aún no verificado. Revisá tu bandeja de entrada.");
      }
    } catch (error) {
      toast.error("Error al verificar. Intentá de nuevo.");
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (!user) {
    return null;
  }

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-12 pb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold theme-text-primary">
            Verificá tu email
          </h1>
          <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
            Te enviamos un link de verificación a:
          </p>
          <p className="text-[#E10600] font-medium mt-1">{user.email}</p>
        </div>

        {/* Content */}
        <div className="flex-1 px-6">
          <div className="theme-bg-card rounded-xl border theme-border p-6 mb-6">
            <h3 className="font-medium theme-text-primary mb-3">
              Pasos a seguir:
            </h3>
            <ol className="space-y-3 text-sm theme-text-secondary">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                  1
                </span>
                <span>Revisá tu bandeja de entrada (y spam)</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                  2
                </span>
                <span>Hacé click en el link de verificación</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                  3
                </span>
                <span>Volvé acá y tocá "Ya verifiqué mi email"</span>
              </li>
            </ol>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleCheckVerification}
              disabled={checking}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
            >
              {checking ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {checking ? "Verificando..." : "Ya verifiqué mi email"}
            </button>

            <button
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full flex items-center justify-center gap-2 border theme-border theme-bg-card py-4 rounded-xl font-medium theme-text-primary disabled:opacity-50 active:opacity-80 transition-colors"
            >
              <Mail className="w-5 h-5" />
              {cooldown > 0
                ? `Reenviar en ${cooldown}s`
                : resending
                  ? "Reenviando..."
                  : "Reenviar email"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-8">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-3 theme-text-muted hover:theme-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Usar otro email</span>
          </button>
        </div>
      </div>
    </AuthLayout>
  );
}
