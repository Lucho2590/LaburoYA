'use client';

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { ILead, ILeadStats, IRubro } from '@/types';
import { toast } from 'sonner';
import { Phone, MessageCircle, Check, Clock, Trash2, Users, Filter } from 'lucide-react';

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<ILead[]>([]);
  const [stats, setStats] = useState<ILeadStats | null>(null);
  const [rubros, setRubros] = useState<IRubro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterContacted, setFilterContacted] = useState<'all' | 'yes' | 'no'>('all');
  const [filterRubro, setFilterRubro] = useState<string>('');

  // Actions
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const params: { contacted?: boolean; rubroId?: string } = {};
      if (filterContacted === 'yes') params.contacted = true;
      if (filterContacted === 'no') params.contacted = false;
      if (filterRubro) params.rubroId = filterRubro;

      const [leadsData, statsData, rubrosData] = await Promise.all([
        api.getAdminLeads(params),
        api.getAdminLeadsStats(),
        api.getAdminRubros(),
      ]);

      setLeads(leadsData.leads);
      setStats(statsData);
      setRubros(rubrosData.rubros);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterContacted, filterRubro]);

  const handleToggleContacted = async (lead: ILead) => {
    setUpdating(lead.id);
    try {
      await api.updateAdminLead(lead.id, { contacted: !lead.contacted });
      toast.success(lead.contacted ? 'Marcado como pendiente' : 'Marcado como contactado');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar');
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (leadId: string) => {
    if (!confirm('¿Estás seguro de eliminar este lead?')) return;

    setDeleting(leadId);
    try {
      await api.deleteAdminLead(leadId);
      toast.success('Lead eliminado correctamente');
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setDeleting(null);
    }
  };

  const openWhatsApp = (phone: string, nombre: string) => {
    const message = encodeURIComponent(
      `Hola ${nombre}! Te contactamos de LaburoYA. Tenemos ofertas de trabajo que podrían interesarte.`
    );
    window.open(`https://wa.me/54${phone}?text=${message}`, '_blank');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AdminLayout title="Leads">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Leads">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Leads">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="theme-bg-card rounded-xl border theme-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold theme-text-primary">{stats.total}</p>
                <p className="text-sm theme-text-muted">Total leads</p>
              </div>
            </div>
          </div>

          <div className="theme-bg-card rounded-xl border theme-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold theme-text-primary">{stats.pending}</p>
                <p className="text-sm theme-text-muted">Pendientes</p>
              </div>
            </div>
          </div>

          <div className="theme-bg-card rounded-xl border theme-border p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold theme-text-primary">{stats.contacted}</p>
                <p className="text-sm theme-text-muted">Contactados</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 theme-text-muted" />
          <span className="text-sm theme-text-secondary">Filtros:</span>
        </div>

        <select
          value={filterContacted}
          onChange={(e) => setFilterContacted(e.target.value as 'all' | 'yes' | 'no')}
          className="px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
        >
          <option value="all">Todos</option>
          <option value="no">Pendientes</option>
          <option value="yes">Contactados</option>
        </select>

        <select
          value={filterRubro}
          onChange={(e) => setFilterRubro(e.target.value)}
          className="px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
        >
          <option value="">Todos los rubros</option>
          {rubros.map((rubro) => (
            <option key={rubro.id} value={rubro.id}>
              {rubro.icono} {rubro.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* Leads Table */}
      {leads.length === 0 ? (
        <div className="text-center py-16 theme-bg-card rounded-xl border theme-border">
          <span className="text-5xl">📋</span>
          <p className="theme-text-primary font-medium mt-4">No hay leads</p>
          <p className="theme-text-muted text-sm mt-1">
            {filterContacted !== 'all' || filterRubro
              ? 'Probá cambiando los filtros'
              : 'Los leads aparecerán cuando la gente se registre en la waitlist'}
          </p>
        </div>
      ) : (
        <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Contacto
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Rubro
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Fecha
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
                {leads.map((lead) => (
                  <tr key={lead.id} className={lead.contacted ? 'opacity-60' : ''}>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium theme-text-primary">{lead.nombre}</p>
                        <p className="text-sm theme-text-muted flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lead.telefono}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 theme-text-secondary">
                      {lead.rubroNombre || lead.rubroId}
                    </td>
                    <td className="px-6 py-4 text-sm theme-text-muted">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lead.contacted
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.contacted ? 'Contactado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openWhatsApp(lead.telefono, lead.nombre)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleContacted(lead)}
                          disabled={updating === lead.id}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            lead.contacted
                              ? 'text-yellow-600 hover:bg-yellow-100'
                              : 'text-green-600 hover:bg-green-100'
                          }`}
                          title={lead.contacted ? 'Marcar como pendiente' : 'Marcar como contactado'}
                        >
                          {updating === lead.id ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : lead.contacted ? (
                            <Clock className="w-4 h-4" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(lead.id)}
                          disabled={deleting === lead.id}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Eliminar"
                        >
                          {deleting === lead.id ? (
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
    </AdminLayout>
  );
}
