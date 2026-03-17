'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IAdminUser, EUserRole, IWorkerProfile, IEmployerProfile, IJobOffer } from '@/types';
import { Users, Filter, ChevronDown, ChevronUp, ExternalLink, UserPlus } from 'lucide-react';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<IAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState<EUserRole | ''>('');
  const [total, setTotal] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchUsers = async (role?: EUserRole | '') => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers(role ? { role } : undefined);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(roleFilter);
  }, [roleFilter]);

  const getRoleBadge = (role: EUserRole) => {
    const styles = {
      worker: 'bg-blue-100 text-blue-800',
      employer: 'bg-green-100 text-green-800',
      superuser: 'bg-red-100 text-red-800',
    };
    const labels = {
      worker: 'Trabajador',
      employer: 'Empleador',
      superuser: 'Superuser',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const isIWorkerProfile = (profile: IWorkerProfile | IEmployerProfile | null | undefined): profile is IWorkerProfile => {
    return profile !== null && profile !== undefined && 'puesto' in profile;
  };

  const isIEmployerProfile = (profile: IWorkerProfile | IEmployerProfile | null | undefined): profile is IEmployerProfile => {
    return profile !== null && profile !== undefined && 'businessName' in profile;
  };

  const toggleExpand = (uid: string) => {
    setExpandedUser(expandedUser === uid ? null : uid);
  };

  const getProfileSummary = (user: IAdminUser) => {
    if (isIWorkerProfile(user.profile)) {
      return user.profile.puesto || user.profile.rubro || '-';
    }
    if (isIEmployerProfile(user.profile)) {
      return user.profile.businessName || '-';
    }
    return 'Sin perfil';
  };

  // Stats
  const stats = {
    total: total,
    workers: users.filter(u => u.role === 'worker').length,
    employers: users.filter(u => u.role === 'employer').length,
  };

  if (loading && users.length === 0) {
    return (
      <AdminLayout title="Usuarios">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Usuarios">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Usuarios">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{stats.total}</p>
              <p className="text-sm theme-text-muted">Total usuarios</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{stats.workers}</p>
              <p className="text-sm theme-text-muted">Trabajadores</p>
            </div>
          </div>
        </div>

        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold theme-text-primary">{stats.employers}</p>
              <p className="text-sm theme-text-muted">Empleadores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 theme-text-muted" />
            <span className="text-sm theme-text-secondary">Filtros:</span>
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as EUserRole | '')}
            className="px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
          >
            <option value="">Todos los roles</option>
            <option value="worker">Trabajadores</option>
            <option value="employer">Empleadores</option>
            <option value="superuser">Superusers</option>
          </select>
        </div>

        <Link
          href="/sudo/users/new"
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          <UserPlus className="w-4 h-4" />
          Crear usuario
        </Link>
      </div>

      {/* Users Table */}
      {users.length === 0 ? (
        <div className="text-center py-16 theme-bg-card rounded-xl border theme-border">
          <span className="text-5xl">👥</span>
          <p className="theme-text-primary font-medium mt-4">No hay usuarios</p>
          <p className="theme-text-muted text-sm mt-1">
            {roleFilter
              ? 'Proba cambiando los filtros'
              : 'Los usuarios apareceran cuando se registren'}
          </p>
        </div>
      ) : (
        <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
          <div className="overflow-auto max-h-[calc(100vh-320px)]">
            <table className="w-full">
              <thead className="theme-bg-secondary sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Rol
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider hidden md:table-cell">
                    Perfil
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider hidden sm:table-cell">
                    Fecha
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-medium theme-text-secondary uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {users.map((user) => (
                  <React.Fragment key={user.uid}>
                    <tr
                      className={`${user.disabled ? 'opacity-60' : ''} hover:theme-bg-secondary cursor-pointer transition-colors`}
                      onClick={() => toggleExpand(user.uid)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E10600] to-[#FF6A00] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                            {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-medium theme-text-primary">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.displayName || 'Sin nombre'}
                              {user.nickname && (
                                <span className="text-sm font-normal theme-text-muted ml-1">
                                  ({user.nickname})
                                </span>
                              )}
                            </p>
                            <p className="text-sm theme-text-muted truncate max-w-[200px]">
                              {user.email || 'Sin email'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {getRoleBadge(user.role)}
                          {user.disabled && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Deshabilitado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 theme-text-secondary hidden md:table-cell">
                        {getProfileSummary(user)}
                      </td>
                      <td className="px-6 py-4 text-sm theme-text-muted hidden sm:table-cell">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/sudo/users/${user.uid}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-[#E10600] hover:bg-[#E10600]/10 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          <button
                            className="p-2 theme-text-muted hover:theme-bg-card rounded-lg transition-colors"
                            title={expandedUser === user.uid ? 'Contraer' : 'Expandir'}
                          >
                            {expandedUser === user.uid ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Details Row */}
                    {expandedUser === user.uid && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 theme-bg-secondary">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* User Info */}
                            <div>
                              <h4 className="font-semibold theme-text-primary mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Datos de Usuario
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="theme-text-muted">Nombre:</span>
                                  <span className="theme-text-primary">
                                    {user.firstName && user.lastName
                                      ? `${user.firstName} ${user.lastName}`
                                      : user.displayName || '-'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="theme-text-muted">Teléfono:</span>
                                  <span className="theme-text-primary">{user.phone || user.phoneNumber || '-'}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="theme-text-muted">Verificado:</span>
                                  <span className={user.emailVerified ? 'text-green-600' : 'text-yellow-600'}>
                                    {user.emailVerified ? 'Sí' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Profile Info */}
                            <div>
                              <h4 className="font-semibold theme-text-primary mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Perfil
                              </h4>
                              {!user.profile ? (
                                <p className="text-sm theme-text-muted">Sin perfil creado</p>
                              ) : isIWorkerProfile(user.profile) ? (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Rubro:</span>
                                    <span className="theme-text-primary">{user.profile.rubro}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Puesto:</span>
                                    <span className="theme-text-primary">{user.profile.puesto}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Zona:</span>
                                    <span className="theme-text-primary">{user.profile.zona || '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Activo:</span>
                                    <span className={user.profile.active ? 'text-green-600' : 'text-red-600'}>
                                      {user.profile.active ? 'Si' : 'No'}
                                    </span>
                                  </div>
                                </div>
                              ) : isIEmployerProfile(user.profile) ? (
                                <div className="space-y-2 text-sm">
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Negocio:</span>
                                    <span className="theme-text-primary">{user.profile.businessName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Rubro:</span>
                                    <span className="theme-text-primary">{user.profile.rubro}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="theme-text-muted">Direccion:</span>
                                    <span className="theme-text-primary">{user.profile.address || '-'}</span>
                                  </div>
                                </div>
                              ) : null}
                            </div>

                            {/* Job Offers (for employers) */}
                            {isIEmployerProfile(user.profile) && (
                              <div>
                                <h4 className="font-semibold theme-text-primary mb-3 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  Ofertas ({user.jobOffers?.length || 0})
                                </h4>
                                {!user.jobOffers || user.jobOffers.length === 0 ? (
                                  <p className="text-sm theme-text-muted">Sin ofertas publicadas</p>
                                ) : (
                                  <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {user.jobOffers.map((job: IJobOffer) => (
                                      <div
                                        key={job.id}
                                        className="p-2 theme-bg-card rounded-lg border theme-border text-sm"
                                      >
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium theme-text-primary">{job.puesto}</span>
                                          <span className={`px-1.5 py-0.5 rounded text-xs ${job.active !== false ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                            {job.active !== false ? 'Activa' : 'Inactiva'}
                                          </span>
                                        </div>
                                        <p className="text-xs theme-text-secondary">{job.rubro}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
