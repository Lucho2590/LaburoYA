'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Mail, Send } from 'lucide-react';

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    role: 'worker' as 'worker' | 'employer',
    plan: 'premium' as 'free' | 'premium',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error('Email es requerido');
      return;
    }

    setLoading(true);
    try {
      await api.createAdminUser(formData);
      toast.success('Usuario creado y email de invitación enviado');
      router.push('/sudo/users');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Crear Usuario">
      {/* Back link */}
      <Link
        href="/sudo/users"
        className="inline-flex items-center gap-2 theme-text-secondary hover:theme-text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a usuarios
      </Link>

      <div className="max-w-xl">
        {/* Header */}
        <div className="theme-bg-card rounded-xl p-6 border theme-border mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold theme-text-primary">Crear nuevo usuario</h1>
              <p className="text-sm theme-text-secondary">
                El usuario recibirá un email para activar su cuenta
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="theme-bg-card rounded-xl p-6 border theme-border">
          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                Email *
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-text-muted" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="usuario@ejemplo.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                />
              </div>
            </div>

            {/* Nombre y Apellido */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">
                  Nombre
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Juan"
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">
                  Apellido
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Pérez"
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                />
              </div>
            </div>

            {/* Rol */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                Rol *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
              >
                <option value="worker">Trabajador</option>
                <option value="employer">Empleador</option>
              </select>
              <p className="text-xs theme-text-muted mt-1">
                {formData.role === 'worker'
                  ? 'Podrá buscar ofertas de trabajo y postularse'
                  : 'Podrá publicar ofertas y buscar trabajadores'}
              </p>
            </div>

            {/* Plan */}
            <div>
              <label className="block text-sm font-medium theme-text-primary mb-2">
                Plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.plan === 'free'
                      ? 'border-[#E10600] bg-[#E10600]/5'
                      : 'theme-border hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="free"
                    checked={formData.plan === 'free'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <p className="font-medium theme-text-primary">Free</p>
                    <p className="text-xs theme-text-muted">Acceso básico</p>
                  </div>
                </label>
                <label
                  className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.plan === 'premium'
                      ? 'border-[#E10600] bg-[#E10600]/5'
                      : 'theme-border hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="premium"
                    checked={formData.plan === 'premium'}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <p className="font-medium theme-text-primary">Premium</p>
                    <p className="text-xs theme-text-muted">Acceso completo</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>¿Qué pasa al crear el usuario?</strong>
            </p>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
              <li>• Se crea la cuenta con el email indicado</li>
              <li>• Se envía un email de invitación</li>
              <li>• El usuario establece su contraseña</li>
              <li>• Completa su perfil en el onboarding</li>
            </ul>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !formData.email}
            className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Creando usuario...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Crear y enviar invitación
              </>
            )}
          </button>
        </form>
      </div>
    </AdminLayout>
  );
}
