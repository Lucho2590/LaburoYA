"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/AuthLayout";
import { toast } from "sonner";
import { Mail, ArrowLeft, Send } from "lucide-react";
import { api } from "@/services/api";

export default function ForgotPasswordPage() {
  const { sendPasswordResetEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verificar primero si el email existe
      await api.checkEmailExists(email);

      // Si existe, enviar el email de reset
      await sendPasswordResetEmail(email);
      setSent(true);
      toast.success("Email enviado correctamente");
    } catch (error: unknown) {
      const apiError = error as { message?: string };
      if (apiError.message?.includes("No existe una cuenta")) {
        toast.error("No existe una cuenta con ese email");
      } else {
        const firebaseError = error as { code?: string };
        if (firebaseError.code === "auth/invalid-email") {
          toast.error("Email inválido");
        } else {
          toast.error("Error al enviar el email. Intentá de nuevo.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="min-h-screen md:min-h-0 flex flex-col">
          {/* Header */}
          <div className="px-4 pt-12 pb-8 text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center">
              <Send className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold theme-text-primary">
              Revisá tu email
            </h1>
            <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
              Te enviamos un link para restablecer tu contraseña a:
            </p>
            <p className="text-[#E10600] font-medium mt-1">{email}</p>
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
                  <span>Hacé click en el link de restablecimiento</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#E10600] text-white flex items-center justify-center text-xs font-medium flex-shrink-0">
                    3
                  </span>
                  <span>Ingresá tu nueva contraseña</span>
                </li>
              </ol>
            </div>

            <button
              onClick={() => setSent(false)}
              className="w-full flex items-center justify-center gap-2 border theme-border theme-bg-card py-4 rounded-xl font-medium theme-text-primary active:opacity-80 transition-colors"
            >
              <Mail className="w-5 h-5" />
              Usar otro email
            </button>
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

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-4 pt-12 pb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-full flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold theme-text-primary">
            Restablecer contraseña
          </h1>
          <p className="theme-text-secondary mt-2 max-w-sm mx-auto">
            Ingresá tu email y te enviaremos un link para crear una nueva
            contraseña
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-4 rounded-xl border theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none text-base"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform text-base"
            >
              {loading ? "Enviando..." : "Enviar link"}
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
