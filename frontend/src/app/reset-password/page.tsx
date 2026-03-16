"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthLayout } from "@/components/AuthLayout";
import { toast } from "sonner";
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from "lucide-react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/config/firebase";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const verifyCode = async () => {
      if (!oobCode) {
        setError("Link inválido o expirado");
        setVerifying(false);
        return;
      }

      if (!auth) {
        setError("Error de configuración");
        setVerifying(false);
        return;
      }

      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        setEmail(userEmail);
      } catch {
        setError("El link ha expirado o ya fue utilizado");
      } finally {
        setVerifying(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    if (!oobCode || !auth) {
      toast.error("Link inválido");
      return;
    }

    setLoading(true);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      toast.success("Contraseña actualizada correctamente");
    } catch {
      toast.error("Error al actualizar la contraseña. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <AuthLayout>
        <div className="min-h-screen md:min-h-0 flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
          <p className="theme-text-secondary mt-4">Verificando link...</p>
        </div>
      </AuthLayout>
    );
  }

  if (error) {
    return (
      <AuthLayout>
        <div className="min-h-screen md:min-h-0 flex flex-col">
          {/* Header */}
          <div className="px-4 pt-12 pb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <Lock className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold theme-text-primary">
              Link inválido
            </h1>
            <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
              {error}
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 px-6">
            <Link
              href="/forgot-password"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              Solicitar nuevo link
            </Link>
          </div>

          {/* Footer */}
          <div className="px-6 py-8">
            <Link
              href="/login"
              className="w-full flex items-center justify-center gap-2 py-3 theme-text-muted hover:theme-text-secondary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Volver al inicio de sesión</span>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="min-h-screen md:min-h-0 flex flex-col">
          {/* Header */}
          <div className="px-4 pt-12 pb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h1 className="text-2xl font-bold theme-text-primary">
              Contraseña actualizada
            </h1>
            <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
              Tu contraseña fue restablecida correctamente. Ya podés iniciar
              sesión con tu nueva contraseña.
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 px-6">
            <button
              onClick={() => router.push("/login")}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-12 pb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold theme-text-primary">
            Nueva contraseña
          </h1>
          <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
            Ingresá tu nueva contraseña para:
          </p>
          <p className="text-[#E10600] font-medium mt-1">{email}</p>
        </div>

        {/* Form */}
        <div className="flex-1 px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Nueva contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-4 pr-12 rounded-xl border theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted hover:theme-text-primary transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="w-full p-4 pr-12 rounded-xl border theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-base"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 theme-text-muted hover:theme-text-primary transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            <p className="text-xs theme-text-muted">
              La contraseña debe tener al menos 6 caracteres
            </p>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform text-base"
            >
              {loading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-8">
          <Link
            href="/login"
            className="w-full flex items-center justify-center gap-2 py-3 theme-text-muted hover:theme-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver al inicio de sesión</span>
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthLayout>
          <div className="min-h-screen md:min-h-0 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#E10600] border-t-transparent rounded-full animate-spin" />
            <p className="theme-text-secondary mt-4">Cargando...</p>
          </div>
        </AuthLayout>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
