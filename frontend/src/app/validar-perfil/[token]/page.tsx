"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";

interface ProspectPreview {
  status: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  puesto: string | null;
  skills: string[];
}

export default function ValidarPerfilPage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { signIn } = useAuth();

  const [prospect, setProspect] = useState<ProspectPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getProspect(token);
      setProspect(data.prospect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Link inválido o vencido");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.claimProspect(token, { password });
      if (res.alreadyHadAccount) {
        // Ya tenía cuenta: que inicie sesión normalmente.
        router.push("/login");
        return;
      }
      // Cuenta recién creada: iniciar sesión y completar el perfil.
      try {
        await signIn(res.email, password);
        router.push("/onboarding/basic-info");
      } catch {
        router.push("/login");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo validar el perfil");
    } finally {
      setSubmitting(false);
    }
  };

  const fullName = prospect
    ? [prospect.firstName, prospect.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="min-h-screen theme-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md theme-bg-card border theme-border rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-[#E10600]">LaburoYA</h1>

        {loading ? (
          <div className="py-10 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
          </div>
        ) : !prospect ? (
          <div className="mt-4">
            <p className="theme-text-primary font-medium">No pudimos abrir este link</p>
            <p className="theme-text-muted text-sm mt-1">{error || "El link es inválido o ya venció."}</p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold theme-text-primary mt-3">
              Validá tu perfil
            </h2>
            <p className="theme-text-secondary text-sm mt-1">
              Una empresa cargó tu CV en LaburoYA. Validá tu perfil para recibir ofertas.
              Lo controlás vos y es gratis.
            </p>

            {/* Datos detectados */}
            <div className="theme-bg-secondary rounded-xl p-3 mt-4 text-sm space-y-1">
              {fullName && (
                <p className="theme-text-primary font-medium">{fullName}</p>
              )}
              {prospect.email && <p className="theme-text-muted">{prospect.email}</p>}
              {prospect.puesto && <p className="theme-text-secondary">{prospect.puesto}</p>}
              {prospect.skills.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {prospect.skills.slice(0, 8).map((s, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full theme-bg-card border theme-border theme-text-secondary">
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Creá tu contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full p-3 rounded-lg border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Repetí la contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full p-3 rounded-lg border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {submitting ? "Validando..." : "Validar mi perfil"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
