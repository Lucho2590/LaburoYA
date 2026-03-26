'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, Trash2 } from 'lucide-react';

interface CameraCaptureProps {
  onPhotoCaptured: (blob: Blob) => void;
  onPhotoDeleted?: () => void;
  existingPhotoUrl?: string;
}

export function CameraCapture({
  onPhotoCaptured,
  onPhotoDeleted,
  existingPhotoUrl
}: CameraCaptureProps) {
  const [mode, setMode] = useState<'idle' | 'preview' | 'captured'>('idle');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (stream && videoRef.current && mode === 'preview') {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [stream, mode]);

  const startCamera = async (facing: 'user' | 'environment' = facingMode) => {
    try {
      setError(null);

      // Stop any existing stream first
      stopCamera();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setFacingMode(facing);
      setMode('preview');
    } catch (err) {
      console.error('Camera error:', err);
      setError('No se pudo acceder a la cámara. Verificá los permisos.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  };

  const switchCamera = () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    startCamera(newFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mirror the image if using front camera
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedUrl(url);
        setMode('captured');
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  };

  const confirmPhoto = () => {
    if (capturedBlob) {
      onPhotoCaptured(capturedBlob);
    }
  };

  const retryCapture = () => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    setCapturedBlob(null);
    setCapturedUrl(null);
    startCamera();
  };

  const cancelCapture = () => {
    stopCamera();
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
    }
    setCapturedBlob(null);
    setCapturedUrl(null);
    setMode('idle');
  };

  const deletePhoto = () => {
    if (onPhotoDeleted) {
      onPhotoDeleted();
    }
  };

  // Show existing photo
  if (mode === 'idle' && existingPhotoUrl) {
    return (
      <div className="space-y-3">
        <div className="relative w-32 h-32 mx-auto">
          <img
            src={existingPhotoUrl}
            alt="Foto de perfil"
            className="w-full h-full rounded-full object-cover border-4 border-[#344054]"
          />
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => startCamera()}
            className="flex-1 p-3 rounded-xl border-2 border-[#344054] text-[#98A2B3] active:bg-[#1F2937] flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            Nueva foto
          </button>
          <button
            type="button"
            onClick={deletePhoto}
            className="flex-1 p-3 rounded-xl border-2 border-[#E10600]/50 text-[#E10600] active:bg-[#E10600]/10 flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Eliminar
          </button>
        </div>
      </div>
    );
  }

  // Idle state - show capture button
  if (mode === 'idle') {
    return (
      <div className="space-y-3">
        {error && (
          <div className="bg-[#E10600]/20 text-[#E10600] p-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => startCamera()}
          className="w-full p-6 rounded-xl border-2 border-dashed border-[#E10600]/50 bg-[#E10600]/10 text-[#E10600] active:bg-[#E10600]/20 flex flex-col items-center"
        >
          <Camera className="w-10 h-10 mb-2" />
          <span className="font-medium">Tomar foto de perfil</span>
          <span className="text-sm text-[#FF6A00] mt-1">Usá la cámara de tu dispositivo</span>
        </button>
      </div>
    );
  }

  // Preview / Captured state - Show as fullscreen modal
  return (
    <>
      {/* Hidden canvas for capturing */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Placeholder in form to maintain layout */}
      <div className="w-full p-6 rounded-xl border-2 border-dashed border-[#344054] bg-[#1F2937]/50 flex flex-col items-center">
        <Camera className="w-10 h-10 mb-2 text-[#98A2B3]" />
        <span className="font-medium text-[#98A2B3]">Tomando foto...</span>
      </div>

      {/* Fullscreen Modal Overlay */}
      <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="text-center mb-4">
            <h3 className="text-white text-lg font-semibold">
              {mode === 'captured' ? 'Vista previa' : 'Foto de perfil'}
            </h3>
            <p className="text-[#98A2B3] text-sm mt-1">
              {mode === 'preview' && 'Posicioná tu rostro y tocá el botón'}
              {mode === 'captured' && 'Revisá tu foto antes de confirmar'}
            </p>
          </div>

          {/* Photo Container */}
          <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl">
            {mode === 'captured' && capturedUrl ? (
              <img
                src={capturedUrl}
                alt="Foto capturada"
                className="w-full aspect-square object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className={`w-full aspect-square object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
                autoPlay
                playsInline
                muted
              />
            )}

            {/* Switch camera button (only in preview) */}
            {mode === 'preview' && (
              <button
                onClick={switchCamera}
                className="absolute top-4 right-4 w-10 h-10 bg-black/50 rounded-full flex items-center justify-center text-white active:scale-95"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="mt-6">
            {mode === 'preview' && (
              <div className="flex justify-center gap-6">
                <button
                  onClick={cancelCapture}
                  className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-95 border border-white/20"
                >
                  <X className="w-6 h-6" />
                </button>
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white rounded-full flex items-center justify-center active:scale-95 border-4 border-[#E10600] shadow-lg"
                >
                  <Camera className="w-8 h-8 text-[#E10600]" />
                </button>
                <div className="w-14 h-14" /> {/* Spacer for symmetry */}
              </div>
            )}

            {mode === 'captured' && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={retryCapture}
                  className="flex-1 py-4 rounded-xl border-2 border-[#344054] text-[#98A2B3] font-medium active:bg-[#1F2937] flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Otra foto
                </button>
                <button
                  type="button"
                  onClick={confirmPhoto}
                  className="flex-1 py-4 rounded-xl bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Usar esta
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
