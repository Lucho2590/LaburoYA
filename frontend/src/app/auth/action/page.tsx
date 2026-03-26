"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { applyActionCode, checkActionCode, signOut, Auth } from "firebase/auth";
import { auth } from "@/config/firebase";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2, Mail } from "lucide-react";

type ActionMode = "verifyEmail" | "resetPassword" | "recoverEmail";

function AuthActionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error" | "session_mismatch">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const hasRun = useRef(false);

  const mode = searchParams.get("mode") as ActionMode | null;
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasRun.current) return;
    hasRun.current = true;

    const handleAction = async () => {
      if (!mode || !oobCode || !auth) {
        setStatus("error");
        setErrorMessage("Link inválido o expirado");
        return;
      }

      try {
        switch (mode) {
          case "verifyEmail":
            // First, get the email from the action code to verify identity
            const actionCodeInfo = await checkActionCode(auth as Auth, oobCode);
            const emailFromCode = actionCodeInfo.data.email;

            // Apply the verification
            await applyActionCode(auth as Auth, oobCode);

            // Check if there's a session mismatch
            const currentUser = (auth as Auth).currentUser;
            if (currentUser && currentUser.email !== emailFromCode) {
              // Session mismatch! Different user is logged in
              setVerifiedEmail(emailFromCode || null);
              await signOut(auth as Auth);
              setStatus("session_mismatch");
            } else if (!currentUser) {
              // No user logged in, redirect to login with email pre-filled
              setVerifiedEmail(emailFromCode || null);
              setStatus("session_mismatch");
            } else {
              // Same user, all good!
              setStatus("success");
            }
            break;
          case "resetPassword":
            // For password reset, redirect to a password reset form
            router.push(`/reset-password?oobCode=${oobCode}`);
            return;
          default:
            setStatus("error");
            setErrorMessage("Acción no soportada");
        }
      } catch (error: unknown) {
        setStatus("error");
        if (error instanceof Error) {
          if (
            error.message.includes("expired") ||
            error.message.includes("EXPIRED")
          ) {
            setErrorMessage("El link expiró. Solicitá uno nuevo.");
          } else if (
            error.message.includes("invalid") ||
            error.message.includes("INVALID")
          ) {
            setErrorMessage("Link inválido. Puede que ya lo hayas usado.");
          } else {
            setErrorMessage("Ocurrió un error. Intentá de nuevo.");
          }
        } else {
          setErrorMessage("Ocurrió un error. Intentá de nuevo.");
        }
      }
    };

    handleAction();
  }, [mode, oobCode, router]);

  // Auto-redirect after successful verification
  useEffect(() => {
    if (status === "success") {
      // Small delay to show success message
      const timeout = setTimeout(() => {
        router.push("/onboarding");
      }, 1500);
      return () => clearTimeout(timeout);
    }
  }, [status, router]);

  return (
    <div className="w-full max-w-md">
      <div className="theme-bg-card rounded-2xl border theme-border p-8 text-center">
        {status === "loading" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-xl font-bold theme-text-primary mb-2">
              Verificando...
            </h1>
            <p className="theme-text-secondary">
              Espera un momento mientras verificamos tu email.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-xl font-bold theme-text-primary mb-2">
              Email verificado
            </h1>
            <p className="theme-text-secondary mb-6">
              Redirigiendo...
            </p>
          </>
        )}

        {status === "session_mismatch" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-xl font-bold theme-text-primary mb-2">
              Email verificado
            </h1>
            <p className="theme-text-secondary mb-4">
              Tu email fue verificado correctamente.
            </p>
            <p className="theme-text-secondary mb-6 text-sm">
              Iniciá sesión con <span className="font-semibold">{verifiedEmail}</span> para continuar.
            </p>
            <Link
              href={`/login?verified=true${verifiedEmail ? `&email=${encodeURIComponent(verifiedEmail)}` : ""}`}
              className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
            >
              Iniciar sesión
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-xl font-bold theme-text-primary mb-2">
              Error de verificación
            </h1>
            <p className="theme-text-secondary mb-6">{errorMessage}</p>
            <div className="space-y-3">
              <Link
                href="/verify-email"
                className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform"
              >
                <Mail className="w-5 h-5" />
                Solicitar nuevo link
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full border theme-border theme-bg-primary py-4 rounded-xl font-medium theme-text-primary"
              >
                Volver al login
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Branding */}
      <p className="text-center mt-6 text-sm theme-text-muted">
        <span className="font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent">
          LaburoYA
        </span>
      </p>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="w-full max-w-md">
      <div className="theme-bg-card rounded-2xl border theme-border p-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        </div>
        <h1 className="text-xl font-bold theme-text-primary mb-2">
          Cargando...
        </h1>
      </div>
    </div>
  );
}

export default function AuthActionPage() {
  return (
    <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <AuthActionContent />
      </Suspense>
    </div>
  );
}
