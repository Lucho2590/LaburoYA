"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { api } from "@/services/api";
import { JOB_CATEGORIES } from "@/config/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { scoreToStars, STAR_MAX } from "@/lib/stars";
import { ICvCheckAssessment } from "@/types";
import { toast } from "sonner";
import { Upload, Loader2, Sparkles, Check, X } from "lucide-react";

const RUBROS = Object.entries(JOB_CATEGORIES).map(([key, v]) => ({ key, label: v.label }));

function Stars({ score }: { score: number }) {
  const n = scoreToStars(score);
  return (
    <span className="text-amber-500 text-lg" aria-label={`${n} de ${STAR_MAX}`}>
      {"★".repeat(n)}
      <span className="theme-text-muted">{"★".repeat(STAR_MAX - n)}</span>
    </span>
  );
}

function recLabel(rec?: string) {
  if (rec === "yes") return { text: "Buen match", cls: "bg-green-100 text-green-800" };
  if (rec === "maybe") return { text: "A mejorar", cls: "bg-amber-100 text-amber-800" };
  if (rec === "no") return { text: "Flojo para este puesto", cls: "bg-red-100 text-red-700" };
  return null;
}

function ResultCard({ puesto, a }: { puesto: string | null; a: ICvCheckAssessment }) {
  const rec = recLabel(a.recommendation);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm theme-text-muted">Evaluado para el puesto</p>
          <h2 className="text-xl font-bold theme-text-primary">{puesto || "—"}</h2>
        </div>
        <div className="text-right">
          <Stars score={a.fitScore} />
          <p className="text-sm theme-text-muted">{a.fitScore}%</p>
        </div>
      </div>
      {rec && <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${rec.cls}`}>{rec.text}</span>}
      {a.summary && <p className="text-sm theme-text-secondary">{a.summary}</p>}

      {a.strengths?.length > 0 && (
        <div>
          <p className="text-sm font-medium theme-text-primary mb-1">Fortalezas</p>
          <ul className="space-y-1">
            {a.strengths.map((s, i) => (
              <li key={i} className="text-sm theme-text-secondary flex items-start gap-2">
                <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {a.gaps?.length > 0 && (
        <div>
          <p className="text-sm font-medium theme-text-primary mb-1">A mejorar</p>
          <ul className="space-y-1">
            {a.gaps.map((s, i) => (
              <li key={i} className="text-sm theme-text-secondary flex items-start gap-2">
                <X className="h-4 w-4 text-[#E10600] shrink-0 mt-0.5" /> {s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(a.matchingSkills?.length > 0 || a.missingSkills?.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {a.matchingSkills?.map((s) => (
            <span key={`m-${s}`} className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">{s}</span>
          ))}
          {a.missingSkills?.map((s) => (
            <span key={`x-${s}`} className="text-xs px-2 py-0.5 rounded-full theme-bg-secondary theme-text-muted border theme-border">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluarCvContent() {
  const searchParams = useSearchParams();
  const TOKEN_KEY = "laburoya:cvCheckToken";

  // Rubro precargado desde la landing (?rubro=<key>), solo si es una key válida.
  const rubroParam = searchParams.get("rubro") || "";
  const [rubro, setRubro] = useState(rubroParam in JOB_CATEGORIES ? rubroParam : "");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"form" | "auth" | "analyzing" | "result">("form");
  const [authStep, setAuthStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cvToken, setCvToken] = useState<string | null>(null);
  const [result, setResult] = useState<{ puesto: string | null; assessment: ICvCheckAssessment } | null>(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [checking, setChecking] = useState(true);

  const runAnalyze = useCallback(async (rubroKey: string, cv: File, token: string) => {
    setStep("analyzing");
    try {
      const r = await api.analyzeCvPublic(rubroKey, cv, token);
      setResult({ puesto: r.puesto, assessment: r.assessment });
      setAlreadyUsed(false);
      setStep("result");
    } catch (error) {
      const e = error as { status?: number; message?: string };
      if (e?.status === 409) {
        const { check } = await api.getMyCvCheck(token);
        if (check) {
          setResult({ puesto: check.puesto, assessment: check.assessment });
          setAlreadyUsed(true);
          setStep("result");
          return;
        }
      }
      toast.error(e?.message || "No se pudo analizar el CV");
      setStep("form");
    }
  }, []);

  // Al cargar: si hay un token de CV-check guardado (NO es sesión de app) y ya
  // había un análisis, mostramos el resultado previo.
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!token) { setChecking(false); return; }
    setCvToken(token);
    (async () => {
      try {
        const { check } = await api.getMyCvCheck(token);
        if (check) {
          setResult({ puesto: check.puesto, assessment: check.assessment });
          setAlreadyUsed(true);
          setStep("result");
        }
      } catch {
        // token vencido/inválido: lo limpiamos y dejamos evaluar de nuevo
        localStorage.removeItem(TOKEN_KEY);
        setCvToken(null);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    e.target.value = "";
    if (f && f.size > 5 * 1024 * 1024) {
      toast.error("El archivo supera los 5MB");
      return;
    }
    setFile(f);
  };

  const onEvaluar = () => {
    if (!rubro) return toast.error("Elegí un rubro");
    if (!file) return toast.error("Subí tu CV en PDF");
    if (!cvToken) { setStep("auth"); setAuthStep("email"); return; }
    runAnalyze(rubro, file, cvToken);
  };

  const onSendCode = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitting(true);
    try {
      await api.requestCvCheckCode(email);
      setAuthStep("code");
      toast.success("Te enviamos un código a tu email");
    } catch (error) {
      const e = error as { message?: string };
      toast.error(e?.message || "No se pudo enviar el código");
    } finally {
      setSubmitting(false);
    }
  };

  const onVerifyCode = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!file) return;
    setSubmitting(true);
    try {
      const { token } = await api.verifyCvCheckCode(email, code);
      localStorage.setItem(TOKEN_KEY, token); // autoriza el CV-check, NO logea en la app
      setCvToken(token);
      await runAnalyze(rubro, file, token);
    } catch (error) {
      const e = error as { message?: string };
      toast.error(e?.message || "Código incorrecto");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen theme-bg-primary flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <Image src="/logo.png" alt="LaburoYA" width={160} height={44} className="h-14 w-auto mx-auto" priority />
          </Link>
          <h1 className="text-2xl font-bold theme-text-primary mt-4 flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-[#7C3AED]" /> Evaluá tu CV gratis
          </h1>
          <p className="theme-text-secondary text-sm mt-1">
            Subí tu CV y la IA te dice qué tan bien encaja para el rubro que elijas.
          </p>
        </div>

        <div className="theme-bg-card border theme-border rounded-2xl p-5 sm:p-6">
          {checking ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED]" />
            </div>
          ) : step === "result" && result ? (
            <>
              {alreadyUsed && (
                <div className="mb-4 text-xs px-3 py-2 rounded-lg bg-amber-100 text-amber-800">
                  Ya analizaste tu CV. Este es tu resultado.
                </div>
              )}
              <ResultCard puesto={result.puesto} a={result.assessment} />
              <div className="mt-6 text-center">
                <Link href="/" className="text-sm text-[#7C3AED] font-medium hover:underline">
                  Volver al inicio
                </Link>
              </div>
            </>
          ) : step === "analyzing" ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-[#7C3AED]" />
              <p className="text-sm theme-text-secondary">Analizando tu CV con IA…</p>
            </div>
          ) : step === "auth" && authStep === "email" ? (
            <form onSubmit={onSendCode} className="space-y-4">
              <div>
                <p className="font-semibold theme-text-primary">Validá tu email para ver el análisis</p>
                <p className="text-xs theme-text-muted mt-0.5">Te mandamos un código. Es gratis, no necesitás armar un perfil.</p>
              </div>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                className="w-full p-3 rounded-lg border theme-border theme-bg-secondary theme-text-primary text-sm focus:border-[#7C3AED] focus:outline-none"
              />
              <button
                type="submit" disabled={submitting}
                className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Enviar código
              </button>
            </form>
          ) : step === "auth" && authStep === "code" ? (
            <form onSubmit={onVerifyCode} className="space-y-4">
              <div>
                <p className="font-semibold theme-text-primary">Ingresá el código</p>
                <p className="text-xs theme-text-muted mt-0.5">Te lo enviamos a <span className="font-medium">{email}</span>.</p>
              </div>
              <input
                inputMode="numeric" autoComplete="one-time-code" required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Código de 6 dígitos"
                className="w-full p-3 rounded-lg border theme-border theme-bg-secondary theme-text-primary text-center text-lg tracking-[0.4em] focus:border-[#7C3AED] focus:outline-none"
              />
              <button
                type="submit" disabled={submitting || code.length !== 6}
                className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Validar y evaluar
              </button>
              <div className="flex items-center justify-between text-xs theme-text-muted">
                <button type="button" onClick={() => { setAuthStep("email"); setCode(""); }} className="text-[#7C3AED] font-medium">
                  Cambiar email
                </button>
                <button type="button" disabled={submitting} onClick={() => onSendCode({ preventDefault: () => {} } as React.FormEvent)} className="text-[#7C3AED] font-medium">
                  Reenviar código
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium theme-text-muted mb-1">En qué rubro querés laburar</label>
                <Select value={rubro || undefined} onValueChange={setRubro}>
                  <SelectTrigger className="w-full rounded-lg theme-bg-secondary theme-text-primary theme-border">
                    <SelectValue placeholder="Elegí un rubro (ej: gastronomía, comercio…)" />
                  </SelectTrigger>
                  <SelectContent>
                    {RUBROS.map((r) => (
                      <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-muted mb-1">Tu CV</label>
                <label className="block cursor-pointer">
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={onFile} className="hidden" />
                  <div className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-xl border-2 border-dashed theme-border text-sm theme-text-secondary hover:border-[#7C3AED] overflow-hidden">
                    <Upload className="h-4 w-4 shrink-0" />
                    <span className="truncate min-w-0">{file ? file.name : "Subí tu CV (PDF, imagen o Word) — máx 5MB"}</span>
                  </div>
                </label>
              </div>

              <button
                onClick={onEvaluar}
                className="w-full py-3 rounded-xl bg-[#7C3AED] text-white font-medium flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" /> Evaluar mi CV
              </button>
              <p className="text-xs text-center theme-text-muted">Para ver el resultado te vas a registrar (gratis).</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EvaluarCvPage() {
  return (
    <Suspense fallback={<div className="min-h-screen theme-bg-primary" />}>
      <EvaluarCvContent />
    </Suspense>
  );
}
