'use client';

import { useState, useRef, useEffect } from 'react';

interface VideoRecorderProps {
  onVideoRecorded: (blob: Blob) => void;
  onVideoDeleted?: () => void;
  maxDuration?: number; // in seconds
  existingVideoUrl?: string;
}

export function VideoRecorder({
  onVideoRecorded,
  onVideoDeleted,
  maxDuration = 45,
  existingVideoUrl
}: VideoRecorderProps) {
  const [mode, setMode] = useState<'idle' | 'preview' | 'recording' | 'recorded'>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(maxDuration);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Attach stream to video element when both are ready
  useEffect(() => {
    if (stream && videoRef.current && (mode === 'preview' || mode === 'recording')) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }
  }, [stream, mode]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: true
      });

      streamRef.current = mediaStream;
      setStream(mediaStream);
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

  const startRecording = () => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setTimeLeft(maxDuration);

    const mediaRecorder = new MediaRecorder(streamRef.current, {
      mimeType: 'video/webm;codecs=vp8,opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
      setMode('recorded');
      stopCamera();
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000);
    setMode('recording');

    // Timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const confirmVideo = () => {
    if (recordedBlob) {
      onVideoRecorded(recordedBlob);
    }
  };

  const retryRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setMode('idle');
  };

  const cancelRecording = () => {
    stopRecording();
    stopCamera();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setMode('idle');
  };

  const deleteVideo = () => {
    if (onVideoDeleted) {
      onVideoDeleted();
    }
  };

  // Show existing video
  if (mode === 'idle' && existingVideoUrl) {
    return (
      <div className="space-y-3">
        <video
          src={existingVideoUrl}
          controls
          className="w-full rounded-xl bg-black"
          playsInline
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={startCamera}
            className="flex-1 p-3 rounded-xl border-2 border-[#344054] text-[#98A2B3] active:bg-[#1F2937]"
          >
            🎥 Grabar nuevo
          </button>
          <button
            type="button"
            onClick={deleteVideo}
            className="flex-1 p-3 rounded-xl border-2 border-[#E10600]/50 text-[#E10600] active:bg-[#E10600]/10"
          >
            🗑️ Eliminar video
          </button>
        </div>
      </div>
    );
  }

  // Idle state - show record button
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
          onClick={startCamera}
          className="w-full p-6 rounded-xl border-2 border-dashed border-[#E10600]/50 bg-[#E10600]/10 text-[#E10600] active:bg-[#E10600]/20 flex flex-col items-center"
        >
          <span className="text-4xl mb-2">🎥</span>
          <span className="font-medium">Grabar video de presentación</span>
          <span className="text-sm text-[#FF6A00] mt-1">Máximo {maxDuration} segundos</span>
        </button>
      </div>
    );
  }

  // Preview / Recording / Recorded state - Show as fullscreen modal
  if (mode === 'preview' || mode === 'recording' || (mode === 'recorded' && recordedUrl)) {
    return (
      <>
        {/* Placeholder in form to maintain layout */}
        <div className="w-full p-6 rounded-xl border-2 border-dashed border-[#344054] bg-[#1F2937]/50 flex flex-col items-center">
          <span className="text-4xl mb-2">🎥</span>
          <span className="font-medium text-[#98A2B3]">Grabando video...</span>
        </div>

        {/* Fullscreen Modal Overlay */}
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            {/* Header */}
            <div className="text-center mb-4">
              <h3 className="text-white text-lg font-semibold">
                {mode === 'recorded' ? 'Vista previa' : 'Video de presentación'}
              </h3>
              <p className="text-[#98A2B3] text-sm mt-1">
                {mode === 'preview' && 'Tocá el botón rojo para grabar'}
                {mode === 'recording' && 'Grabando... Tocá para detener'}
                {mode === 'recorded' && 'Revisá tu video antes de confirmar'}
              </p>
            </div>

            {/* Video Container */}
            <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl">
              {mode === 'recorded' && recordedUrl ? (
                <video
                  src={recordedUrl}
                  controls
                  className="w-full aspect-[9/16] max-h-[60vh] object-cover"
                  playsInline
                />
              ) : (
                <video
                  ref={videoRef}
                  className="w-full aspect-[9/16] max-h-[60vh] object-cover -scale-x-100"
                  autoPlay
                  playsInline
                  muted
                />
              )}

              {/* Recording indicator */}
              {mode === 'recording' && (
                <div className="absolute top-4 left-4 flex items-center bg-[#E10600] text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-lg">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                  {timeLeft}s
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="mt-6">
              {mode === 'preview' && (
                <div className="flex justify-center gap-6">
                  <button
                    onClick={cancelRecording}
                    className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center text-white active:scale-95 border border-white/20"
                  >
                    <span className="text-xl">✕</span>
                  </button>
                  <button
                    onClick={startRecording}
                    className="w-20 h-20 bg-[#E10600] rounded-full flex items-center justify-center text-white active:scale-95 border-4 border-white shadow-lg"
                  >
                    <div className="w-7 h-7 bg-white rounded-full" />
                  </button>
                  <div className="w-14 h-14" /> {/* Spacer for symmetry */}
                </div>
              )}

              {mode === 'recording' && (
                <div className="flex justify-center">
                  <button
                    onClick={stopRecording}
                    className="w-20 h-20 bg-[#E10600] rounded-full flex items-center justify-center text-white active:scale-95 border-4 border-white shadow-lg animate-pulse"
                  >
                    <div className="w-7 h-7 bg-white rounded-sm" />
                  </button>
                </div>
              )}

              {mode === 'recorded' && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={retryRecording}
                    className="flex-1 py-4 rounded-xl border-2 border-[#344054] text-[#98A2B3] font-medium active:bg-[#1F2937]"
                  >
                    🔄 Grabar otro
                  </button>
                  <button
                    type="button"
                    onClick={confirmVideo}
                    className="flex-1 py-4 rounded-xl bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium active:scale-[0.98]"
                  >
                    ✓ Usar este
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  return null;
}
