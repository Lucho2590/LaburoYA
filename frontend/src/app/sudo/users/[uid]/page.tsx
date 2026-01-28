'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { AdminUserDetail, UserRole, WorkerProfile, EmployerProfile } from '@/types';

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const uid = params.uid as string;

  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await api.getAdminUser(uid);
        setUserDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar usuario');
      } finally {
        setLoading(false);
      }
    };

    if (uid) {
      fetchUser();
    }
  }, [uid]);

  const handleRoleChange = async (newRole: UserRole) => {
    if (!userDetail) return;
    setUpdating(true);
    try {
      await api.updateAdminUser(uid, { role: newRole });
      setUserDetail({
        ...userDetail,
        user: { ...userDetail.user, role: newRole }
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar rol');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!userDetail) return;
    setUpdating(true);
    try {
      await api.updateAdminUser(uid, { disabled: !userDetail.user.disabled });
      setUserDetail({
        ...userDetail,
        user: { ...userDetail.user, disabled: !userDetail.user.disabled }
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (hard: boolean) => {
    setUpdating(true);
    try {
      await api.deleteAdminUser(uid, hard);
      router.push('/sudo/users');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar usuario');
      setUpdating(false);
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isWorkerProfile = (profile: WorkerProfile | EmployerProfile | null): profile is WorkerProfile => {
    return profile !== null && 'puesto' in profile;
  };

  const isEmployerProfile = (profile: WorkerProfile | EmployerProfile | null): profile is EmployerProfile => {
    return profile !== null && 'businessName' in profile;
  };

  if (loading) {
    return (
      <AdminLayout title="Detalle de Usuario">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !userDetail) {
    return (
      <AdminLayout title="Detalle de Usuario">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">
          {error || 'Usuario no encontrado'}
        </div>
        <Link href="/sudo/users" className="text-[#E10600] hover:underline mt-4 inline-block">
          Volver a usuarios
        </Link>
      </AdminLayout>
    );
  }

  const { user, profile, stats } = userDetail;

  return (
    <AdminLayout title="Detalle de Usuario">
      {/* Back link */}
      <Link
        href="/sudo/users"
        className="inline-flex items-center gap-2 theme-text-secondary hover:theme-text-primary mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a usuarios
      </Link>

      {/* User Header */}
      <div className="theme-bg-card rounded-xl p-6 border theme-border mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E10600] to-[#FF6A00] flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="text-2xl font-bold theme-text-primary">
                {user.displayName || 'Sin nombre'}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.role === 'worker' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                user.role === 'employer' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {user.role === 'worker' ? 'Trabajador' : user.role === 'employer' ? 'Empleador' : 'Superuser'}
              </span>
              {user.disabled && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Deshabilitado
                </span>
              )}
            </div>
            <p className="theme-text-secondary">{user.email || 'Sin email'}</p>
            {user.phoneNumber && (
              <p className="theme-text-muted text-sm">Tel: {user.phoneNumber}</p>
            )}
          </div>

          {/* Quick Stats */}
          <div className="flex gap-4">
            <div className="text-center px-4 py-2 theme-bg-secondary rounded-lg">
              <p className="text-2xl font-bold theme-text-primary">{stats.matches}</p>
              <p className="text-xs theme-text-muted">Matches</p>
            </div>
            {user.role === 'employer' && (
              <div className="text-center px-4 py-2 theme-bg-secondary rounded-lg">
                <p className="text-2xl font-bold theme-text-primary">{stats.jobOffers}</p>
                <p className="text-xs theme-text-muted">Ofertas</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <h2 className="text-lg font-semibold theme-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Informacion de Cuenta
          </h2>

          <div className="space-y-3">
            <div>
              <label className="block text-xs theme-text-muted mb-1">UID</label>
              <p className="font-mono text-sm theme-text-primary bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded break-all">
                {user.uid}
              </p>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Email</label>
              <p className="theme-text-primary">{user.email || '-'}</p>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Nombre</label>
              <p className="theme-text-primary">{user.displayName || '-'}</p>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Telefono</label>
              <p className="theme-text-primary">{user.phoneNumber || '-'}</p>
            </div>
            <div>
              <label className="block text-xs theme-text-muted mb-1">Email verificado</label>
              <p className={user.emailVerified ? 'text-green-600' : 'text-yellow-600'}>
                {user.emailVerified ? 'Si' : 'No'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Creado</label>
                <p className="theme-text-secondary text-sm">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Actualizado</label>
                <p className="theme-text-secondary text-sm">{formatDate(user.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Card */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <h2 className="text-lg font-semibold theme-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Perfil de {user.role === 'worker' ? 'Trabajador' : user.role === 'employer' ? 'Empleador' : 'Usuario'}
          </h2>

          {!profile ? (
            <div className="text-center py-8">
              <svg className="w-12 h-12 mx-auto theme-text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="theme-text-muted">Sin perfil creado</p>
            </div>
          ) : isWorkerProfile(profile) ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Rubro</label>
                <p className="theme-text-primary font-medium">{profile.rubro}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Puesto</label>
                <p className="theme-text-primary font-medium">{profile.puesto}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Zona</label>
                <p className="theme-text-primary">{profile.zona || '-'}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Experiencia</label>
                <p className="theme-text-primary">{profile.experience || '-'}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Estado del perfil</label>
                <p className={profile.active ? 'text-green-600' : 'text-red-600'}>
                  {profile.active ? 'Activo (visible)' : 'Inactivo (oculto)'}
                </p>
              </div>
              {profile.description && (
                <div>
                  <label className="block text-xs theme-text-muted mb-1">Descripcion</label>
                  <p className="theme-text-primary text-sm">{profile.description}</p>
                </div>
              )}
              {profile.videoUrl && (
                <div>
                  <label className="block text-xs theme-text-muted mb-1">Video</label>
                  <a
                    href={profile.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#E10600] hover:underline text-sm inline-flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Ver video de presentacion
                  </a>
                </div>
              )}
            </div>
          ) : isEmployerProfile(profile) ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs theme-text-muted mb-1">Nombre del negocio</label>
                <p className="theme-text-primary font-medium">{profile.businessName}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Rubro</label>
                <p className="theme-text-primary">{profile.rubro}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Direccion</label>
                <p className="theme-text-primary">{profile.address || '-'}</p>
              </div>
              <div>
                <label className="block text-xs theme-text-muted mb-1">Telefono del negocio</label>
                <p className="theme-text-primary">{profile.phone || '-'}</p>
              </div>
              {profile.description && (
                <div>
                  <label className="block text-xs theme-text-muted mb-1">Descripcion</label>
                  <p className="theme-text-primary text-sm">{profile.description}</p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions Card */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <h2 className="text-lg font-semibold theme-text-primary mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Acciones
          </h2>

          <div className="space-y-4">
            {/* Change Role */}
            <div>
              <label className="block text-xs theme-text-muted mb-2">Cambiar rol</label>
              <select
                value={user.role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                disabled={updating || user.role === 'superuser'}
                className="w-full theme-bg-secondary border theme-border rounded-lg px-3 py-2 theme-text-primary disabled:opacity-50"
              >
                <option value="worker">Trabajador</option>
                <option value="employer">Empleador</option>
                <option value="superuser">Superuser</option>
              </select>
            </div>

            {/* Toggle Disabled */}
            <div>
              <label className="block text-xs theme-text-muted mb-2">Estado de cuenta</label>
              <button
                onClick={handleToggleDisabled}
                disabled={updating || user.role === 'superuser'}
                className={`w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  user.disabled
                    ? 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900 dark:text-yellow-200'
                }`}
              >
                {user.disabled ? 'Habilitar cuenta' : 'Deshabilitar cuenta'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {user.role !== 'superuser' && (
        <div className="mt-6 theme-bg-card rounded-xl p-6 border-2 border-red-300 dark:border-red-800">
          <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Zona de peligro
          </h2>

          {!showDeleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="theme-text-primary font-medium">Eliminar usuario</p>
                <p className="theme-text-secondary text-sm">Esta accion no se puede deshacer</p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="theme-text-secondary">
                Elige como eliminar este usuario:
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => handleDelete(false)}
                  disabled={updating}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50"
                >
                  Soft delete (deshabilitar)
                </button>
                <button
                  onClick={() => handleDelete(true)}
                  disabled={updating}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  Hard delete (eliminar todo)
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={updating}
                  className="px-4 py-2 theme-bg-secondary theme-text-primary rounded-lg hover:opacity-80 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-xs theme-text-muted">
                Soft delete: Deshabilita la cuenta pero mantiene los datos.
                Hard delete: Elimina permanentemente el usuario y todos sus datos.
              </p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
