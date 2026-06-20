'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import { ICreateCityData, IGeoLocation } from '@/types';
import LocationPicker from '@/components/LocationPicker';
import { toast } from 'sonner';
import { Search, Loader2, ArrowLeft, MapPin } from 'lucide-react';

const MDP_FALLBACK: IGeoLocation = { lat: -38.0023, lng: -57.5575 };

export default function CityEditor({ cityId }: { cityId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [detected, setDetected] = useState<string | null>(null);
  const [formData, setFormData] = useState<ICreateCityData>({
    nombre: '',
    center: MDP_FALLBACK,
    radiusKm: 15,
    zonas: [],
    activo: true,
    orden: 0,
  });
  const [zonasText, setZonasText] = useState('');
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga las ciudades: al editar, popula la ciudad; al crear, deja el orden
  // por defecto en la última posición (cantidad de ciudades existentes).
  useEffect(() => {
    api.getAdminCities()
      .then(({ cities }) => {
        if (cityId) {
          const c = cities.find((x) => x.id === cityId);
          if (!c) {
            toast.error('Ciudad no encontrada');
            router.push('/sudo/cities');
            return;
          }
          setFormData({
            nombre: c.nombre,
            center: c.center || MDP_FALLBACK,
            radiusKm: c.radiusKm || 15,
            zonas: c.zonas || [],
            activo: c.activo,
            orden: c.orden || 0,
          });
          setZonasText((c.zonas || []).join(', '));
        } else {
          // Nueva ciudad: va última por defecto (editable).
          setFormData((f) => ({ ...f, orden: cities.length }));
        }
      })
      .catch(() => {
        if (cityId) toast.error('Error al cargar la ciudad');
      })
      .finally(() => setLoading(false));
  }, [cityId, router]);

  // Busca la ciudad por su nombre y recentra el mapa.
  const geocodeCityName = async () => {
    const q = formData.nombre.trim();
    if (!q) {
      toast.info('Escribí el nombre de la ciudad primero');
      return;
    }
    setGeocoding(true);
    try {
      const { results } = await api.geocodeAddress(q);
      if (results[0]) {
        setFormData((f) => ({ ...f, center: { lat: results[0].lat, lng: results[0].lng } }));
        setDetected(results[0].displayName);
        setRecenterSignal((n) => n + 1);
      } else {
        toast.info('No encontramos esa ciudad. Marcala en el mapa.');
      }
    } catch {
      toast.error('No se pudo buscar la ciudad.');
    } finally {
      setGeocoding(false);
    }
  };

  // Al mover el pin: reconoce la ciudad (reverse geocode) y autocompleta el nombre si está vacío.
  const handlePinChange = (loc: IGeoLocation | null) => {
    if (!loc) return;
    setFormData((f) => ({ ...f, center: loc }));
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(async () => {
      try {
        const { result } = await api.reverseGeocode(loc.lat, loc.lng);
        if (result) {
          setDetected(result.displayName);
          if (result.city) {
            setFormData((f) => (f.nombre.trim() ? f : { ...f, nombre: result.city as string }));
          }
        }
      } catch {
        /* best-effort */
      }
    }, 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre.trim()) {
      toast.error('Ponele un nombre a la ciudad');
      return;
    }
    setSaving(true);
    const payload: ICreateCityData = {
      ...formData,
      nombre: formData.nombre.trim(),
      zonas: zonasText.split(/[,\n]/).map((z) => z.trim()).filter(Boolean),
    };
    try {
      if (cityId) {
        await api.updateAdminCity(cityId, payload);
        toast.success('Ciudad actualizada');
      } else {
        await api.createAdminCity(payload);
        toast.success('Ciudad creada');
      }
      router.push('/sudo/cities');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]" />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => router.push('/sudo/cities')}
        className="mb-4 flex items-center gap-1.5 text-sm theme-text-secondary hover:text-[#E10600]"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a ciudades
      </button>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-2">
        {/* Columna izquierda: mapa */}
        <div>
          <label className="block text-sm font-medium theme-text-secondary mb-1">
            Centro y radio de cobertura *
          </label>
          <p className="text-xs theme-text-muted mb-2">
            Movés el pin para ajustar el centro (reconocemos la ciudad automáticamente). El círculo rojo es el área donde la app matchea ofertas y candidatos.
          </p>
          <LocationPicker
            value={formData.center}
            onChange={handlePinChange}
            center={formData.center}
            radiusKm={formData.radiusKm}
            onRadiusChange={(km) => setFormData({ ...formData, radiusKm: km })}
            cityName={formData.nombre}
            recenterSignal={recenterSignal}
            allowClear={false}
            heightClass="h-[420px]"
          />
          {detected && (
            <p className="mt-2 flex items-start gap-1.5 text-xs theme-text-muted">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#E10600]" />
              <span>Detectado: {detected}</span>
            </p>
          )}
        </div>

        {/* Columna derecha: datos */}
        <div className="space-y-5">
          {/* Nombre + ubicar */}
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">
              Nombre de la ciudad *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    geocodeCityName();
                  }
                }}
                className="flex-1 px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                placeholder="Ej: Tandil"
                required
              />
              <button
                type="button"
                onClick={geocodeCityName}
                disabled={geocoding}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium disabled:opacity-50 active:scale-95"
              >
                {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Ubicar
              </button>
            </div>
            <p className="text-xs theme-text-muted mt-1">
              Escribí el nombre y tocá &quot;Ubicar&quot;, o marcá el punto en el mapa.
            </p>
          </div>

          {/* Zonas */}
          <div>
            <label className="block text-sm font-medium theme-text-secondary mb-1">
              Zonas / Barrios
            </label>
            <p className="text-xs theme-text-muted mb-2">
              Separadas por coma. Aparecen como opciones al cargar ofertas y perfiles.
            </p>
            <textarea
              value={zonasText}
              onChange={(e) => setZonasText(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
              placeholder="Centro, La Perla, Güemes, Puerto..."
            />
          </div>

          {/* Orden + Activo */}
          <div className="flex items-end gap-6">
            <div className="w-40">
              <label className="block text-sm font-medium theme-text-secondary mb-1">
                Orden <span className="theme-text-muted font-normal">(última por defecto)</span>
              </label>
              <input
                type="number"
                value={formData.orden}
                onChange={(e) => setFormData({ ...formData, orden: Number(e.target.value) })}
                className="w-full px-4 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary focus:ring-2 focus:ring-[#E10600] focus:border-transparent"
                min={0}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={formData.activo}
                onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300 text-[#E10600] focus:ring-[#E10600]"
              />
              <span className="text-sm theme-text-secondary">Ciudad activa</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.push('/sudo/cities')}
              className="flex-1 px-4 py-2 border theme-border rounded-lg theme-text-secondary hover:theme-bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-[#E10600] text-white rounded-lg hover:bg-[#c00500] transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : cityId ? 'Guardar Cambios' : 'Crear Ciudad'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
