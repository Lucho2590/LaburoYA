"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/services/api";
import { ICompanyPlan, ICreateCompanyPlanData } from "@/types";

const EMPTY: ICreateCompanyPlanData = {
  name: "",
  description: "",
  durationMonths: 1,
  aiCvEnabled: true,
  maxCvAnalyses: 50,
  price: 0,
  isDefault: false,
  active: true,
  order: 0,
};

export default function AdminCompanyPlansPage() {
  const [plans, setPlans] = useState<ICompanyPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ICreateCompanyPlanData>(EMPTY);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminCompanyPlans();
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar planes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  };

  const openEdit = (p: ICompanyPlan) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || "",
      durationMonths: p.durationMonths,
      aiCvEnabled: p.aiCvEnabled,
      maxCvAnalyses: p.maxCvAnalyses,
      price: p.price ?? 0,
      isDefault: p.isDefault ?? false,
      active: p.active,
      order: p.order ?? 0,
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await api.updateAdminCompanyPlan(editingId, form);
      } else {
        await api.createAdminCompanyPlan(form);
      }
      setShowForm(false);
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el plan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: ICompanyPlan) => {
    if (!confirm(`¿Eliminar el plan "${p.name}"?`)) return;
    try {
      await api.deleteAdminCompanyPlan(p.id);
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  return (
    <AdminLayout title="Planes Empresa">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <p className="theme-text-secondary text-sm">
            Planes para cuentas empresa: vigencia, IA para analizar CVs y cupo de CVs. No cobran por búsqueda.
          </p>
          <button
            onClick={() => (showForm ? setShowForm(false) : openCreate())}
            className="px-4 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90"
          >
            {showForm ? "Cancelar" : "Crear plan"}
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-100 text-red-800 text-sm">{error}</div>}

        {showForm && (
          <form onSubmit={handleSave} className="theme-bg-card border theme-border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Vigencia (meses) *</label>
                <input
                  type="number"
                  min={1}
                  value={form.durationMonths}
                  onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Cupo de CVs (-1 = ilimitado)</label>
                <input
                  type="number"
                  min={-1}
                  value={form.maxCvAnalyses}
                  onChange={(e) => setForm({ ...form, maxCvAnalyses: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Precio (informativo)</label>
                <input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Orden</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs theme-text-muted mb-1">Descripción</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg theme-bg-secondary theme-text-primary border theme-border text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm theme-text-secondary">
                <input
                  type="checkbox"
                  checked={form.aiCvEnabled}
                  onChange={(e) => setForm({ ...form, aiCvEnabled: e.target.checked })}
                />
                IA para analizar CVs
              </label>
              <label className="flex items-center gap-2 text-sm theme-text-secondary">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Activo
              </label>
              <label className="flex items-center gap-2 text-sm theme-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                Plan por defecto
              </label>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#E10600] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear plan"}
            </button>
          </form>
        )}

        <div className="theme-bg-card rounded-lg border theme-border overflow-hidden">
          {loading ? (
            <div className="p-6 text-center theme-text-muted text-sm">Cargando...</div>
          ) : plans.length === 0 ? (
            <div className="p-6 text-center theme-text-muted text-sm">Todavía no hay planes de empresa.</div>
          ) : (
            <ul className="divide-y theme-border">
              {plans.map((p) => (
                <li key={p.id} className="flex items-center justify-between p-4 gap-3">
                  <div className="min-w-0">
                    <p className="font-medium theme-text-primary truncate">
                      {p.name}
                      {p.isDefault && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800">Default</span>
                      )}
                      {!p.active && (
                        <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Inactivo</span>
                      )}
                    </p>
                    <p className="text-xs theme-text-muted">
                      {p.durationMonths} {p.durationMonths === 1 ? "mes" : "meses"} ·{" "}
                      {p.aiCvEnabled ? "IA on" : "IA off"} ·{" "}
                      {p.maxCvAnalyses === -1 ? "CVs ilimitados" : `${p.maxCvAnalyses} CVs`}
                      {p.price ? ` · $${p.price}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-xs px-3 py-1.5 rounded-lg theme-bg-secondary theme-text-secondary border theme-border hover:theme-text-primary"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                    >
                      Eliminar
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
