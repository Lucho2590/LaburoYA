'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function SettingsPage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();
  const { setPageConfig } = usePageTitle();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    nickname: '',
  });

  // Set page config
  useEffect(() => {
    setPageConfig({ title: 'Mis datos', showBack: true, backHref: '/home' });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  // Cargar datos actuales
  useEffect(() => {
    if (userData) {
      setFormData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        age: userData.age?.toString() || '',
        nickname: userData.nickname || '',
      });
    }
  }, [userData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.error('Nombre y apellido son obligatorios');
      return;
    }

    setSaving(true);
    try {
      await api.updateBasicInfo({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        age: formData.age ? parseInt(formData.age) : undefined,
        nickname: formData.nickname.trim() || undefined,
      });

      await refreshUserData();
      setHasChanges(false);
      toast.success('Datos actualizados');
    } catch (error) {
      toast.error('Error al guardar');
      console.error(error);
    } finally {
      setSaving(false);
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
    <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5">
      {/* Email (solo lectura) */}
      <div>
        <label className="block text-sm font-medium theme-text-muted mb-2">
          Email
        </label>
        <div className="px-4 py-3 rounded-xl theme-bg-secondary theme-text-muted text-sm">
          {userData?.email || '-'}
        </div>
      </div>

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
          Apodo
        </label>
        <input
          type="text"
          name="nickname"
          value={formData.nickname}
          onChange={handleChange}
          placeholder="¿Cómo te gusta que te digan?"
          className="w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors"
        />
        <p className="text-xs theme-text-muted mt-1">
          Opcional - Si no lo completás, usaremos tu nombre
        </p>
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={saving || !hasChanges || !formData.firstName || !formData.lastName}
          className="w-full py-4 bg-[#E10600] text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:bg-[#c00500] transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
