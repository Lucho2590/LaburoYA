'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES } from '@/config/constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { CameraCapture } from '@/components/CameraCapture';
import { toast } from 'sonner';
import { IEmployerProfile } from '@/types';

export default function EmployerProfilePage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData, getEffectiveAppRole } = useAuth();
  const { setPageConfig } = usePageTitle();

  const [formData, setFormData] = useState({
    businessName: '',
    rubro: '',
    localidad: '',
    description: '',
    address: '',
    phone: '',
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveRole = getEffectiveAppRole();

  // Set page config
  useEffect(() => {
    setPageConfig({ title: 'Mi Negocio', showBack: true, backHref: '/home' });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Allow employers OR superusers with employer secondaryRole
    if (!loading && effectiveRole !== 'employer') {
      router.push('/home');
    }
  }, [loading, user, effectiveRole, router]);

  useEffect(() => {
    if (userData?.profile) {
      const profile = userData.profile as IEmployerProfile;
      setFormData({
        businessName: profile.businessName || '',
        rubro: profile.rubro || '',
        localidad: profile.localidad || '',
        description: profile.description || '',
        address: profile.address || '',
        phone: profile.phone || '',
      });
      setPhotoUrl(profile.photoUrl || '');
    }
  }, [userData]);

  const handlePhotoCaptured = (blob: Blob) => {
    setPhotoBlob(blob);
    setPhotoUrl('');
    toast.success('Foto tomada correctamente');
  };

  const handlePhotoDeleted = () => {
    setPhotoBlob(null);
    setPhotoUrl('');
    toast.success('Foto eliminada');
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoBlob || !user || !storage) return null;

    try {
      const fileName = `photos/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, photoBlob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw new Error('Error al subir la foto');
    }
  };

  const handleSubmit = async () => {
    if (!formData.businessName || !formData.rubro) {
      toast.error('Completá nombre y rubro');
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;

      if (photoBlob) {
        toast.loading('Subiendo foto...', { id: 'upload-photo' });
        const uploadedPhotoUrl = await uploadPhoto();
        if (uploadedPhotoUrl) {
          finalPhotoUrl = uploadedPhotoUrl;
        }
        toast.dismiss('upload-photo');
      }

      await api.createEmployerProfile({
        ...formData,
        photoUrl: finalPhotoUrl,
      });
      await refreshUserData();
      toast.success('Perfil guardado');
      router.push('/home');
    } catch (error) {
      toast.dismiss('upload-photo');
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
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
    <div className="px-4 py-6 space-y-6">
      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Foto del negocio o logo
        </label>
        <p className="text-[#667085] text-sm mb-3">
          Mostrá tu negocio a los trabajadores. Genera más confianza.
        </p>

        {photoBlob ? (
          <div className="space-y-3">
            <div className="relative w-32 h-32 mx-auto">
              <img
                src={URL.createObjectURL(photoBlob)}
                alt="Foto del negocio"
                className="w-full h-full rounded-full object-cover border-4 border-[#12B76A]"
              />
            </div>
            <div className="bg-[#12B76A]/20 text-[#12B76A] p-3 rounded-xl flex items-center justify-center">
              <span className="mr-2">✓</span>
              <span>Foto lista para subir</span>
            </div>
            <button
              type="button"
              onClick={() => setPhotoBlob(null)}
              className="w-full p-3 rounded-xl border-2 border-[#344054] text-[#98A2B3]"
            >
              📷 Tomar otra foto
            </button>
          </div>
        ) : (
          <CameraCapture
            onPhotoCaptured={handlePhotoCaptured}
            onPhotoDeleted={handlePhotoDeleted}
            existingPhotoUrl={photoUrl}
          />
        )}
      </div>

      {/* Business Name */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Nombre del negocio *
        </label>
        <input
          type="text"
          value={formData.businessName}
          onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
          placeholder="Ej: Restaurante El Puerto"
          className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Rubro */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Rubro *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData({ ...formData, rubro: key })}
              className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${
                formData.rubro === key
                  ? 'border-[#E10600] bg-[#E10600]/10'
                  : 'border-[#344054] bg-[#1F2937]'
              }`}
            >
              <span className="text-2xl block mb-1">
                {key === 'gastronomia' && '🍳'}
                {key === 'comercio' && '🏪'}
                {key === 'construccion' && '🏗️'}
                {key === 'limpieza' && '🧹'}
                {key === 'transporte' && '🚗'}
                {key === 'administracion' && '💼'}
              </span>
              <span className="font-medium text-white">{value.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Localidad */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Localidad
        </label>
        <input
          type="text"
          value={formData.localidad}
          onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
          placeholder="Ej: Mar del Plata, Batán, etc."
          className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Phone */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Teléfono de contacto
        </label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          placeholder="223-4567890"
          className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Address */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Dirección
        </label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Av. Colón 1234, Mar del Plata"
          className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Sobre el negocio
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Contá sobre tu negocio..."
          rows={3}
          className="w-full p-4 rounded-xl border-2 border-[#344054] bg-[#1F2937] text-white placeholder-[#667085] focus:border-[#E10600] focus:outline-none resize-none"
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !formData.businessName || !formData.rubro}
        className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {saving ? 'Guardando...' : 'Guardar perfil'}
      </button>
    </div>
  );
}
