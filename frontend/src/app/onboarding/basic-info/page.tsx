'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function BasicInfoPage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    nickname: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && !userData?.role) {
      router.push('/onboarding');
    }
  }, [loading, user, userData, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      await api.updateBasicInfo({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: formData.age ? parseInt(formData.age) : undefined,
        nickname: formData.nickname.trim() || undefined,
      });

      await refreshUserData();
      toast.success('¡Datos guardados!');
      router.push('/home');
    } catch (error) {
      toast.error('Error al guardar los datos');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-16 pb-8 text-center">
          <span className="text-5xl">📝</span>
          <h1 className="text-2xl font-bold theme-text-primary mt-4">Contanos sobre vos</h1>
          <p className="theme-text-secondary mt-2">Completá tus datos básicos</p>
        </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex-1 px-6 space-y-5">
        {/* Nombre */}
        <div>
          <label className="block text-sm font-medium theme-text-secondary mb-2">
            Nombre *
          </label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="Tu nombre"
            className="w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Apellido */}
        <div>
          <label className="block text-sm font-medium theme-text-secondary mb-2">
            Apellido *
          </label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Tu apellido"
            className="w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors"
            required
          />
        </div>

        {/* Edad */}
        <div>
          <label className="block text-sm font-medium theme-text-secondary mb-2">
            Edad
          </label>
          <input
            type="number"
            name="age"
            value={formData.age}
            onChange={handleChange}
            placeholder="Tu edad"
            min="16"
            max="99"
            className="w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors"
          />
        </div>

        {/* Sobrenombre */}
        <div>
          <label className="block text-sm font-medium theme-text-secondary mb-2">
            ¿Cómo te gusta que te digan?
          </label>
          <input
            type="text"
            name="nickname"
            value={formData.nickname}
            onChange={handleChange}
            placeholder="Tu sobrenombre o apodo"
            className="w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors"
          />
          <p className="text-xs theme-text-muted mt-1">
            Opcional - Si no lo completás, usaremos tu nombre
          </p>
        </div>

        {/* Submit Button */}
        <div className="pt-4 pb-8">
          <button
            type="submit"
            disabled={submitting || !formData.firstName || !formData.lastName}
            className="w-full py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                Guardando...
              </span>
            ) : (
              'Continuar'
            )}
          </button>
        </div>
      </form>
      </div>
    </AuthLayout>
  );
}
