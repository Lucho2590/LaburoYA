'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, ZONAS_MDP, TRubro, getSuggestedSkills } from '@/config/constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { VideoRecorder } from '@/components/VideoRecorder';
import { CameraCapture } from '@/components/CameraCapture';
import { toast } from 'sonner';
import { IWorkerProfile } from '@/types';
import { Check, Plus } from 'lucide-react';

export default function WorkerProfilePage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData, getEffectiveAppRole } = useAuth();
  const { setPageConfig } = usePageTitle();

  const [formData, setFormData] = useState({
    rubro: '',
    puesto: '',
    zona: '',
    localidad: '',
    description: '',
    experience: '',
  });
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  const effectiveRole = getEffectiveAppRole();

  // Set page config
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

  useEffect(() => {
    if (userData?.profile) {
      const profile = userData.profile as IWorkerProfile;
      setFormData({
        rubro: profile.rubro || '',
        puesto: profile.puesto || '',
        zona: profile.zona || '',
        localidad: profile.localidad || '',
        description: profile.description || '',
        experience: profile.experience || '',
      });
      setSelectedSkills(profile.skills || []);
      setPhotoUrl(profile.photoUrl || '');
      setVideoUrl(profile.videoUrl || '');
    }
  }, [userData]);

  const availablePuestos = formData.rubro
    ? JOB_CATEGORIES[formData.rubro as TRubro]?.puestos || []
    : [];

  // Calculate profile completion percentage
  const calculateProfileCompletion = (): { percentage: number; completed: string[]; missing: string[] } => {
    const fields = [
      { key: 'rubro', label: 'Rubro', value: formData.rubro, required: true },
      { key: 'puesto', label: 'Puesto', value: formData.puesto, required: true },
      { key: 'zona', label: 'Zona de trabajo', value: formData.zona, required: false },
      { key: 'localidad', label: 'Localidad', value: formData.localidad, required: false },
      { key: 'experience', label: 'Experiencia', value: formData.experience, required: false },
      { key: 'description', label: 'Descripción', value: formData.description, required: false },
      { key: 'skills', label: 'Habilidades', value: selectedSkills.length > 0, required: false },
      { key: 'photo', label: 'Foto', value: photoUrl || photoBlob, required: false },
      { key: 'video', label: 'Video', value: videoUrl || videoBlob, required: false },
    ];

    const completed: string[] = [];
    const missing: string[] = [];

    fields.forEach(field => {
      if (field.value) {
        completed.push(field.label);
      } else {
        missing.push(field.label);
      }
    });

    const percentage = Math.round((completed.length / fields.length) * 100);
    return { percentage, completed, missing };
  };

  const profileCompletion = calculateProfileCompletion();

  const handlePhotoCaptured = (blob: Blob) => {
    setPhotoBlob(blob);
    // Clear existing photo URL since we have a new capture
    setPhotoUrl('');
    toast.success('Foto tomada correctamente');
  };

  const handlePhotoDeleted = () => {
    setPhotoBlob(null);
    setPhotoUrl('');
    toast.success('Foto eliminada');
  };

  const handleVideoRecorded = (blob: Blob) => {
    setVideoBlob(blob);
    // Clear existing video URL since we have a new recording
    setVideoUrl('');
    toast.success('Video grabado correctamente');
  };

  const handleVideoDeleted = () => {
    setVideoBlob(null);
    setVideoUrl('');
    toast.success('Video eliminado');
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

  const uploadVideo = async (): Promise<string | null> => {
    if (!videoBlob || !user || !storage) return null;

    try {
      const fileName = `videos/${user.uid}/${Date.now()}.webm`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, videoBlob);
      const url = await getDownloadURL(storageRef);
      return url;
    } catch (error) {
      console.error('Error uploading video:', error);
      throw new Error('Error al subir el video');
    }
  };

  const handleSubmit = async () => {
    if (!formData.rubro || !formData.puesto) {
      toast.error('Seleccioná rubro y puesto');
      return;
    }

    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      let finalVideoUrl = videoUrl;

      if (photoBlob) {
        toast.loading('Subiendo foto...', { id: 'upload-photo' });
        const uploadedPhotoUrl = await uploadPhoto();
        if (uploadedPhotoUrl) {
          finalPhotoUrl = uploadedPhotoUrl;
        }
        toast.dismiss('upload-photo');
      }

      if (videoBlob) {
        toast.loading('Subiendo video...', { id: 'upload-video' });
        const uploadedVideoUrl = await uploadVideo();
        if (uploadedVideoUrl) {
          finalVideoUrl = uploadedVideoUrl;
        }
        toast.dismiss('upload-video');
      }

      await api.createWorkerProfile({
        ...formData,
        skills: selectedSkills,
        photoUrl: finalPhotoUrl,
        videoUrl: finalVideoUrl,
      });

      await refreshUserData();
      toast.success('Perfil guardado');
      router.push('/home');
    } catch (error) {
      toast.dismiss('upload-photo');
      toast.dismiss('upload-video');
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
      {/* Profile Completion */}
      <div className="theme-bg-card border theme-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium theme-text-primary">
            Perfil completado
          </span>
          <span className={`text-sm font-bold ${
            profileCompletion.percentage === 100
              ? 'text-[#12B76A]'
              : profileCompletion.percentage >= 50
                ? 'text-[#F79009]'
                : 'text-[#F04438]'
          }`}>
            {profileCompletion.percentage}%
          </span>
        </div>
        <div className="w-full bg-[#344054] rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              profileCompletion.percentage === 100
                ? 'bg-[#12B76A]'
                : profileCompletion.percentage >= 50
                  ? 'bg-[#F79009]'
                  : 'bg-[#F04438]'
            }`}
            style={{ width: `${profileCompletion.percentage}%` }}
          />
        </div>
        {profileCompletion.missing.length > 0 && profileCompletion.percentage < 100 && (
          <p className="text-xs theme-text-muted mt-2">
            Te falta: {profileCompletion.missing.slice(0, 3).join(', ')}
            {profileCompletion.missing.length > 3 && ` y ${profileCompletion.missing.length - 3} más`}
          </p>
        )}
        {profileCompletion.percentage === 100 && (
          <p className="text-xs text-[#12B76A] mt-2 flex items-center gap-1">
            <Check className="w-3 h-3" /> Perfil completo - Más visibilidad para empleadores
          </p>
        )}
      </div>

      {/* Photo */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Foto de perfil
        </label>
        <p className="text-[#667085] text-sm mb-3">
          Los empleadores quieren ver con quién van a trabajar. Una buena foto aumenta tus chances.
        </p>

        {photoBlob ? (
          <div className="space-y-3">
            <div className="relative w-32 h-32 mx-auto">
              <img
                src={URL.createObjectURL(photoBlob)}
                alt="Foto de perfil"
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
              className="w-full p-3 rounded-xl border-2 theme-border theme-text-secondary"
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

      {/* Rubro */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          ¿En qué rubro trabajás? *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFormData({ ...formData, rubro: key, puesto: '' })}
              className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 ${
                formData.rubro === key
                  ? 'border-[#e05f5a] bg-[#e05f5a]/10'
                  : 'theme-border theme-bg-card'
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
              <span className="font-medium theme-text-primary">{value.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Puesto */}
      {formData.rubro && (
        <div>
          <label className="block text-sm font-medium text-[#98A2B3] mb-2">
            ¿Qué puesto buscás? *
          </label>
          <div className="flex flex-wrap gap-2">
            {availablePuestos.map((puesto) => (
              <button
                key={puesto}
                type="button"
                onClick={() => setFormData({ ...formData, puesto })}
                className={`px-4 py-2 rounded-full border-2 transition-all active:scale-95 ${
                  formData.puesto === puesto
                    ? 'border-[#E10600] bg-[#E10600] text-white'
                    : 'theme-border theme-bg-card theme-text-secondary'
                }`}
              >
                {puesto}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Skills */}
      {formData.rubro && formData.puesto && (
        <div>
          <label className="block text-sm font-medium text-[#98A2B3] mb-2">
            Tus habilidades
          </label>
          <p className="text-[#667085] text-sm mb-3">
            Selecciona las habilidades que tenes. Esto mejora tu visibilidad.
          </p>
          <div className="flex flex-wrap gap-2">
            {getSuggestedSkills(formData.rubro, formData.puesto).map((skill) => {
              const isSelected = selectedSkills.includes(skill);
              return (
                <button
                  key={skill}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      setSelectedSkills(prev => prev.filter(s => s !== skill));
                    } else {
                      setSelectedSkills(prev => [...prev, skill]);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm transition-all active:scale-95 ${
                    isSelected
                      ? 'border-[#E10600] bg-[#E10600] text-white'
                      : 'theme-border theme-bg-card theme-text-secondary'
                  }`}
                >
                  {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {skill}
                </button>
              );
            })}
          </div>
          {selectedSkills.length > 0 && (
            <p className="text-sm text-[#12B76A] mt-2">
              {selectedSkills.length} habilidades seleccionadas
            </p>
          )}
        </div>
      )}

      {/* Zona */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          ¿En qué zona preferís trabajar?
        </label>
        <select
          value={formData.zona}
          onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none"
        >
          <option value="">Cualquier zona</option>
          {ZONAS_MDP.map((zona) => (
            <option key={zona} value={zona}>{zona}</option>
          ))}
        </select>
      </div>

      {/* Localidad */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          ¿Dónde vivís?
        </label>
        <input
          type="text"
          value={formData.localidad}
          onChange={(e) => setFormData({ ...formData, localidad: e.target.value })}
          placeholder="Ej: Mar del Plata, Batán, etc."
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Experience */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Experiencia
        </label>
        <input
          type="text"
          value={formData.experience}
          onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
          placeholder="Ej: 3 años en gastronomía"
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Contanos sobre vos
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Describí tu experiencia y habilidades..."
          rows={3}
          className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none resize-none"
        />
      </div>

      {/* Video */}
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Video de presentación
        </label>
        <p className="text-[#667085] text-sm mb-3">
          Grabá un video corto presentándote (máx 45 seg). Esto ayuda mucho a los empleadores a conocerte.
        </p>

        {videoBlob ? (
          <div className="space-y-3">
            <div className="bg-[#12B76A]/20 text-[#12B76A] p-3 rounded-xl flex items-center">
              <span className="mr-2">✓</span>
              <span>Video grabado y listo para subir</span>
            </div>
            <button
              type="button"
              onClick={() => setVideoBlob(null)}
              className="w-full p-3 rounded-xl border-2 theme-border theme-text-secondary"
            >
              🎥 Grabar otro video
            </button>
          </div>
        ) : (
          <VideoRecorder
            onVideoRecorded={handleVideoRecorded}
            onVideoDeleted={handleVideoDeleted}
            maxDuration={45}
            existingVideoUrl={videoUrl}
          />
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={saving || !formData.rubro || !formData.puesto}
        className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
      >
        {saving ? 'Guardando...' : 'Guardar perfil'}
      </button>
    </div>
  );
}
