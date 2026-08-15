'use client';

import { JOB_CATEGORIES } from '@/config/constants';

const RUBRO_EMOJI: Record<string, string> = {
  gastronomia: '🍳',
  comercio: '🏪',
  construccion: '🏗️',
  limpieza: '🧹',
  transporte: '🚗',
  administracion: '💼',
};

interface RubroPuestoPickerProps {
  rubro: string;
  puesto: string;
  availablePuestos: readonly string[];
  onRubroChange: (rubro: string) => void;
  onPuestoChange: (puesto: string) => void;
}

/** Rubro y puesto, con la cascada: elegir rubro limpia el puesto anterior. */
export function RubroPuestoPicker({
  rubro,
  puesto,
  availablePuestos,
  onRubroChange,
  onPuestoChange,
}: RubroPuestoPickerProps) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          ¿En qué rubro trabajás? *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => onRubroChange(key)}
              className={`p-4 rounded-xl border-2 text-left transition-all active:scale-95 cursor-pointer ${
                rubro === key
                  ? 'border-[#e05f5a] bg-[#e05f5a]/10'
                  : 'theme-border theme-bg-card'
              }`}
            >
              <span className="text-2xl block mb-1">{RUBRO_EMOJI[key]}</span>
              <span className="font-medium theme-text-primary">{value.label}</span>
            </button>
          ))}
        </div>
      </div>

      {rubro && (
        <div>
          <label className="block text-sm font-medium text-[#98A2B3] mb-2">
            ¿Qué puesto buscás? *
          </label>
          <div className="flex flex-wrap gap-2">
            {availablePuestos.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPuestoChange(p)}
                className={`px-4 py-2 rounded-full border-2 transition-all active:scale-95 cursor-pointer ${
                  puesto === p
                    ? 'border-[#E10600] bg-[#E10600] text-white'
                    : 'theme-border theme-bg-card theme-text-secondary'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
