"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { EUserRole, IAdminUser, ICompanyPlan } from "@/types";

export default function AdminCompaniesPage() {
  const router = useRouter();
  const { impersonateCompany } = useAuth();
  const [companies, setCompanies] = useState<IAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [enteringId, setEnteringId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [plans, setPlans] = useState<ICompanyPlan[]>([]);

  const [form, setForm] = useState({
    businessName: "",
    email: "",
    contactName: "",
    phone: "",
    companyPlanId: "",
  });

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers({ role: EUserRole.COMPANY });
      setCompanies(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar empresas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    api.getAdminCompanyPlans({ active: true }).then((d) => setPlans(d.plans)).catch(() => {});
  }, [fetchCompanies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.businessName || !form.email) {
      setError("Razón social y email son obligatorios");
      return;
    }
    if (!form.companyPlanId) {
      setError("Tenés que elegir un plan para la empresa");
      return;
    }
    setCreating(true);
    try {
      await api.createAdminUser({
        email: form.email,
        businessName: form.businessName,
        firstName: form.contactName || undefined,
        phone: form.phone || undefined,
        companyPlanId: form.companyPlanId,
        role: "company",
      });
      setForm({ businessName: "", email: "", contactName: "", phone: "", companyPlanId: "" });
      setShowForm(false);
      await fetchCompanies();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear empresa");
    } finally {
      setCreating(false);
    }
  };

  const handleEnter = async (uid: string) => {
    setEnteringId(uid);
    try {
      await impersonateCompany(uid);
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar a la empresa");
      setEnteringId(null);
    }
  };

  return (
    <AdminLayout title="Empresas">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="theme-text-secondary text-sm">
            Cuentas empresa (multiusuario, con talent pool). Se crean por invitación.
          </p>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90"
          >
            {showForm ? "Cancelar" : "Crear empresa"}
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="theme-bg-card rounded-lg p-4 space-y-3 border theme-border"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Razón social *</label>
                <input
                  value={form.businessName}
                  onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Email de la empresa *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Nombre de contacto (RRHH)</label>
                <input
                  value={form.contactName}
                  onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Teléfono</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Plan *</label>
                <select
                  value={form.companyPlanId}
                  onChange={(e) => setForm({ ...form, companyPlanId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                >
                  <option value="">Elegí un plan…</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.durationMonths}m · {p.aiCvEnabled ? "IA" : "sin IA"} ·{" "}
                      {p.maxCvAnalyses === -1 ? "∞ CVs" : `${p.maxCvAnalyses} CVs`}
                    </option>
                  ))}
                </select>
                {plans.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No hay planes de empresa. Creá uno en “Planes Empresa” primero.
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs theme-text-muted">
              Se enviará una invitación al email de la empresa para activar la cuenta.
            </p>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear y enviar invitación"}
            </button>
          </form>
        )}

        <div className="theme-bg-card rounded-lg border theme-border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center theme-text-muted text-sm">Cargando...</div>
          ) : companies.length === 0 ? (
            <div className="p-6 text-center theme-text-muted text-sm">
              Todavía no hay cuentas empresa.
            </div>
          ) : (
            <ul className="divide-y theme-border">
              {companies.map((c) => (
                <li key={c.uid} className="flex items-center justify-between p-4">
                  <div className="min-w-0">
                    <p className="font-medium theme-text-primary truncate">
                      {(c.profile && "businessName" in c.profile && c.profile.businessName) ||
                        c.email ||
                        c.uid}
                    </p>
                    <p className="text-xs theme-text-muted truncate">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/sudo/companies/${c.uid}`}
                      className="text-xs px-3 py-1.5 rounded-lg theme-bg-secondary theme-text-secondary hover:theme-text-primary border theme-border"
                    >
                      Ver
                    </Link>
                    <button
                      onClick={() => handleEnter(c.uid)}
                      disabled={enteringId === c.uid}
                      className="text-xs px-3 py-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      {enteringId === c.uid ? "Entrando..." : "Entrar como empresa"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
