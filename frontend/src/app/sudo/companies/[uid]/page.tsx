"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { IAdminUserDetail, ICompanyProfile, ICompanyMember, ICompanyPlan } from "@/types";

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const uid = params.uid as string;
  const router = useRouter();
  const { impersonateCompany } = useAuth();

  const [detail, setDetail] = useState<IAdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Equipo
  const [members, setMembers] = useState<ICompanyMember[]>([]);
  const [inviteForm, setInviteForm] = useState({ email: "", firstName: "", lastName: "" });
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Límite de miembros
  const [maxMembersInput, setMaxMembersInput] = useState<string>("");
  const [savingLimit, setSavingLimit] = useState(false);

  // Suscripción
  const [companyPlans, setCompanyPlans] = useState<ICompanyPlan[]>([]);
  const [renewPlanId, setRenewPlanId] = useState<string>("");
  const [savingSub, setSavingSub] = useState(false);
  const [aiOverride, setAiOverride] = useState(false);
  const [maxCvInput, setMaxCvInput] = useState<string>("");

  // Eliminar empresa
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUser(uid);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar empresa");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.getAdminCompanyMembers(uid);
      setMembers(data.members);
    } catch {
      // El equipo es secundario; no bloquea la vista si falla.
    }
  }, [uid]);

  useEffect(() => {
    fetchDetail();
    fetchMembers();
  }, [fetchDetail, fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!inviteForm.email) {
      setError("El email del miembro es obligatorio");
      return;
    }
    setInviting(true);
    try {
      await api.inviteAdminCompanyMember(uid, {
        email: inviteForm.email,
        firstName: inviteForm.firstName || undefined,
        lastName: inviteForm.lastName || undefined,
      });
      setInviteForm({ email: "", firstName: "", lastName: "" });
      setNotice("Invitación enviada");
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo invitar al miembro");
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    setRemovingId(memberUid);
    setError(null);
    try {
      await api.removeAdminCompanyMember(uid, memberUid);
      await fetchMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar al miembro");
    } finally {
      setRemovingId(null);
    }
  };

  // Inicializa inputs (límite de miembros + overrides de suscripción) al llegar el perfil.
  useEffect(() => {
    const p = detail?.profile as ICompanyProfile | null;
    setMaxMembersInput(p?.maxMembers == null ? "" : String(p.maxMembers));
    setAiOverride(p?.subscription?.aiCvEnabled === true);
    const mx = p?.subscription?.maxCvAnalyses;
    setMaxCvInput(mx == null ? "" : String(mx));
  }, [detail]);

  // Cargar planes de empresa para el selector de renovación.
  useEffect(() => {
    api
      .getAdminCompanyPlans({ active: true })
      .then((d) => setCompanyPlans(d.plans))
      .catch(() => {});
  }, []);

  const handleRenew = async () => {
    if (!renewPlanId) {
      setError("Elegí un plan para renovar/activar");
      return;
    }
    setSavingSub(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateAdminCompany(uid, { planId: renewPlanId });
      setNotice("Plan activado/renovado");
      setRenewPlanId("");
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renovar el plan");
    } finally {
      setSavingSub(false);
    }
  };

  const handleSaveSubOverrides = async () => {
    setSavingSub(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateAdminCompany(uid, {
        aiCvEnabled: aiOverride,
        maxCvAnalyses: maxCvInput.trim() === "" ? -1 : Number(maxCvInput),
      });
      setNotice("Ajustes de suscripción guardados");
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los ajustes");
    } finally {
      setSavingSub(false);
    }
  };

  const handleSaveLimit = async () => {
    setSavingLimit(true);
    setError(null);
    setNotice(null);
    try {
      const trimmed = maxMembersInput.trim();
      await api.updateAdminCompany(uid, { maxMembers: trimmed === "" ? null : Number(trimmed) });
      setNotice("Límite actualizado");
      await fetchDetail();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el límite");
    } finally {
      setSavingLimit(false);
    }
  };

  const handleDeleteCompany = async (hard: boolean) => {
    setDeleting(true);
    try {
      await api.deleteAdminUser(uid, hard);
      router.push("/sudo/companies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la empresa");
      setDeleting(false);
    }
  };

  const handleEnter = async () => {
    setEntering(true);
    try {
      await impersonateCompany(uid);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar a la empresa");
      setEntering(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setNotice(null);
    try {
      await api.resendAdminUserInvitation(uid);
      setNotice("Invitación reenviada");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reenviar la invitación");
    } finally {
      setResending(false);
    }
  };

  const profile = (detail?.profile as ICompanyProfile | null) || null;
  const sub = profile?.subscription;
  const kpis = profile?.kpis;

  return (
    <AdminLayout title="Empresa">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/sudo/companies" className="text-sm text-[#E10600] hover:underline">
          ← Volver a empresas
        </Link>

        {error && <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-green-100 text-green-800 text-sm">{notice}</div>}

        {loading ? (
          <div className="p-6 text-center theme-text-muted text-sm">Cargando...</div>
        ) : !detail ? (
          <div className="p-6 text-center theme-text-muted text-sm">Empresa no encontrada.</div>
        ) : (
          <>
            <div className="theme-bg-card rounded-lg border theme-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold theme-text-primary truncate">
                    {profile?.businessName || detail.user.email || uid}
                  </h2>
                  <p className="text-sm theme-text-muted">{detail.user.email}</p>
                  {profile?.contactName && (
                    <p className="text-sm theme-text-secondary mt-1">
                      Contacto: {profile.contactName}
                    </p>
                  )}
                  {profile?.phone && (
                    <p className="text-sm theme-text-secondary">Tel: {profile.phone}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={handleEnter}
                    disabled={entering}
                    className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
                  >
                    {entering ? "Entrando..." : "Entrar como empresa"}
                  </button>
                  <button
                    onClick={handleResend}
                    disabled={resending}
                    className="px-4 py-2 rounded-lg theme-bg-secondary theme-text-secondary border theme-border text-sm hover:theme-text-primary disabled:opacity-50"
                  >
                    {resending ? "Reenviando..." : "Reenviar invitación"}
                  </button>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="theme-bg-card rounded-lg border theme-border p-4 text-center">
                <p className="text-2xl font-bold theme-text-primary">{detail.stats.jobOffers}</p>
                <p className="text-xs theme-text-muted">Búsquedas</p>
              </div>
              <div className="theme-bg-card rounded-lg border theme-border p-4 text-center">
                <p className="text-2xl font-bold theme-text-primary">{detail.stats.matches}</p>
                <p className="text-xs theme-text-muted">Matches</p>
              </div>
              <div className="theme-bg-card rounded-lg border theme-border p-4 text-center">
                <p className="text-2xl font-bold theme-text-primary">
                  {kpis?.talentPoolSize ?? 0}
                </p>
                <p className="text-xs theme-text-muted">Talent pool</p>
              </div>
            </div>

            {/* Suscripción */}
            {(() => {
              const end = sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
              const expired = !end || end.getTime() < Date.now();
              const maxCv = sub?.maxCvAnalyses ?? -1;
              return (
                <div className="theme-bg-card rounded-lg border theme-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold theme-text-primary">Suscripción</h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        expired ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"
                      }`}
                    >
                      {expired ? "Vencido" : "Activo"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                    <div className="theme-text-muted">Plan</div>
                    <div className="theme-text-secondary">{sub?.planName || "—"}</div>
                    <div className="theme-text-muted">Vence</div>
                    <div className="theme-text-secondary">
                      {end ? end.toLocaleDateString("es-AR") : "—"}
                    </div>
                    <div className="theme-text-muted">IA análisis CV</div>
                    <div className="theme-text-secondary">{sub?.aiCvEnabled ? "Sí" : "No"}</div>
                    <div className="theme-text-muted">CVs analizados</div>
                    <div className="theme-text-secondary">
                      {sub?.cvAnalysesUsed ?? 0} {maxCv === -1 ? "/ ∞" : `/ ${maxCv}`}
                    </div>
                  </div>

                  {/* Renovar / asignar plan */}
                  <div className="flex items-end gap-2 pt-2 border-t theme-border">
                    <div className="flex-1">
                      <label className="block text-xs theme-text-muted mb-1">Renovar / asignar plan</label>
                      <select
                        value={renewPlanId}
                        onChange={(e) => setRenewPlanId(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                      >
                        <option value="">Elegí un plan…</option>
                        {companyPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} · {p.durationMonths}m · {p.aiCvEnabled ? "IA" : "sin IA"} ·{" "}
                            {p.maxCvAnalyses === -1 ? "∞ CVs" : `${p.maxCvAnalyses} CVs`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={handleRenew}
                      disabled={savingSub}
                      className="px-3 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      Activar/Renovar
                    </button>
                  </div>

                  {/* Override por empresa */}
                  <div className="pt-2 border-t theme-border space-y-2">
                    <p className="text-xs theme-text-muted">Override de esta empresa (sobre el plan)</p>
                    <label className="flex items-center gap-2 text-sm theme-text-secondary">
                      <input
                        type="checkbox"
                        checked={aiOverride}
                        onChange={(e) => setAiOverride(e.target.checked)}
                      />
                      Habilitar IA para analizar CVs
                    </label>
                    <div className="flex items-end gap-2">
                      <div>
                        <label className="block text-xs theme-text-muted mb-1">Cupo de CVs (-1 = ∞)</label>
                        <input
                          type="number"
                          value={maxCvInput}
                          onChange={(e) => setMaxCvInput(e.target.value)}
                          placeholder="-1"
                          className="w-32 px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                        />
                      </div>
                      <button
                        onClick={handleSaveSubOverrides}
                        disabled={savingSub}
                        className="px-3 py-2 rounded-lg theme-bg-secondary theme-text-secondary border theme-border text-sm hover:theme-text-primary disabled:opacity-50"
                      >
                        Guardar override
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Equipo */}
            <div className="theme-bg-card rounded-lg border theme-border p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold theme-text-primary">
                  Equipo{" "}
                  <span className="theme-text-muted font-normal">
                    ({members.length}
                    {profile?.maxMembers != null ? ` / ${profile.maxMembers}` : " · sin límite"})
                  </span>
                </h3>
              </div>

              {/* Límite de cuentas */}
              <div className="flex items-end gap-2 mb-4">
                <div>
                  <label className="block text-xs theme-text-muted mb-1">
                    Límite de cuentas (incluye al dueño)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={maxMembersInput}
                    onChange={(e) => setMaxMembersInput(e.target.value)}
                    placeholder="Sin límite"
                    className="w-40 px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  />
                </div>
                <button
                  onClick={handleSaveLimit}
                  disabled={savingLimit}
                  className="px-3 py-2 rounded-lg theme-bg-secondary theme-text-secondary border theme-border text-sm hover:theme-text-primary disabled:opacity-50"
                >
                  {savingLimit ? "Guardando..." : "Guardar límite"}
                </button>
              </div>

              <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-3">
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="email@empresa.com"
                  className="sm:col-span-2 w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                />
                <input
                  value={inviteForm.firstName}
                  onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                  placeholder="Nombre"
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
                <button
                  type="submit"
                  disabled={inviting}
                  className="px-3 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {inviting ? "Enviando..." : "Invitar"}
                </button>
              </form>

              {members.length === 0 ? (
                <p className="text-xs theme-text-muted">Sin miembros todavía.</p>
              ) : (
                <ul className="divide-y theme-border">
                  {members.map((m) => {
                    const name = [m.firstName, m.lastName].filter(Boolean).join(" ");
                    return (
                      <li key={m.uid} className="flex items-center justify-between py-2 gap-2">
                        <div className="min-w-0">
                          <p className="text-sm theme-text-primary truncate">
                            {name || m.email || m.uid}
                          </p>
                          {name && m.email && (
                            <p className="text-xs theme-text-muted truncate">{m.email}</p>
                          )}
                        </div>
                        {m.isOwner ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium flex-shrink-0">
                            Dueño
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRemoveMember(m.uid)}
                            disabled={removingId === m.uid}
                            className="text-xs px-3 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex-shrink-0"
                          >
                            {removingId === m.uid ? "Quitando..." : "Quitar"}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Zona de peligro */}
            <div className="rounded-lg p-4 border-2 border-red-300 dark:border-red-800">
              <h3 className="text-sm font-semibold text-red-600 mb-3">Zona de peligro</h3>
              {!showDeleteConfirm ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm theme-text-secondary">
                    Eliminar esta empresa (perfil, ofertas, talent pool y miembros).
                  </p>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 flex-shrink-0"
                  >
                    Eliminar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm theme-text-secondary">¿Cómo querés eliminarla?</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleDeleteCompany(false)}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-yellow-600 text-white text-sm hover:bg-yellow-700 disabled:opacity-50"
                    >
                      Deshabilitar (soft)
                    </button>
                    <button
                      onClick={() => handleDeleteCompany(true)}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Eliminar todo (hard)
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-4 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                  <p className="text-xs theme-text-muted">
                    Hard delete: borra perfil, ofertas, talent pool, miembros y libera los emails.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
