'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, ZONAS_MDP, Rubro } from '@/config/constants';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { MobileLayout } from '@/components/MobileLayout';
import { VideoRecorder } from '@/components/VideoRecorder';
import { toast } from 'sonner';
import { WorkerProfile } from '@/types';

export default function WorkerProfilePage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();

  const [formData, setFormData] = useState({
    rubro: '',
    puesto: '',
    zona: '',
    description: '',
    experience: '',
  });
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && userData?.role !== 'worker') {
      router.push('/home');
    }
  }, [loading, user, userData, router]);

  useEffect(() => {
    if (userData?.profile) {
      const profile = userData.profile as WorkerProfile;
      setFormData({
        rubro: profile.rubro || '',
        puesto: profile.puesto || '',
        zona: profile.zona || '',
        description: profile.description || '',
        experience: profile.experience || '',
      });
      setVideoUrl(profile.videoUrl || '');
    }
  }, [userData]);

  const availablePuestos = formData.rubro
    ? JOB_CATEGORIES[formData.rubro as Rubro]?.puestos || []
    : [];

  const handleVideoRecorded = (blob: Blob) => {
    setVideoBlob(blob);
    // Clear existing video URL since we have a new recording
    setVideoUrl('');
    toast.success('Video grabado correctamente');
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
      let finalVideoUrl = videoUrl;

      if (videoBlob) {
        toast.loading('Subiendo video...', { id: 'upload' });
        const uploadedUrl = await uploadVideo();
        if (uploadedUrl) {
          finalVideoUrl = uploadedUrl;
        }
        toast.dismiss('upload');
      }

      await api.createWorkerProfile({
        ...formData,
        videoUrl: finalVideoUrl,
      });

      await refreshUserData();
      toast.success('Perfil guardado');
      router.push('/home');
    } catch (error) {
      toast.dismiss('upload');
      toast.error(error instanceof Error ? error.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <MobileLayout title="Mi Perfil" showBack backHref="/home">
      <div className="px-4 py-6 space-y-6">
        {/* Rubro */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
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
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
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
                <span className="font-medium text-gray-900">{value.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Puesto */}
        {formData.rubro && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
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
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  {puesto}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Zona */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ¿En qué zona preferís trabajar?
          </label>
          <select
            value={formData.zona}
            onChange={(e) => setFormData({ ...formData, zona: e.target.value })}
            className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Cualquier zona</option>
            {ZONAS_MDP.map((zona) => (
              <option key={zona} value={zona}>{zona}</option>
            ))}
          </select>
        </div>

        {/* Experience */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Experiencia
          </label>
          <input
            type="text"
            value={formData.experience}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            placeholder="Ej: 3 años en gastronomía"
            className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contanos sobre vos
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describí tu experiencia y habilidades..."
            rows={3}
            className="w-full p-4 rounded-xl border-2 border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Video */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Video de presentación
          </label>
          <p className="text-gray-500 text-sm mb-3">
            Grabá un video corto presentándote (máx 45 seg). Esto ayuda mucho a los empleadores a conocerte.
          </p>

          {videoBlob ? (
            <div className="space-y-3">
              <div className="bg-green-50 text-green-700 p-3 rounded-xl flex items-center">
                <span className="mr-2">✓</span>
                <span>Video grabado y listo para subir</span>
              </div>
              <button
                type="button"
                onClick={() => setVideoBlob(null)}
                className="w-full p-3 rounded-xl border-2 border-gray-200 text-gray-600"
              >
                🎥 Grabar otro video
              </button>
            </div>
          ) : (
            <VideoRecorder
              onVideoRecorded={handleVideoRecorded}
              maxDuration={45}
              existingVideoUrl={videoUrl}
            />
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || !formData.rubro || !formData.puesto}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {saving ? 'Guardando...' : 'Guardar perfil'}
        </button>
      </div>
    </MobileLayout>
  );
}
