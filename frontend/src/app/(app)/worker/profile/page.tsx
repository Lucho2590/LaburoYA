'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useWorkerProfileForm } from '@/hooks/useWorkerProfileForm';
import { RubroPuestoPicker } from '@/components/worker-profile/RubroPuestoPicker';
import { SkillsPicker } from '@/components/worker-profile/SkillsPicker';
import { LocationFields } from '@/components/worker-profile/LocationFields';
import { PhotoField, VideoField, AboutFields } from '@/components/worker-profile/MediaFields';
import { toast } from 'sonner';

export default function WorkerProfilePage() {
  const router = useRouter();
  const { user, loading, getEffectiveAppRole } = useAuth();
  const { setPageConfig } = usePageTitle();
  const form = useWorkerProfileForm();

  const effectiveRole = getEffectiveAppRole();

  useEffect(() => {
    setPageConfig({ title: 'Mi Perfil', showBack: true, backHref: '/home' });
  }, [setPageConfig]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    // Allow workers OR superusers with worker secondaryRole
    if (!loading && effectiveRole !== 'worker') {
      router.push('/home');
    }
  }, [loading, user, effectiveRole, router]);

  const handleSubmit = async () => {
    if (!form.canSave) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }
    try {
      await form.save();
      toast.success('Perfil guardado');
      router.push('/home');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const { completion } = form;

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Profile Completion */}
      <div className="theme-bg-card border theme-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium theme-text-primary">Perfil completado</span>
          <span
            className={`text-sm font-bold ${
              completion.percentage === 100 ? 'text-[#12B76A]' : 'text-[#E10600]'
            }`}
          >
            {completion.percentage}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full theme-bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] transition-all"
            style={{ width: `${completion.percentage}%` }}
          />
        </div>
        {completion.missing.length > 0 && (
          <p className="text-xs theme-text-muted mt-2">
            Te falta: {completion.missing.join(', ')}
          </p>
        )}
      </div>

      <PhotoField
        photoUrl={form.photoUrl}
        photoBlob={form.photoBlob}
        onCaptured={(blob) => {
          form.setPhotoBlob(blob);
          form.setPhotoUrl('');
          toast.success('Foto tomada correctamente');
        }}
        onDeleted={() => {
          form.setPhotoBlob(null);
          form.setPhotoUrl('');
          toast.success('Foto eliminada');
        }}
        onRetake={() => form.setPhotoBlob(null)}
      />

      <RubroPuestoPicker
        rubro={form.formData.rubro}
        puesto={form.formData.puesto}
        availablePuestos={form.availablePuestos}
        onRubroChange={form.setRubro}
        onPuestoChange={form.setPuesto}
      />

      <SkillsPicker
        rubro={form.formData.rubro}
        puesto={form.formData.puesto}
        selected={form.selectedSkills}
        onToggle={form.toggleSkill}
      />

      <LocationFields
        cities={form.cities}
        cityName={form.cityName}
        onCityChange={form.setCityName}
        selectedCity={form.selectedCity}
        zona={form.formData.zona}
        zonaOptions={form.zonaOptions}
        onZonaChange={(v) => form.setField('zona', v)}
        location={form.location}
        onLocationChange={form.setLocation}
        locationCovered={form.locationCovered}
        localidad={form.formData.localidad}
        onLocalidadChange={(v) => form.setField('localidad', v)}
      />

      <AboutFields
        experience={form.formData.experience}
        description={form.formData.description}
        onExperienceChange={(v) => form.setField('experience', v)}
        onDescriptionChange={(v) => form.setField('description', v)}
      />

      <VideoField
        videoUrl={form.videoUrl}
        videoBlob={form.videoBlob}
        onRecorded={(blob) => {
          form.setVideoBlob(blob);
          form.setVideoUrl('');
          toast.success('Video grabado correctamente');
        }}
        onDeleted={() => {
          form.setVideoBlob(null);
          form.setVideoUrl('');
          toast.success('Video eliminado');
        }}
        onRetake={() => form.setVideoBlob(null)}
      />

      <button
        onClick={handleSubmit}
        disabled={form.saving || !form.canSave}
        className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
      >
        {form.saving ? 'Guardando...' : 'Guardar perfil'}
      </button>
    </div>
  );
}
