'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useWorkerProfileForm } from '@/hooks/useWorkerProfileForm';
import { RubroPuestoPicker } from '@/components/worker-profile/RubroPuestoPicker';
import { SkillsPicker } from '@/components/worker-profile/SkillsPicker';
import { LocationFields } from '@/components/worker-profile/LocationFields';
import { PhotoField, VideoField, AboutFields } from '@/components/worker-profile/MediaFields';
import { api } from '@/services/api';
import { toast } from 'sonner';

const STEPS = [
  { title: '¿A qué te dedicás?', subtitle: 'Es lo que usamos para acercarte búsquedas.' },
  { title: 'Tus habilidades', subtitle: 'Cuantas más marques, en más búsquedas aparecés.' },
  { title: '¿Dónde querés trabajar?', subtitle: 'Para mostrarte primero lo que te queda cerca.' },
  { title: 'Contanos de vos', subtitle: 'Un par de líneas alcanzan.' },
  { title: 'Tu foto', subtitle: 'Los empleadores quieren ver con quién van a trabajar.' },
  { title: 'Tu video', subtitle: 'Es lo que más te diferencia del resto.' },
] as const;

/**
 * Onboarding del perfil laboral. Antes esto vivía sólo en /worker/profile, una
 * pantalla suelta a la que se llegaba por un banner: el worker terminaba el
 * registro con nombre y apellido, quedaba con el perfil vacío y ningún
 * empleador lo encontraba nunca.
 *
 * Comparte estado y guardado con /worker/profile vía useWorkerProfileForm, así
 * que los dos formularios no pueden divergir.
 */
export default function ProfileOnboardingPage() {
  const router = useRouter();
  const { user, loading, getEffectiveAppRole, refreshUserData } = useAuth();
  const form = useWorkerProfileForm();

  const [step, setStep] = useState(0);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const effectiveRole = getEffectiveAppRole();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    // Un empleador que caiga acá por un link viejo no tiene nada que hacer.
    if (effectiveRole && effectiveRole !== 'worker') {
      router.push('/home');
    }
  }, [loading, user, effectiveRole, router]);

  // Salir del wizard: guarda lo cargado (si ya hay rubro y puesto) y deja
  // marcado que la persona ya pasó por acá, para no volver a interrumpirla.
  const leave = async (mode: 'done' | 'skip') => {
    setLeaving(true);
    try {
      if (form.canSave) {
        await form.save();
        if (mode === 'done') toast.success('¡Perfil listo!');
      }
      await api.markProfileWizardSeen();
      // Sin este refresh, userData sigue sin profileWizardSeenAt y el guard de
      // /home lo rebota de vuelta acá: loop infinito para quien saltea sin
      // haber cargado rubro y puesto.
      await refreshUserData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el perfil');
      setLeaving(false);
      return;
    }
    // /home se encarga de llevar a la oferta compartida, si vino por un link.
    router.replace('/home');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]" />
      </div>
    );
  }

  const isLast = step === STEPS.length - 1;
  // Rubro y puesto son lo único que el backend exige: sin eso no se puede
  // avanzar, pero sí saltear todo el wizard.
  const canAdvance = step > 0 || form.canSave;

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        <div className="px-6 pt-10 pb-4">
          <div className="flex items-center justify-between text-xs theme-text-muted mb-2">
            <span>Paso {step + 1} de {STEPS.length}</span>
            <span>{form.completion.percentage}% del perfil</span>
          </div>
          <div className="h-1.5 w-full rounded-full theme-bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] transition-all"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          <h1 className="text-2xl font-bold theme-text-primary mt-6">{STEPS[step].title}</h1>
          <p className="theme-text-secondary mt-1 text-sm">{STEPS[step].subtitle}</p>
        </div>

        <div className="flex-1 px-6 pb-4 space-y-6">
          {step === 0 && (
            <RubroPuestoPicker
              rubro={form.formData.rubro}
              puesto={form.formData.puesto}
              availablePuestos={form.availablePuestos}
              onRubroChange={form.setRubro}
              onPuestoChange={form.setPuesto}
            />
          )}

          {step === 1 && (
            <SkillsPicker
              rubro={form.formData.rubro}
              puesto={form.formData.puesto}
              selected={form.selectedSkills}
              onToggle={form.toggleSkill}
            />
          )}

          {step === 2 && (
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
              collapsibleDetails
            />
          )}

          {step === 3 && (
            <AboutFields
              experience={form.formData.experience}
              description={form.formData.description}
              onExperienceChange={(v) => form.setField('experience', v)}
              onDescriptionChange={(v) => form.setField('description', v)}
            />
          )}

          {step === 4 && (
            <PhotoField
              photoUrl={form.photoUrl}
              photoBlob={form.photoBlob}
              onCaptured={(blob) => { form.setPhotoBlob(blob); form.setPhotoUrl(''); }}
              onDeleted={() => { form.setPhotoBlob(null); form.setPhotoUrl(''); }}
              onRetake={() => form.setPhotoBlob(null)}
            />
          )}

          {step === 5 && (
            <VideoField
              videoUrl={form.videoUrl}
              videoBlob={form.videoBlob}
              onRecorded={(blob) => { form.setVideoBlob(blob); form.setVideoUrl(''); }}
              onDeleted={() => { form.setVideoBlob(null); form.setVideoUrl(''); }}
              onRetake={() => form.setVideoBlob(null)}
            />
          )}
        </div>

        <div className="px-6 pb-8 pt-2 space-y-3">
          <div className="flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={leaving || form.saving}
                className="px-5 py-4 rounded-xl border theme-border theme-text-secondary font-medium disabled:opacity-50 cursor-pointer"
              >
                Atrás
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? leave('done') : setStep((s) => s + 1))}
              disabled={!canAdvance || leaving || form.saving}
              className="flex-1 py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform cursor-pointer"
            >
              {leaving || form.saving ? 'Guardando...' : isLast ? 'Terminar' : 'Continuar'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setConfirmSkip(true)}
            disabled={leaving || form.saving}
            className="w-full py-2 text-sm theme-text-muted disabled:opacity-50 cursor-pointer"
          >
            Omitir por ahora
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSkip}
        variant="default"
        title="¿Seguro que querés omitirlo?"
        description={
          form.canSave
            ? 'Guardamos lo que cargaste hasta acá. Podés completar el resto cuando quieras desde tu perfil.'
            : 'Sin rubro ni puesto los empleadores no te van a encontrar y no vas a recibir búsquedas. Podés cargarlo después desde tu perfil.'
        }
        confirmLabel="Omitir"
        cancelLabel="Seguir cargando"
        loading={leaving}
        onConfirm={() => leave('skip')}
        onCancel={() => setConfirmSkip(false)}
      />
    </AuthLayout>
  );
}
