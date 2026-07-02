'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IOrphanWorker } from '@/types';
import { toast } from 'sonner';

export default function AdminOrphansPage() {
  const [orphans, setOrphans] = useState<IOrphanWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchOrphans = async () => {
    setLoading(true);
    try {
      const data = await api.getOrphanWorkers();
      setOrphans(data.orphans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar huérfanos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrphans();
  }, []);

  const handleDelete = async (o: IOrphanWorker) => {
    if (
      !window.confirm(
        `¿Eliminar definitivamente este perfil huérfano?\n\n${o.puesto || '?'} / ${o.rubro || '?'} — ${o.zona || 'sin zona'}\n\nSe borra el perfil y su data relacionada (matches, interacciones, solicitudes). Es irreversible.`
      )
    ) {
      return;
    }
    setDeleting(o.uid);
    try {
      await api.deleteOrphanWorker(o.uid);
      setOrphans((prev) => prev.filter((x) => x.uid !== o.uid));
      toast.success('Perfil huérfano eliminado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AdminLayout title="Perfiles huérfanos">
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Perfiles de candidato que existen en <code>workers</code> pero no tienen usuario asociado
          (se borró el usuario a mano en Firebase). Aparecen como candidatos en la app pero no en la
          lista de Usuarios. Acá podés eliminarlos definitivamente.
        </p>
        <span className="theme-text-muted text-sm">
          {orphans.length} huérfano{orphans.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <table className="w-full">
          <thead className="theme-bg-secondary">
            <tr>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">UID</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Puesto / Rubro</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Zona</th>
              <th className="text-left px-6 py-4 theme-text-secondary text-sm font-medium">Video</th>
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
            ) : orphans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center theme-text-muted">
                  No hay perfiles huérfanos 🎉
                </td>
              </tr>
            ) : (
              orphans.map((o) => (
                <tr key={o.uid} className="hover:theme-bg-secondary transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs theme-text-muted">{o.uid.slice(0, 10)}…</span>
                  </td>
                  <td className="px-6 py-4 theme-text-primary">
                    {o.puesto || '?'} <span className="theme-text-muted">/ {o.rubro || '?'}</span>
                  </td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">{o.zona || '-'}</td>
                  <td className="px-6 py-4 theme-text-secondary text-sm">{o.hasVideo ? 'Sí' : 'No'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(o)}
                      disabled={deleting === o.uid}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {deleting === o.uid ? 'Eliminando…' : 'Eliminar'}
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
