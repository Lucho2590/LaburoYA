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
            className="flex-1 p-3 rounded-xl border-2 border-gray-300 text-gray-600 active:bg-gray-50"
          >
            🎥 Grabar nuevo
          </button>
          <button
            type="button"
            onClick={deleteVideo}
            className="flex-1 p-3 rounded-xl border-2 border-red-300 text-red-600 active:bg-red-50"
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
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={startCamera}
          className="w-full p-6 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 text-blue-600 active:bg-blue-100 flex flex-col items-center"
        >
          <span className="text-4xl mb-2">🎥</span>
          <span className="font-medium">Grabar video de presentación</span>
          <span className="text-sm text-blue-500 mt-1">Máximo {maxDuration} segundos</span>
        </button>
      </div>
    );
  }

  // Preview / Recording state
  if (mode === 'preview' || mode === 'recording') {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="w-full aspect-[9/16] max-h-[400px] object-cover -scale-x-100"
            autoPlay
            playsInline
            muted
          />

          {/* Recording indicator */}
          {mode === 'recording' && (
            <div className="absolute top-4 left-4 flex items-center bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
              {timeLeft}s
            </div>
          )}

          {/* Controls overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
            {mode === 'preview' ? (
              <div className="flex justify-center gap-4">
                <button
                  onClick={cancelRecording}
                  className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-white active:scale-95"
                >
                  ✕
                </button>
                <button
                  onClick={startRecording}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white active:scale-95 border-4 border-white"
                >
                  <div className="w-6 h-6 bg-white rounded-full" />
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={stopRecording}
                  className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white active:scale-95 border-4 border-white"
                >
                  <div className="w-6 h-6 bg-white rounded-sm" />
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm">
          {mode === 'preview'
            ? 'Tocá el botón rojo para grabar'
            : 'Tocá para detener la grabación'}
        </p>
      </div>
    );
  }

  // Recorded state - show preview and confirm/retry
  if (mode === 'recorded' && recordedUrl) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video
            src={recordedUrl}
            controls
            className="w-full aspect-[9/16] max-h-[400px] object-cover"
            playsInline
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={retryRecording}
            className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-medium active:bg-gray-50"
          >
            🔄 Grabar otro
          </button>
          <button
            type="button"
            onClick={confirmVideo}
            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium active:scale-[0.98]"
          >
            ✓ Usar este video
          </button>
        </div>
      </div>
    );
  }

  return null;
}
