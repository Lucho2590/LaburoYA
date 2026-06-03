'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Mail, Send } from 'lucide-react';

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'worker' | 'employer';
  plan: 'free' | 'premium';
  rubro: string;
  puesto: string;
  zona: string;
  description: string;
  experience: string;
  skills: string;
}

const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'worker',
  plan: 'premium',
  rubro: '',
  puesto: '',
  zona: '',
  description: '',
  experience: '',
  skills: '',
};

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error('Email es requerido');
      return;
    }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.createAdminUser>[0] = {
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        phone: formData.phone || undefined,
        role: formData.role,
        plan: formData.plan,
      };

      if (formData.role === 'worker' && formData.rubro && formData.puesto) {
        payload.workerProfile = {
          rubro: formData.rubro,
          puesto: formData.puesto,
          zona: formData.zona || null,
          description: formData.description || null,
          experience: formData.experience || null,
          skills: formData.skills
            ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        };
      }

      const result = await api.createAdminUser(payload);
      toast.success(
        result.workerProfileCreated
          ? 'Usuario y perfil de trabajador creados. Email de invitación enviado.'
          : 'Usuario creado y email de invitación enviado'
      );
      router.push('/sudo/users');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const isWorker = formData.role === 'worker';

  return (
    <AdminLayout title="Crear Usuario">
      <Link
        href="/sudo/users"
        className="inline-flex items-center gap-2 theme-text-secondary hover:theme-text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a usuarios
      </Link>

      <div className="max-w-2xl mx-auto space-y-6">
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-xl flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold theme-text-primary">Crear nuevo usuario</h1>
              <p className="text-sm theme-text-secondary">
                Completá los datos para crear el usuario y enviar la invitación.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="theme-bg-card rounded-xl p-6 border theme-border">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Email *</label>
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium theme-text-primary mb-2">Nombre</label>
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
                  <label className="block text-sm font-medium theme-text-primary mb-2">Apellido</label>
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

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Teléfono</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 9 223 1234567"
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Rol *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none cursor-pointer"
                >
                  <option value="worker">Trabajador</option>
                  <option value="employer">Empleador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.plan === 'free'
                        ? 'border-[#E10600] bg-[#E10600]/5'
                        : 'theme-border hover:border-gray-400'
                    }`}
                  >
                    <input type="radio" name="plan" value="free" checked={formData.plan === 'free'} onChange={handleChange} className="sr-only" />
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
                    <input type="radio" name="plan" value="premium" checked={formData.plan === 'premium'} onChange={handleChange} className="sr-only" />
                    <div className="text-center">
                      <p className="font-medium theme-text-primary">Premium</p>
                      <p className="text-xs theme-text-muted">Acceso completo</p>
                    </div>
                  </label>
                </div>
              </div>

              {isWorker && (
                <>
                  <div className="border-t theme-border pt-5">
                    <h3 className="text-sm font-semibold theme-text-primary mb-3">
                      Perfil de trabajador (opcional, completá si querés crear el perfil ya)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium theme-text-primary mb-2">Rubro</label>
                        <input
                          type="text"
                          name="rubro"
                          value={formData.rubro}
                          onChange={handleChange}
                          placeholder="Gastronomía"
                          className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium theme-text-primary mb-2">Puesto</label>
                        <input
                          type="text"
                          name="puesto"
                          value={formData.puesto}
                          onChange={handleChange}
                          placeholder="Mozo"
                          className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Zona / Barrio</label>
                    <input
                      type="text"
                      name="zona"
                      value={formData.zona}
                      onChange={handleChange}
                      placeholder="Centro, Mar del Plata"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Descripción</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Resumen breve del candidato"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Experiencia</label>
                    <textarea
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Experiencia laboral previa"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">
                      Skills <span className="text-xs theme-text-muted">(separadas por coma)</span>
                    </label>
                    <input
                      type="text"
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                      placeholder="atención al cliente, manejo de caja, trabajo en equipo"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !formData.email}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"
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
