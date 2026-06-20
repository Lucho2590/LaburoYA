'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { LocateFixed, Search, Loader2, X } from 'lucide-react';
import { getBrowserLocation } from '@/lib/geo';
import { api } from '@/services/api';
import type { IGeoLocation, IGeocodeResult } from '@/types';

// El mapa Leaflet sólo corre en el cliente: lo cargamos sin SSR.
const LocationMapInner = dynamic(() => import('./LocationMapInner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center theme-bg-secondary text-sm theme-text-muted">
      Cargando mapa…
    </div>
  )
});

interface Props {
  value: IGeoLocation | null;
  onChange: (loc: IGeoLocation | null) => void;
  center?: IGeoLocation; // centro de la ciudad: centra el mapa y dibuja el círculo si no hay punto
  radiusKm?: number; // radio (km) del círculo dibujado
  onRadiusChange?: (km: number) => void; // si se pasa, muestra un slider para ajustar el radio
  minRadiusKm?: number;
  maxRadiusKm?: number;
  cityName?: string; // hint para el geocoding
  isLocationServed?: (loc: IGeoLocation) => boolean; // si se pasa, avisa cuando la dirección cae fuera del área de servicio
  recenterSignal?: number; // al cambiar, recentra el mapa sobre `value` (recentrado externo)
  allowClear?: boolean; // muestra el botón "Quitar" (default true)
  heightClass?: string;
}

export default function LocationPicker({
  value,
  onChange,
  center,
  radiusKm,
  onRadiusChange,
  minRadiusKm = 1,
  maxRadiusKm = 50,
  cityName,
  isLocationServed,
  recenterSignal,
  allowClear = true,
  heightClass = 'h-64'
}: Props) {
  const [focus, setFocus] = useState<IGeoLocation | null>(null);

  // Recentrado externo (ej: el admin "ubica" la ciudad por su nombre).
  useEffect(() => {
    if (recenterSignal !== undefined && value) setFocus({ ...value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterSignal]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IGeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleGps = async () => {
    setLocating(true);
    try {
      const coords = await getBrowserLocation();
      onChange(coords);
      setFocus({ ...coords });
      setResults([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo obtener tu ubicación');
    } finally {
      setLocating(false);
    }
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const { results: found } = await api.geocodeAddress(q, cityName);
      setResults(found);
      if (found.length === 0) {
        toast.info('No encontramos esa dirección. Probá con otra.');
      } else if (isLocationServed && found.every((r) => !isLocationServed({ lat: r.lat, lng: r.lng }))) {
        toast.info('Esa dirección está fuera de las ciudades donde operamos por ahora.');
      }
    } catch {
      toast.error('No se pudo buscar la dirección.');
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: IGeocodeResult) => {
    const loc = { lat: r.lat, lng: r.lng };
    onChange(loc);
    setFocus({ ...loc });
    setResults([]);
    setQuery(r.displayName || '');
  };

  return (
    <div className="space-y-2">
      {/* Buscador de direcciones (sin <form> para poder anidarlo en otros formularios) */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 theme-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
              }
            }}
            placeholder="Buscar dirección (calle y número, barrio…)"
            className="w-full rounded-lg border theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted py-2 pl-8 pr-3 text-sm focus:border-[#E10600] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 active:scale-95"
        >
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar
        </button>
        <button
          type="button"
          onClick={handleGps}
          disabled={locating}
          title="Usar mi ubicación"
          className="flex items-center gap-1 rounded-lg border theme-border theme-text-secondary px-3 py-2 text-sm font-medium disabled:opacity-50 active:scale-95"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          GPS
        </button>
      </div>

      {/* Resultados de la búsqueda */}
      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-lg border theme-border theme-bg-card theme-text-primary text-sm shadow-sm">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                onClick={() => pickResult(r)}
                className="block w-full px-3 py-2 text-left hover:opacity-80"
              >
                {r.displayName || `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Mapa */}
      <div className={`${heightClass} w-full overflow-hidden rounded-lg border theme-border`}>
        <LocationMapInner
          value={value}
          onChange={onChange}
          center={center}
          radiusKm={radiusKm}
          focus={focus}
        />
      </div>

      {/* Slider de radio */}
      {onRadiusChange && typeof radiusKm === 'number' && (
        <div className="rounded-lg border theme-border theme-bg-card px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs font-medium theme-text-secondary">
            <span>Radio de búsqueda</span>
            <span className="text-[#E10600]">{radiusKm} km</span>
          </div>
          <input
            type="range"
            min={minRadiusKm}
            max={maxRadiusKm}
            step={1}
            value={radiusKm}
            onChange={(e) => onRadiusChange(Number(e.target.value))}
            className="theme-range w-full accent-[#E10600]"
          />
          <div className="flex justify-between text-[10px] theme-text-muted">
            <span>{minRadiusKm} km</span>
            <span>{maxRadiusKm} km</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs theme-text-muted">
        <span>
          {value
            ? `Ubicación: ${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
            : 'Tocá el mapa, buscá una dirección o usá tu GPS para marcar el punto.'}
        </span>
        {value && allowClear && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1 theme-text-muted hover:text-[#E10600]"
          >
            <X className="h-3 w-3" /> Quitar
          </button>
        )}
      </div>
    </div>
  );
}
