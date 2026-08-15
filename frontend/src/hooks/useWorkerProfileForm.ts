'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { JOB_CATEGORIES, ZONAS_MDP, TRubro } from '@/config/constants';
import { haversineKm } from '@/lib/geo';
import { getProfileFieldStatus } from '@/lib/workerProfile';
import { IWorkerProfile, IGeoLocation, ICity } from '@/types';

/**
 * Estado y guardado del perfil laboral, compartido por la pantalla de edición
 * (/worker/profile) y por el wizard de onboarding (/onboarding/perfil). Vivía
 * todo dentro de la página; extraerlo evita mantener dos copias que se
 * desincronizan al primer cambio.
 *
 * Los blobs de foto y video viven en memoria y se suben recién en `save()`, así
 * que el estado tiene que ser dueño el llamador y no cada paso del wizard: si
 * un paso se desmonta, el blob se perdería.
 */
export function useWorkerProfileForm() {
  const { user, userData, refreshUserData } = useAuth();

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
  const [location, setLocation] = useState<IGeoLocation | null>(null);
  const [cities, setCities] = useState<ICity[]>([]);
  const [cityName, setCityName] = useState('');
  const [saving, setSaving] = useState(false);

  // Precarga desde el perfil ya guardado (edición, o wizard reentrante).
  useEffect(() => {
    if (!userData?.profile) return;
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
    setLocation(profile.location || null);
    setCityName(profile.city || '');
  }, [userData]);

  // Ciudades donde opera la app (centro y radio para el mapa).
  useEffect(() => {
    api.getCities()
      .then(({ cities }) => setCities(cities))
      .catch(() => {});
  }, []);

  // Al mover el pin, auto-selecciona la ciudad cubierta donde cae.
  useEffect(() => {
    if (!location || cities.length === 0) return;
    const match = cities.find((c) => haversineKm(location, c.center) <= c.radiusKm);
    if (match) setCityName((prev) => (prev === match.nombre ? prev : match.nombre));
  }, [location, cities]);

  const availablePuestos = useMemo(
    () => (formData.rubro ? JOB_CATEGORIES[formData.rubro as TRubro]?.puestos || [] : []),
    [formData.rubro],
  );

  const selectedCity = useMemo(
    () => cities.find((c) => c.nombre === cityName) || cities[0] || null,
    [cities, cityName],
  );

  const zonaOptions = useMemo(
    () => (selectedCity?.zonas?.length ? selectedCity.zonas : (ZONAS_MDP as readonly string[])),
    [selectedCity],
  );

  // ¿La ubicación elegida cae en alguna ciudad donde opera la app?
  const locationCovered = useMemo(
    () => !location || cities.some((c) => haversineKm(location, c.center) <= c.radiusKm),
    [location, cities],
  );

  const completion = useMemo(
    () => getProfileFieldStatus({
      ...formData,
      skills: selectedSkills,
      photoUrl: photoUrl || (photoBlob ? 'blob' : ''),
      videoUrl: videoUrl || (videoBlob ? 'blob' : ''),
    }),
    [formData, selectedSkills, photoUrl, photoBlob, videoUrl, videoBlob],
  );

  // Rubro y puesto son lo único que el backend exige: sin eso no se puede
  // guardar nada (POST /api/workers devuelve 400).
  const canSave = !!formData.rubro && !!formData.puesto;

  const setRubro = useCallback((rubro: string) => {
    // Cambiar de rubro invalida el puesto y las skills sugeridas.
    setFormData((prev) => ({ ...prev, rubro, puesto: '' }));
    setSelectedSkills([]);
  }, []);

  const setPuesto = useCallback((puesto: string) => {
    setFormData((prev) => ({ ...prev, puesto }));
  }, []);

  const setField = useCallback((key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleSkill = useCallback((skill: string) => {
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );
  }, []);

  const uploadBlob = async (blob: Blob, folder: string, ext: string) => {
    if (!user || !storage) return null;
    const storageRef = ref(storage, `${folder}/${user.uid}/${Date.now()}.${ext}`);
    await uploadBytes(storageRef, blob);
    return getDownloadURL(storageRef);
  };

  /**
   * Sube los medios pendientes y persiste el perfil. Un solo POST: el endpoint
   * dispara el matching en cada llamada (backend/src/routes/workers.js:102), así
   * que guardar paso a paso lo correría de más y con perfiles a medias.
   * Devuelve true si guardó.
   */
  const save = useCallback(async () => {
    if (!canSave) return false;
    setSaving(true);
    try {
      let finalPhotoUrl = photoUrl;
      let finalVideoUrl = videoUrl;

      if (photoBlob) {
        finalPhotoUrl = (await uploadBlob(photoBlob, 'photos', 'jpg')) || finalPhotoUrl;
      }
      if (videoBlob) {
        finalVideoUrl = (await uploadBlob(videoBlob, 'videos', 'webm')) || finalVideoUrl;
      }

      await api.createWorkerProfile({
        ...formData,
        skills: selectedSkills,
        photoUrl: finalPhotoUrl,
        videoUrl: finalVideoUrl,
        location,
        city: cityName || selectedCity?.nombre || null,
      });

      await refreshUserData();
      return true;
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, formData, selectedSkills, photoUrl, photoBlob, videoUrl, videoBlob, location, cityName, selectedCity, refreshUserData]);

  return {
    formData,
    setField,
    setRubro,
    setPuesto,
    selectedSkills,
    toggleSkill,
    photoUrl,
    photoBlob,
    setPhotoBlob,
    setPhotoUrl,
    videoUrl,
    videoBlob,
    setVideoBlob,
    setVideoUrl,
    location,
    setLocation,
    cities,
    cityName,
    setCityName,
    availablePuestos,
    selectedCity,
    zonaOptions,
    locationCovered,
    completion,
    canSave,
    saving,
    save,
  };
}

export type WorkerProfileForm = ReturnType<typeof useWorkerProfileForm>;
