'use client';

import { CameraCapture } from '@/components/CameraCapture';
import { VideoRecorder } from '@/components/VideoRecorder';

interface PhotoFieldProps {
  photoUrl: string;
  photoBlob: Blob | null;
  onCaptured: (blob: Blob) => void;
  onDeleted: () => void;
  onRetake: () => void;
}

export function PhotoField({ photoUrl, photoBlob, onCaptured, onDeleted, onRetake }: PhotoFieldProps) {
  return (
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
            onClick={onRetake}
            className="w-full p-3 rounded-xl border-2 theme-border theme-text-secondary cursor-pointer"
          >
            📷 Tomar otra foto
          </button>
        </div>
      ) : (
        <CameraCapture
          onPhotoCaptured={onCaptured}
          onPhotoDeleted={onDeleted}
          existingPhotoUrl={photoUrl}
        />
      )}
    </div>
  );
}

interface VideoFieldProps {
  videoUrl: string;
  videoBlob: Blob | null;
  onRecorded: (blob: Blob) => void;
  onDeleted: () => void;
  onRetake: () => void;
}

export function VideoField({ videoUrl, videoBlob, onRecorded, onDeleted, onRetake }: VideoFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#98A2B3] mb-2">
        Video de presentación
      </label>
      <p className="text-[#667085] text-sm mb-3">
        Grabá un video corto presentándote (máx 45 seg). Es lo que más ayuda a los
        empleadores a conocerte.
      </p>

      {videoBlob ? (
        <div className="space-y-3">
          <div className="bg-[#12B76A]/20 text-[#12B76A] p-3 rounded-xl flex items-center">
            <span className="mr-2">✓</span>
            <span>Video grabado y listo para subir</span>
          </div>
          <button
            type="button"
            onClick={onRetake}
            className="w-full p-3 rounded-xl border-2 theme-border theme-text-secondary cursor-pointer"
          >
            🎥 Grabar otro video
          </button>
        </div>
      ) : (
        <VideoRecorder
          onVideoRecorded={onRecorded}
          onVideoDeleted={onDeleted}
          maxDuration={45}
          existingVideoUrl={videoUrl}
        />
      )}
    </div>
  );
}

interface AboutFieldsProps {
  experience: string;
  description: string;
  onExperienceChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function AboutFields({
  experience,
  description,
  onExperienceChange,
  onDescriptionChange,
}: AboutFieldsProps) {
  const inputClass =
    'w-full p-4 rounded-xl border-2 theme-border theme-bg-card theme-text-primary placeholder:theme-text-muted focus:border-[#E10600] focus:outline-none';

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">Experiencia</label>
        <input
          type="text"
          value={experience}
          onChange={(e) => onExperienceChange(e.target.value)}
          placeholder="Ej: 3 años en gastronomía"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#98A2B3] mb-2">
          Contanos sobre vos
        </label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describí tu experiencia y habilidades..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
    </>
  );
}
