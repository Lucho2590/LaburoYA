'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IOrphanOffer } from '@/types';
import { toast } from 'sonner';

export default function AdminOrphanOffersPage() {
  const [offers, setOffers] = useState<IOrphanOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const data = await api.getOrphanOffers();
      setOffers(data.offers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar ofertas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  const handleDelete = async (o: IOrphanOffer) => {
    if (
      !window.confirm(
        `¿Eliminar definitivamente esta oferta?\n\n${o.puesto || '?'} / ${o.rubro || '?'} — ${o.zona || 'sin zona'}\n\nSe borra la oferta y su data relacionada (interacciones, matches, solicitudes, candidatos rankeados). Es irreversible.`
      )
    ) {
      return;
    }
    setDeleting(o.id);
    try {
      await api.deleteOrphanOffer(o.id);
      setOffers((prev) => prev.filter((x) => x.id !== o.id));
      toast.success('Oferta eliminada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const badge = (category: IOrphanOffer['category']) =>
    category === 'orphan'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';

  return (
    <AdminLayout title="Ofertas huérfanas">
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Ofertas sin dueño válido: <strong>huérfanas</strong> (el <code>employerId</code> ya no existe
          en <code>users</code>) o creadas por un <strong>superuser</strong> (ofertas de prueba). Aparecen
          y matchean en la app pero no pertenecen a una cuenta real. Acá podés eliminarlas.
        </p>
        <span className="theme-text-muted text-sm">
          {offers.length} oferta{offers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <table className="w-full">
          <thead className="theme-bg-secondary">
            <tr>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Tipo</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Puesto / Rubro</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Zona</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Activa</th>
              <th className="text-right px-6 py-4 theme-text-secondary text-sm font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y theme-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
                  </div>
                </td>
              </tr>
            ) : offers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center theme-text-muted">
                  No hay ofertas para limpiar 🎉
                </td>
              </tr>
            ) : (
              offers.map((o) => (
                <tr key={o.id} className="hover:theme-bg-secondary transition-colors">
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge(o.category)}`}>
                      {o.category === 'orphan' ? 'Huérfana' : 'Superuser'}
                    </span>
                  </td>
                  <td className="px-6 py-4 theme-text-primary">
                    {o.puesto || '?'} <span className="theme-text-muted">/ {o.rubro || '?'}</span>
                  </td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">{o.zona || '-'}</td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">{o.active ? 'Sí' : 'No'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(o)}
                      disabled={deleting === o.id}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting === o.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
