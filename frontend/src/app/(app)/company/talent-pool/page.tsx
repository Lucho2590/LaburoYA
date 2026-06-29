"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { api } from "@/services/api";
import { ICompanyCandidate, IJobOffer } from "@/types";

function Stars({ value }: { value: number }) {
  const n = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="text-amber-500 text-sm" aria-label={`${n} de 5`}>
      {"★".repeat(n)}
      <span className="theme-text-muted">{"★".repeat(5 - n)}</span>
    </span>
  );
}

function recommendationLabel(rec?: string | null) {
  if (rec === "yes") return { text: "Recomendado", cls: "bg-green-100 text-green-800" };
  if (rec === "maybe") return { text: "A evaluar", cls: "bg-amber-100 text-amber-800" };
  if (rec === "no") return { text: "No encaja", cls: "bg-red-100 text-red-700" };
  return null;
}

export default function CompanyTalentPoolPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const { setPageConfig } = usePageTitle();

  const isCompanyView =
    userData?.role === "company" ||
    (userData?.role === "superuser" && !!userData?.impersonating?.companyId);

  const [candidates, setCandidates] = useState<ICompanyCandidate[]>([]);
  const [offers, setOffers] = useState<IJobOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageConfig({ title: "Talent pool", showBack: false, onBack: undefined });
  }, [setPageConfig]);

  // Guard: solo cuentas empresa (o superuser impersonando una).
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
      return;
    }
    if (!loading && user && userData?.role && !isCompanyView) {
      router.push("/home");
    }
  }, [loading, user, userData, isCompanyView, router]);

  // Carga las ofertas para el selector de re-puntuación.
  useEffect(() => {
    if (!isCompanyView) return;
    (async () => {
      try {
        const data = (await api.getMyJobOffers()) as IJobOffer[];
        setOffers(Array.isArray(data) ? data : []);
      } catch {
        // El selector es opcional; si falla, igual se muestra el pool sin puntuar.
      }
    })();
  }, [isCompanyView]);

  const expired = userData?.companySubscription?.expired === true;
  const sub = userData?.companySubscription;

  const fetchPool = useCallback(async () => {
    if (!isCompanyView || expired) return;
    setFetching(true);
    setError(null);
    try {
      if (selectedOfferId) {
        const data = await api.getCompanyTalentPoolMatch(selectedOfferId);
        setCandidates(data.candidates);
      } else {
        const data = await api.getCompanyTalentPool();
        setCandidates(data.candidates);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el talent pool");
    } finally {
      setFetching(false);
    }
  }, [isCompanyView, selectedOfferId, expired]);

  useEffect(() => {
    fetchPool();
  }, [fetchPool]);

  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedOfferId) || null,
    [offers, selectedOfferId]
  );

  if (loading || (!isCompanyView && !userData?.role)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
      </div>
    );
  }

  if (expired) {
    return (
      <div className="theme-bg-card border theme-border rounded-xl p-8 text-center">
        <p className="theme-text-primary font-medium">Tu plan venció</p>
        <p className="theme-text-muted text-sm mt-1">
          El talent pool no está disponible. Contactá al administrador para renovar el plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <p className="theme-text-secondary text-sm">
          CVs analizados por tu empresa, guardados para reutilizar en nuevas búsquedas.
          Elegí una oferta para ordenar los candidatos por afinidad — sin volver a subir el CV.
        </p>
        {sub && (
          <span className="text-xs theme-text-muted whitespace-nowrap">
            CVs: {sub.cvAnalysesUsed}
            {sub.maxCvAnalyses === -1 ? " / ∞" : ` / ${sub.maxCvAnalyses}`}
          </span>
        )}
      </div>

      {/* Selector de oferta para re-puntuar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <label className="text-sm theme-text-muted">Puntuar contra:</label>
        <select
          value={selectedOfferId}
          onChange={(e) => setSelectedOfferId(e.target.value)}
          className="px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
        >
          <option value="">Todos (sin puntuar)</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.puesto} · {o.rubro}
            </option>
          ))}
        </select>
        {selectedOffer && (
          <span className="text-xs theme-text-muted">
            Ordenados por afinidad con “{selectedOffer.puesto}”
          </span>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
      )}

      {fetching ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="theme-bg-card border theme-border rounded-xl p-8 text-center">
          <p className="theme-text-secondary text-sm">
            Todavía no hay candidatos en tu talent pool.
          </p>
          <p className="theme-text-muted text-xs mt-1">
            Cuando analices un CV en una oferta, se guardará acá automáticamente.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {candidates.map((c) => {
            const cand = c.candidate || {};
            const name =
              [cand.firstName, cand.lastName].filter(Boolean).join(" ") ||
              cand.email ||
              "Candidato sin nombre";
            const score = selectedOfferId
              ? c.relevance?.score ?? 0
              : c.lastAssessment?.score ?? 0;
            const stars = selectedOfferId
              ? c.relevance?.stars ?? 0
              : c.lastAssessment?.stars ?? 0;
            const rec = recommendationLabel(c.lastAssessment?.recommendation);
            return (
              <li
                key={c.id}
                className="theme-bg-card border theme-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium theme-text-primary truncate">{name}</p>
                    {cand.puesto && (
                      <p className="text-sm theme-text-secondary truncate">{cand.puesto}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1 text-xs theme-text-muted">
                      {cand.city && <span>{cand.city}</span>}
                      {cand.email && <span className="truncate">{cand.email}</span>}
                      {cand.phone && <span>{cand.phone}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <Stars value={stars} />
                    <p className="text-xs theme-text-muted mt-0.5">{score} pts</p>
                  </div>
                </div>

                {/* Skills */}
                {Array.isArray(cand.skills) && cand.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {cand.skills.slice(0, 8).map((s, i) => (
                      <span
                        key={`${c.id}-skill-${i}`}
                        className="text-xs px-2 py-0.5 rounded-full theme-bg-secondary theme-text-secondary border theme-border"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: recomendación + reuso */}
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-2">
                    {rec && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rec.cls}`}>
                        {rec.text}
                      </span>
                    )}
                    {selectedOfferId && c.relevance?.matchType && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                        {c.relevance.matchType === "full_match"
                          ? "Match completo"
                          : c.relevance.matchType === "partial_match"
                          ? "Match parcial"
                          : "Skills"}
                      </span>
                    )}
                  </div>
                  {c.sourceOfferIds && c.sourceOfferIds.length > 0 && (
                    <span className="text-xs theme-text-muted">
                      Visto en {c.sourceOfferIds.length}{" "}
                      {c.sourceOfferIds.length === 1 ? "búsqueda" : "búsquedas"}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
