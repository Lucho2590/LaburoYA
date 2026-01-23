'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, userData, loading, setRole } = useAuth();
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && userData?.role) {
      router.push('/home');
    }
  }, [loading, user, userData, router]);

  const handleSelectRole = async (role: 'worker' | 'employer') => {
    setSelecting(true);
    try {
      await setRole(role);
      router.push(role === 'worker' ? '/worker/profile' : '/employer/profile');
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSelecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-16 pb-8 text-center">
        <span className="text-5xl">👋</span>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">¡Bienvenido!</h1>
        <p className="text-gray-500 mt-2">¿Qué estás buscando?</p>
      </div>

      {/* Options */}
      <div className="flex-1 px-6 space-y-4">
        {/* Worker */}
        <button
          onClick={() => handleSelectRole('worker')}
          disabled={selecting}
          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-6 text-left active:scale-[0.98] active:border-blue-500 transition-all disabled:opacity-50"
        >
          <div className="flex items-start">
            <span className="text-4xl mr-4">💼</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Busco trabajo</h2>
              <p className="text-gray-500 mt-1">
                Quiero encontrar oportunidades laborales
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Creá tu perfil</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Subí un video</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Recibí ofertas</span>
              </div>
            </div>
          </div>
        </button>

        {/* Employer */}
        <button
          onClick={() => handleSelectRole('employer')}
          disabled={selecting}
          className="w-full bg-white border-2 border-gray-200 rounded-2xl p-6 text-left active:scale-[0.98] active:border-green-500 transition-all disabled:opacity-50"
        >
          <div className="flex items-start">
            <span className="text-4xl mr-4">🏢</span>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Busco empleados</h2>
              <p className="text-gray-500 mt-1">
                Quiero encontrar trabajadores para mi negocio
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Publicá ofertas</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Mirá videos</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Encontrá candidatos</span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-8 text-center">
        <p className="text-sm text-gray-400">
          Mar del Plata, Argentina
        </p>
      </div>
    </div>
  );
}
