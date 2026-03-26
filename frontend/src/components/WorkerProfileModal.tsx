'use client';

import { IRelevantWorker } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Star, Video, Check, Clock } from 'lucide-react';

interface WorkerProfileModalProps {
  worker: IRelevantWorker | null;
  open: boolean;
  onClose: () => void;
  onContact?: (worker: IRelevantWorker) => void;
  isRequesting?: boolean;
}

export function WorkerProfileModal({
  worker,
  open,
  onClose,
  onContact,
  isRequesting = false,
}: WorkerProfileModalProps) {
  if (!worker) return null;

  const matchTypeLabel = {
    full_match: 'Match Completo',
    partial_match: 'Match Parcial',
    skills_match: 'Match por Skills',
  };

  const matchTypeColor = {
    full_match: 'bg-green-500',
    partial_match: 'bg-yellow-500',
    skills_match: 'bg-blue-500',
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {worker.relevance.matchType && (
            <div className="mb-2">
              <Badge
                className={`${matchTypeColor[worker.relevance.matchType]} text-white`}
              >
                {matchTypeLabel[worker.relevance.matchType]}
              </Badge>
            </div>
          )}
          <DialogTitle className="text-xl">
            Perfil del Trabajador
          </DialogTitle>
          <DialogDescription>
            {worker.rubro} - {worker.puesto}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Location */}
          {worker.zona && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{worker.zona}</span>
              {worker.relevance.details.zonaMatch && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Tu zona
                </Badge>
              )}
            </div>
          )}

          {/* Video */}
          {worker.videoUrl && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Video className="h-4 w-4" />
                <span>Video de presentacion</span>
              </div>
              <video
                src={worker.videoUrl}
                controls
                className="w-full rounded-lg"
                poster="/video-placeholder.png"
              />
            </div>
          )}

          {/* Description */}
          {worker.description && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Descripcion</h4>
              <p className="text-sm text-muted-foreground">
                {worker.description}
              </p>
            </div>
          )}

          {/* Experience */}
          {worker.experience && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                <h4 className="text-sm font-medium">Experiencia</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                {worker.experience}
              </p>
            </div>
          )}

          {/* Skills */}
          {worker.skills && worker.skills.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <h4 className="text-sm font-medium">Habilidades</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {worker.skills.map((skill) => {
                  const isMatching = worker.relevance.details.matchingSkills.includes(skill);
                  return (
                    <span
                      key={skill}
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        isMatching
                          ? 'bg-[#E10600] text-white'
                          : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                      }`}
                    >
                      {isMatching && <Check className="h-3 w-3 mr-1" />}
                      {skill}
                    </span>
                  );
                })}
              </div>
              {worker.relevance.details.matchingSkills.length > 0 && (
                <p className="text-xs text-[#E10600]">
                  {worker.relevance.details.matchingSkills.length} skill(s) coinciden con tu oferta
                </p>
              )}
            </div>
          )}

          {/* Match Details */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <h4 className="text-sm font-medium">Detalles del Match</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {worker.relevance.details.rubroMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Mismo rubro</span>
              </div>
              <div className="flex items-center gap-1">
                {worker.relevance.details.puestoMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Mismo puesto</span>
              </div>
              <div className="flex items-center gap-1">
                {worker.relevance.details.zonaMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Misma zona</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  {worker.relevance.details.matchingSkills.length} skills
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {onContact && !worker.hasRequested && (
            <Button
              onClick={() => onContact(worker)}
              disabled={isRequesting}
            >
              {isRequesting ? 'Enviando...' : 'Me interesa'}
            </Button>
          )}
          {worker.hasRequested && (
            <Button disabled variant="secondary">
              <Check className="h-4 w-4 mr-2" />
              Solicitud enviada
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
