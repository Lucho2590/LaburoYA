"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { api } from "@/services/api";
import { IRubro, ICreateRubroData } from "@/types";
import { toast } from "sonner";
import {
  FolderOpen,
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";

type ModalMode = "create" | "edit" | null;

export default function AdminRubrosPage() {
  const [rubros, setRubros] = useState<IRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedRubro, setSelectedRubro] = useState<IRubro | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ICreateRubroData>({
    nombre: "",
    icono: "",
    activo: true,
    orden: 0,
  });

  const fetchRubros = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getAdminRubros();
      setRubros(data.rubros);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar rubros");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRubros();
  }, []);

  const openCreateModal = () => {
    setFormData({
      nombre: "",
      icono: "",
      activo: true,
      orden: rubros.length,
    });
    setSelectedRubro(null);
    setModalMode("create");
  };

  const openEditModal = (rubro: IRubro) => {
    setFormData({
      nombre: rubro.nombre,
      icono: rubro.icono || "",
      activo: rubro.activo,
      orden: rubro.orden || 0,
    });
    setSelectedRubro(rubro);
    setModalMode("edit");
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedRubro(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (modalMode === "create") {
        await api.createAdminRubro(formData);
        toast.success("Rubro creado correctamente");
      } else if (modalMode === "edit" && selectedRubro) {
        await api.updateAdminRubro(selectedRubro.id, formData);
        toast.success("Rubro actualizado correctamente");
      }
      closeModal();
      api.getAdminRubros().then(d => setRubros(d.rubros)).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rubroId: string) => {
    if (!confirm("¿Estás seguro de eliminar este rubro?")) return;

    setDeleting(rubroId);
    try {
      await api.deleteAdminRubro(rubroId);
      toast.success("Rubro eliminado correctamente");
      setRubros(prev => prev.filter(r => r.id !== rubroId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (rubro: IRubro) => {
    try {
      await api.updateAdminRubro(rubro.id, { activo: !rubro.activo });
      toast.success(rubro.activo ? "Rubro desactivado" : "Rubro activado");
      setRubros(prev => prev.map(r => r.id === rubro.id ? { ...r, activo: !rubro.activo } : r));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  // Common emojis for job categories
  const suggestedEmojis = [
    "💼",
    "🍳",
    "🏪",
    "🏗️",
    "🧹",
    "🚗",
    "💻",
    "🔧",
    "📦",
    "🎨",
    "📸",
    "✂️",
  ];

  // Stats
  const totalRubros = rubros.length;
  const activeRubros = rubros.filter((r) => r.activo).length;
  const inactiveRubros = rubros.filter((r) => !r.activo).length;

  if (loading) {
    return (
      <AdminLayout title="Rubros">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Rubros">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Rubros">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">
                {totalRubros}
              </p>
              <p className="text-sm theme-text-muted">Total rubros</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">
                {activeRubros}
              </p>
              <p className="text-sm theme-text-muted">Activos</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">
                {inactiveRubros}
              </p>
              <p className="text-sm theme-text-muted">Inactivos</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header con botón */}
      <div className="flex items-center justify-between mb-4">
        <p className="theme-text-secondary text-sm">
          Administrá las categorías de trabajo disponibles
        </p>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-[#E10600] text-white px-4 py-2 rounded-lg hover:bg-[#c00500] transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Rubro
        </button>
      </div>

      {/* Rubros Table */}
      {rubros.length === 0 ? (
        <div className="text-center py-16 theme-bg-card rounded-xl border theme-border">
          <span className="text-5xl">📂</span>
          <p className="theme-text-primary font-medium mt-4">
            No hay rubros creados
          </p>
          <p className="theme-text-muted text-sm mt-1">
            Creá tu primer rubro para empezar
          </p>
        </div>
      ) : (
        <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full">
              <thead className="theme-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Rubro
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Orden
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {rubros.map((rubro) => (
                  <tr
                    key={rubro.id}
                    className={!rubro.activo ? "opacity-60" : ""}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{rubro.icono || "💼"}</span>
                        <span className="font-medium theme-text-primary">
                          {rubro.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 theme-text-secondary">
                      {rubro.orden}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          rubro.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {rubro.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(rubro)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(rubro)}
                          className={`p-2 rounded-lg transition-colors ${
                            rubro.activo
                              ? "text-yellow-600 hover:bg-yellow-100"
                              : "text-green-600 hover:bg-green-100"
                          }`}
                          title={rubro.activo ? "Desactivar" : "Activar"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rubro.id)}
                          disabled={deleting === rubro.id}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deleting === rubro.id ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="theme-bg-card rounded-xl w-full max-w-md">
            <div className="p-6 border-b theme-border">
              <h2 className="text-xl font-bold theme-text-primary">
                {modalMode === "create" ? "Nuevo Rubro" : "Editar Rubro"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Nombre del rubro *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData({ ...formData, nombre: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Ej: Gastronomía"
                  required
                />
              </div>

              {/* Icono */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Icono (emoji)
                </label>
                <input
                  type="text"
                  value={formData.icono}
                  onChange={(e) =>
                    setFormData({ ...formData, icono: e.target.value })
                  }
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  placeholder="Ej: 🍳"
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestedEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormData({ ...formData, icono: emoji })}
                      className={`w-10 h-10 rounded-lg border transition-all ${
                        formData.icono === emoji
                          ? "border-[#E10600] bg-red-50"
                          : "theme-border hover:bg-gray-100"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orden */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-1">
                  Orden de visualización
                </label>
                <input
                  type="number"
                  value={formData.orden}
                  onChange={(e) =>
                    setFormData({ ...formData, orden: Number(e.target.value) })
                  }
                  className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                  min={0}
                />
              </div>

              {/* Activo */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.activo}
                    onChange={(e) =>
                      setFormData({ ...formData, activo: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300 text-[#E10600] focus:ring-[#E10600]"
                  />
                  <span className="text-sm theme-text-secondary">Activo</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border theme-border rounded-lg theme-text-secondary hover:theme-bg-secondary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-[#E10600] text-white rounded-lg hover:bg-[#c00500] transition-colors disabled:opacity-50"
                >
                  {saving
                    ? "Guardando..."
                    : modalMode === "create"
                      ? "Crear Rubro"
                      : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
