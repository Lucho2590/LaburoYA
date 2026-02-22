'use client';

import { IRelevantOffer } from '@/types';
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
import { MapPin, DollarSign, Clock, Star, Check, Building2 } from 'lucide-react';

interface OfferDetailModalProps {
  offer: IRelevantOffer | null;
  open: boolean;
  onClose: () => void;
  onContact?: (offer: IRelevantOffer) => void;
  isRequesting?: boolean;
}

export function OfferDetailModal({
  offer,
  open,
  onClose,
  onContact,
  isRequesting = false,
}: OfferDetailModalProps) {
  if (!offer) return null;

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
          <div className="flex items-center gap-2 mb-2">
            {offer.relevance.matchType && (
              <Badge
                className={`${matchTypeColor[offer.relevance.matchType]} text-white`}
              >
                {matchTypeLabel[offer.relevance.matchType]}
              </Badge>
            )}
            <Badge variant="outline">
              {offer.relevance.score} pts
            </Badge>
          </div>
          <DialogTitle className="text-xl">
            {offer.puesto}
          </DialogTitle>
          <DialogDescription>
            {offer.rubro}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employer */}
          {offer.employer && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{offer.employer.businessName}</span>
            </div>
          )}

          {/* Location */}
          {offer.zona && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{offer.zona}</span>
              {offer.relevance.details.zonaMatch && (
                <Badge variant="secondary" className="text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Tu zona
                </Badge>
              )}
            </div>
          )}

          {/* Salary */}
          {offer.salary && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span>{offer.salary}</span>
            </div>
          )}

          {/* Schedule */}
          {offer.schedule && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{offer.schedule}</span>
            </div>
          )}

          {/* Description */}
          {offer.description && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Descripcion</h4>
              <p className="text-sm text-muted-foreground">
                {offer.description}
              </p>
            </div>
          )}

          {/* Requirements */}
          {offer.requirements && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Requisitos</h4>
              <p className="text-sm text-muted-foreground">
                {offer.requirements}
              </p>
            </div>
          )}

          {/* Required Skills */}
          {offer.requiredSkills && offer.requiredSkills.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                <h4 className="text-sm font-medium">Skills requeridos</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {offer.requiredSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant={
                      offer.relevance.details.matchingSkills.includes(skill)
                        ? 'default'
                        : 'outline'
                    }
                  >
                    {offer.relevance.details.matchingSkills.includes(skill) && (
                      <Check className="h-3 w-3 mr-1" />
                    )}
                    {skill}
                  </Badge>
                ))}
              </div>
              {offer.relevance.details.matchingSkills.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tienes {offer.relevance.details.matchingSkills.length} de {offer.requiredSkills.length} skills requeridos
                </p>
              )}
            </div>
          )}

          {/* Match Details */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <h4 className="text-sm font-medium">Por que es un buen match</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {offer.relevance.details.rubroMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Tu rubro</span>
              </div>
              <div className="flex items-center gap-1">
                {offer.relevance.details.puestoMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Tu puesto</span>
              </div>
              <div className="flex items-center gap-1">
                {offer.relevance.details.zonaMatch ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                )}
                <span>Tu zona</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">
                  {offer.relevance.details.matchingSkills.length} skills
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {onContact && !offer.hasRequested && (
            <Button
              onClick={() => onContact(offer)}
              disabled={isRequesting}
            >
              {isRequesting ? 'Enviando...' : 'Me interesa'}
            </Button>
          )}
          {offer.hasRequested && (
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
