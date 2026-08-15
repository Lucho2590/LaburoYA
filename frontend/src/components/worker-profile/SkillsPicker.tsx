'use client';

import { Check, Plus } from 'lucide-react';
import { getSuggestedSkills } from '@/config/constants';

interface SkillsPickerProps {
  rubro: string;
  puesto: string;
  selected: string[];
  onToggle: (skill: string) => void;
}

/** Chips de habilidades sugeridas según rubro y puesto. */
export function SkillsPicker({ rubro, puesto, selected, onToggle }: SkillsPickerProps) {
  if (!rubro || !puesto) return null;

  return (
    <div>
      <label className="block text-sm font-medium text-[#98A2B3] mb-2">
        Tus habilidades
      </label>
      <p className="text-[#667085] text-sm mb-3">
        Elegí las que tengas. Es lo que hace que te encuentren en las búsquedas.
      </p>
      <div className="flex flex-wrap gap-2">
        {getSuggestedSkills(rubro, puesto).map((skill) => {
          const isSelected = selected.includes(skill);
          return (
            <button
              key={skill}
              type="button"
              onClick={() => onToggle(skill)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full border-2 text-sm transition-all active:scale-95 cursor-pointer ${
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
      {selected.length > 0 && (
        <p className="text-sm text-[#12B76A] mt-2">
          {selected.length} habilidad{selected.length !== 1 ? 'es' : ''} seleccionada{selected.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
