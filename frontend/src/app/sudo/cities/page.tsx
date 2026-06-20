"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/AdminLayout";
import ConfirmDialog from "@/components/ConfirmDialog";
import { api } from "@/services/api";
import { ICity } from "@/types";
import { toast } from "sonner";
import {
  MapPin,
  CheckCircle,
  XCircle,
  Plus,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";

export default function AdminCitiesPage() {
  const [cities, setCities] = useState<ICity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [cityToDelete, setCityToDelete] = useState<ICity | null>(null);

  const fetchCities = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.getAdminCities();
      setCities(data.cities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar ciudades");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCities();
  }, []);

  const handleDelete = async () => {
    if (!cityToDelete) return;
    const cityId = cityToDelete.id;
    setDeleting(cityId);
    try {
      await api.deleteAdminCity(cityId);
      toast.success("Ciudad eliminada correctamente");
      setCities((prev) => prev.filter((c) => c.id !== cityId));
      setCityToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const handleToggleActive = async (city: ICity) => {
    try {
      await api.updateAdminCity(city.id, { activo: !city.activo });
      toast.success(city.activo ? "Ciudad desactivada" : "Ciudad activada");
      setCities((prev) =>
        prev.map((c) => (c.id === city.id ? { ...c, activo: !city.activo } : c))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  // Stats
  const totalCities = cities.length;
  const activeCities = cities.filter((c) => c.activo).length;
  const inactiveCities = cities.filter((c) => !c.activo).length;

  if (loading) {
    return (
      <AdminLayout title="Ciudades">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Ciudades">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Ciudades">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{totalCities}</p>
              <p className="text-sm theme-text-muted">Total ciudades</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{activeCities}</p>
              <p className="text-sm theme-text-muted">Activas</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{inactiveCities}</p>
              <p className="text-sm theme-text-muted">Inactivas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header con botón */}
      <div className="flex items-center justify-between mb-4">
        <p className="theme-text-secondary text-sm">
          Administrá las ciudades donde opera la app (centro, radio y zonas)
        </p>
        <Link
          href="/sudo/cities/new"
          className="flex items-center gap-2 bg-[#E10600] text-white px-4 py-2 rounded-lg hover:bg-[#c00500] transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Nueva Ciudad
        </Link>
      </div>

      {/* Cities Table */}
      {cities.length === 0 ? (
        <div className="text-center py-16 theme-bg-card rounded-xl border theme-border">
          <span className="text-5xl">📍</span>
          <p className="theme-text-primary font-medium mt-4">No hay ciudades creadas</p>
          <p className="theme-text-muted text-sm mt-1">
            Creá tu primera ciudad para empezar
          </p>
        </div>
      ) : (
        <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-300px)]">
            <table className="w-full">
              <thead className="theme-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Ciudad
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Radio
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Zonas
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
                {cities.map((city) => (
                  <tr key={city.id} className={!city.activo ? "opacity-60" : ""}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-[#E10600]" />
                        <span className="font-medium theme-text-primary">
                          {city.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 theme-text-secondary">
                      {city.radiusKm} km
                    </td>
                    <td className="px-6 py-4 theme-text-secondary">
                      {(city.zonas || []).length}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          city.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {city.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/sudo/cities/${city.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleToggleActive(city)}
                          className={`p-2 rounded-lg transition-colors ${
                            city.activo
                              ? "text-yellow-600 hover:bg-yellow-100"
                              : "text-green-600 hover:bg-green-100"
                          }`}
                          title={city.activo ? "Desactivar" : "Activar"}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCityToDelete(city)}
                          disabled={deleting === city.id}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deleting === city.id ? (
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

      <ConfirmDialog
        open={!!cityToDelete}
        title="Eliminar ciudad"
        description={
          cityToDelete
            ? `¿Seguro que querés eliminar "${cityToDelete.nombre}"? Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        loading={!!deleting}
        onConfirm={handleDelete}
        onCancel={() => setCityToDelete(null)}
      />
    </AdminLayout>
  );
}
