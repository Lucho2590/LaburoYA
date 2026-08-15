'use client';

import { useState } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LocationPicker from '@/components/LocationPicker';
import { ICity, IGeoLocation } from '@/types';

// Valor centinela: el Select de shadcn no admite un SelectItem con value="".
const ANY_ZONA = '__any__';

interface LocationFieldsProps {
  cities: ICity[];
  cityName: string;
  onCityChange: (city: string) => void;
  selectedCity: ICity | null;
  zona: string;
  zonaOptions: readonly string[];
  onZonaChange: (zona: string) => void;
  location: IGeoLocation | null;
  onLocationChange: (location: IGeoLocation | null) => void;
  locationCovered: boolean;
  localidad: string;
  onLocalidadChange: (localidad: string) => void;
  /**
   * En el onboarding el mapa y la localidad no se muestran de entrada: son los
   * campos que más frenan a alguien que se está registrando. En vez de eso se
   * avisa que van a faltar y se ofrece cargarlos ahí mismo. En la pantalla de
   * edición del perfil van siempre visibles.
   */
  collapsibleDetails?: boolean;
}

/** Ciudad, zona, ubicación en el mapa y localidad. */
export function LocationFields({
  cities,
  cityName,
  onCityChange,
  selectedCity,
  zona,
  zonaOptions,
  onZonaChange,
  location,
  onLocationChange,
  locationCovered,
  localidad,
  onLocalidadChange,
  collapsibleDetails = false,
}: LocationFieldsProps) {
  const [expanded, setExpanded] = useState(false);
  // Si ya venían cargados no tiene sentido esconderlos. Se deriva en vez de
  // inicializar el estado porque el perfil se hidrata asincrónico: al montar
  // todavía puede estar vacío.
  const hasData = !!location || !!localidad;
  const showDetails = !collapsibleDetails || expanded || hasData;

  const selectClass =
    'w-full data-[size=default]:h-auto px-4 py-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary';

  return (
    <>
      {/* Con una sola ciudad no tiene sentido preguntar. */}
      {cities.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-[#98A2B3] mb-2">
            ¿En qué ciudad trabajás?
          </label>
          <Select value={cityName} onValueChange={onCityChange}>
            <SelectTrigger className={selectClass}>
              <SelectValue placeholder="Elegí una ciudad" />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          ¿En qué zona preferís trabajar?
        </label>
        <Select
          value={zona || ANY_ZONA}
          onValueChange={(v) => onZonaChange(v === ANY_ZONA ? '' : v)}
        >
          <SelectTrigger className={selectClass}>
            <SelectValue placeholder="Cualquier zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY_ZONA}>Cualquier zona</SelectItem>
            {zonaOptions.map((z) => (
              <SelectItem key={z} value={z}>{z}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {showDetails && (
          <div className="mt-3">
            <p className="text-sm theme-text-muted mb-2">
              Marcá tu ubicación en el mapa, buscá tu dirección o usá tu GPS. Te mostramos
              primero las búsquedas más cercanas.
            </p>
            <LocationPicker
              value={location}
              onChange={onLocationChange}
              center={selectedCity?.center}
              radiusKm={selectedCity?.radiusKm}
              cityName={selectedCity?.nombre}
            />
            {!locationCovered && (
              <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Todavía no operamos en esta ciudad. Podés guardar tu perfil igual, pero por
                  ahora puede que no veas búsquedas cercanas.
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {showDetails && (
        <div>
          <label className="block text-sm font-medium text-[#98A2B3] mb-2">
            ¿Dónde vivís?
          </label>
          <input
            type="text"
            value={localidad}
            onChange={(e) => onLocalidadChange(e.target.value)}
            placeholder="Ej: Mar del Plata, Batán, etc."
            className="w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none"
          />
        </div>
      )}

      {/* Sin ubicación exacta el backend igual geocodifica por zona, pero queda
          aproximada y el matching le baja el puntaje de cercanía. Se dice, y se
          deja cargarla ahí mismo: nunca se pierde la opción. */}
      {collapsibleDetails && !showDetails && (
        <div className="rounded-xl border theme-border theme-bg-card p-4">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E10600]" />
            <div className="min-w-0">
              <p className="text-sm font-medium theme-text-primary">
                Te van a faltar tu ubicación y tu localidad
              </p>
              <p className="text-sm theme-text-secondary mt-1">
                Sin eso te ubicamos aproximado por la zona, y las búsquedas que te quedan
                cerca te van a aparecer más abajo. Te recomendamos cargarlas.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 w-full py-3 rounded-xl border-2 border-[#E10600] text-[#E10600] text-sm font-medium active:scale-[0.98] transition-transform cursor-pointer"
          >
            Cargarlas ahora
          </button>
          <p className="text-xs theme-text-muted mt-2 text-center">
            También podés hacerlo después desde tu perfil.
          </p>
        </div>
      )}
    </>
  );
}
