'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  // If logged in, redirect to home
  if (user) {
    return (
      <div className="min-h-screen theme-bg-primary flex flex-col items-center justify-center px-6">
        <span className="text-6xl mb-4">👋</span>
        <h1 className="text-2xl font-bold theme-text-primary">¡Ya tenés sesión!</h1>
        <Link href="/home" className="mt-6">
          <button className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white px-8 py-4 rounded-xl font-semibold active:scale-95 transition-transform">
            Ir al inicio
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen theme-bg-primary flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <span className="text-7xl">🤝</span>
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent mb-3">
          LaburoYA
        </h1>

        <p className="text-lg theme-text-secondary mb-2">
          Encontrá trabajo en
        </p>
        <p className="text-2xl font-semibold text-[#FFB703] mb-8">
          Mar del Plata
        </p>

        {/* Features */}
        <div className="flex justify-center gap-4 mb-12">
          <div className="text-center">
            <div className="w-14 h-14 theme-bg-card rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-xs theme-text-secondary">Rápido</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 theme-bg-card rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">🎯</span>
            </div>
            <p className="text-xs theme-text-secondary">Matching</p>
          </div>
          <div className="text-center">
            <div className="w-14 h-14 theme-bg-card rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">💬</span>
            </div>
            <p className="text-xs theme-text-secondary">Chat</p>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div className="px-6 pb-12 space-y-3">
        <Link href="/register" className="block">
          <button className="w-full bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform">
            Empezar
          </button>
        </Link>

        <Link href="/login" className="block">
          <button className="w-full theme-bg-card theme-text-primary py-4 rounded-xl font-semibold active:scale-[0.98] transition-transform border theme-border">
            Ya tengo cuenta
          </button>
        </Link>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-sm theme-text-muted">
          Conectando talento con oportunidades
        </p>
      </div>
    </div>
  );
}
