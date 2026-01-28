'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { AdminUser, UserRole, WorkerProfile, EmployerProfile, JobOffer } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [total, setTotal] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const fetchUsers = async (role?: UserRole | '') => {
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

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      worker: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      employer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      superuser: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    };
    const labels = {
      worker: 'Trabajador',
      employer: 'Empleador',
      superuser: 'Superuser',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[role]}`}>
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

  const isWorkerProfile = (profile: WorkerProfile | EmployerProfile | null | undefined): profile is WorkerProfile => {
    return profile !== null && profile !== undefined && 'puesto' in profile;
  };

  const isEmployerProfile = (profile: WorkerProfile | EmployerProfile | null | undefined): profile is EmployerProfile => {
    return profile !== null && profile !== undefined && 'businessName' in profile;
  };

  const toggleExpand = (uid: string) => {
    setExpandedUser(expandedUser === uid ? null : uid);
  };

  return (
    <AdminLayout title="Usuarios">
      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="theme-text-secondary text-sm">Filtrar por rol:</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
            className="theme-bg-card border theme-border rounded-lg px-3 py-2 text-sm theme-text-primary"
          >
            <option value="">Todos</option>
            <option value="worker">Trabajadores</option>
            <option value="employer">Empleadores</option>
            <option value="superuser">Superusers</option>
          </select>
        </div>
        <span className="theme-text-muted text-sm">
          {total} usuario{total !== 1 ? 's' : ''}
        </span>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Users List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 theme-text-muted">
            No se encontraron usuarios
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.uid}
              className="theme-bg-card rounded-xl border theme-border overflow-hidden"
            >
              {/* User Header Row */}
              <div
                className="p-4 cursor-pointer hover:theme-bg-secondary transition-colors"
                onClick={() => toggleExpand(user.uid)}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#E10600] to-[#FF6A00] flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()
                    )}
                  </div>

                  {/* Main Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold theme-text-primary">
                        {user.displayName || 'Sin nombre'}
                      </span>
                      {getRoleBadge(user.role)}
                      {user.disabled && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          Deshabilitado
                        </span>
                      )}
                    </div>
                    <p className="text-sm theme-text-secondary truncate">
                      {user.email || 'Sin email'}
                    </p>
                    {user.phoneNumber && (
                      <p className="text-sm theme-text-muted">
                        Tel: {user.phoneNumber}
                      </p>
                    )}
                  </div>

                  {/* Profile Summary */}
                  <div className="hidden md:block text-right">
                    {isWorkerProfile(user.profile) && (
                      <div>
                        <p className="text-sm font-medium theme-text-primary">{user.profile.puesto}</p>
                        <p className="text-xs theme-text-secondary">{user.profile.rubro}</p>
                        {user.profile.zona && (
                          <p className="text-xs theme-text-muted">{user.profile.zona}</p>
                        )}
                      </div>
                    )}
                    {isEmployerProfile(user.profile) && (
                      <div>
                        <p className="text-sm font-medium theme-text-primary">{user.profile.businessName}</p>
                        <p className="text-xs theme-text-secondary">{user.profile.rubro}</p>
                        {user.jobOffers && user.jobOffers.length > 0 && (
                          <p className="text-xs theme-text-muted">{user.jobOffers.length} ofertas</p>
                        )}
                      </div>
                    )}
                    {!user.profile && (
                      <p className="text-sm theme-text-muted">Sin perfil</p>
                    )}
                  </div>

                  {/* Date and Expand Icon */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs theme-text-muted hidden sm:block">
                      {formatDate(user.createdAt)}
                    </span>
                    <svg
                      className={`w-5 h-5 theme-text-muted transition-transform ${expandedUser === user.uid ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedUser === user.uid && (
                <div className="border-t theme-border p-4 theme-bg-secondary">
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
                          <span className="theme-text-muted">UID:</span>
                          <span className="theme-text-primary font-mono text-xs">{user.uid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-muted">Email:</span>
                          <span className="theme-text-primary">{user.email || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-muted">Nombre:</span>
                          <span className="theme-text-primary">{user.displayName || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-muted">Telefono:</span>
                          <span className="theme-text-primary">{user.phoneNumber || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-muted">Email verificado:</span>
                          <span className={user.emailVerified ? 'text-green-600' : 'text-yellow-600'}>
                            {user.emailVerified ? 'Si' : 'No'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="theme-text-muted">Creado:</span>
                          <span className="theme-text-primary">{formatDate(user.createdAt)}</span>
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
                      ) : isWorkerProfile(user.profile) ? (
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
                            <span className="theme-text-muted">Experiencia:</span>
                            <span className="theme-text-primary">{user.profile.experience || '-'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="theme-text-muted">Activo:</span>
                            <span className={user.profile.active ? 'text-green-600' : 'text-red-600'}>
                              {user.profile.active ? 'Si' : 'No'}
                            </span>
                          </div>
                          {user.profile.description && (
                            <div className="pt-2">
                              <span className="theme-text-muted block mb-1">Descripcion:</span>
                              <p className="theme-text-primary text-xs">{user.profile.description}</p>
                            </div>
                          )}
                          {user.profile.videoUrl && (
                            <div className="pt-2">
                              <a
                                href={user.profile.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#E10600] hover:underline text-xs"
                              >
                                Ver video de presentacion
                              </a>
                            </div>
                          )}
                        </div>
                      ) : isEmployerProfile(user.profile) ? (
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
                          <div className="flex justify-between">
                            <span className="theme-text-muted">Telefono:</span>
                            <span className="theme-text-primary">{user.profile.phone || '-'}</span>
                          </div>
                          {user.profile.description && (
                            <div className="pt-2">
                              <span className="theme-text-muted block mb-1">Descripcion:</span>
                              <p className="theme-text-primary text-xs">{user.profile.description}</p>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {/* Job Offers (for employers) */}
                    {isEmployerProfile(user.profile) && (
                      <div>
                        <h4 className="font-semibold theme-text-primary mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Ofertas de Trabajo ({user.jobOffers?.length || 0})
                        </h4>
                        {!user.jobOffers || user.jobOffers.length === 0 ? (
                          <p className="text-sm theme-text-muted">Sin ofertas publicadas</p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {user.jobOffers.map((job: JobOffer) => (
                              <div
                                key={job.id}
                                className="p-2 theme-bg-card rounded-lg border theme-border text-sm"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium theme-text-primary">{job.puesto}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-xs ${job.active !== false ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                    {job.active !== false ? 'Activa' : 'Inactiva'}
                                  </span>
                                </div>
                                <p className="text-xs theme-text-secondary">{job.rubro}</p>
                                {job.salary && (
                                  <p className="text-xs theme-text-muted">Salario: {job.salary}</p>
                                )}
                                {job.schedule && (
                                  <p className="text-xs theme-text-muted">Horario: {job.schedule}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t theme-border flex justify-end">
                    <Link
                      href={`/sudo/users/${user.uid}`}
                      className="px-4 py-2 bg-[#E10600] text-white rounded-lg hover:bg-[#c10500] transition-colors text-sm font-medium"
                    >
                      Gestionar usuario
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
