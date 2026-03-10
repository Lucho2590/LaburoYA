"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { JOB_CATEGORIES } from "@/config/constants";
import { WaitlistModal } from "@/components/WaitlistModal";
import {
  MessageCircle,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  Star,
  Zap,
  Target,
  Video,
  Bell,
  Download,
} from "lucide-react";

export default function LandingPage() {
  const [showWaitlistModal, setShowWaitlistModal] = useState(false);
  const { user, loading } = useAuth();

  // Show modal on first visit
  useEffect(() => {
    const hasSeenModal = localStorage.getItem("waitlistModalShown");
    if (!hasSeenModal) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        setShowWaitlistModal(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const rubrosEmojis: Record<string, string> = {
    gastronomia: "🍳",
    comercio: "🏪",
    construccion: "🏗️",
    limpieza: "🧹",
    transporte: "🚗",
    administracion: "💼",
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Waitlist Modal */}
      <WaitlistModal
        isOpen={showWaitlistModal}
        onClose={() => setShowWaitlistModal(false)}
      />
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <span className="text-xl font-bold bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent">
                LaburoYA
              </span>
            </Link>
            <div className="flex items-center gap-3">
              {loading ? (
                <div className="w-8 h-8 animate-spin rounded-full border-2 border-gray-300 border-t-[#E10600]"></div>
              ) : user ? (
                <Link href="/home">
                  <button className="px-6 py-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
                    Ir a la app
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Link>
              ) : (
                <button
                  onClick={() => setShowWaitlistModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                  <Bell className="h-4 w-4" />
                  Avisame
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 px-4 sm:px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Zap className="h-4 w-4" />
                La forma más rápida de encontrar trabajo
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                Encontrá trabajo en{" "}
                <span className="bg-gradient-to-r from-[#E10600] to-[#FF6A00] bg-clip-text text-transparent">
                  Mar del Plata
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                Conectamos trabajadores con empleadores de forma rápida y
                sencilla. Creá tu perfil, mostrá tus habilidades y empezá a
                trabajar.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => setShowWaitlistModal(true)}
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Bell className="h-5 w-5" />
                  Avisame cuando esté listo
                </button>
                {user && (
                  <Link href="/home">
                    <button className="w-full sm:w-auto px-8 py-4 bg-gray-100 text-gray-700 rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all flex items-center justify-center gap-2">
                      Ir a la app
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </Link>
                )}
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-6 mt-8 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>100% Gratis</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span>Sin intermediarios</span>
                </div>
              </div>
            </div>

            {/* Phone Mockup */}
            <div className="relative flex justify-center lg:justify-end overflow-hidden">
              <div className="relative">
                {/* Phone Frame */}
                <div className="w-[280px] sm:w-[320px] h-[560px] sm:h-[640px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
                  <div className="w-full h-full bg-gradient-to-b from-[#E10600] to-[#FF6A00] rounded-[2.5rem] overflow-hidden relative">
                    {/* Notch */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-2xl"></div>

                    {/* App Content Preview */}
                    <div className="pt-12 px-4 text-white">
                      <div className="text-center mb-6">
                        <h3 className="text-2xl font-bold">LaburoYA</h3>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                              🍳
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                Mozo - Centro
                              </p>
                              <p className="text-xs text-white/70">
                                Match completo
                              </p>
                            </div>
                            <div className="ml-auto">
                              <span className="text-xs bg-green-500 px-2 py-1 rounded-full">
                                98 pts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                              🏪
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                Vendedor - Güemes
                              </p>
                              <p className="text-xs text-white/70">
                                3 skills coinciden
                              </p>
                            </div>
                            <div className="ml-auto">
                              <span className="text-xs bg-yellow-500 px-2 py-1 rounded-full">
                                72 pts
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white/20 backdrop-blur rounded-xl p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                              💼
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                Administrativo
                              </p>
                              <p className="text-xs text-white/70">
                                Match parcial
                              </p>
                            </div>
                            <div className="ml-auto">
                              <span className="text-xs bg-blue-500 px-2 py-1 rounded-full">
                                55 pts
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 text-center">
                        <button className="bg-white text-[#E10600] px-6 py-3 rounded-xl font-semibold text-sm">
                          Me interesa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-20 h-20 bg-orange-200 rounded-full blur-2xl opacity-60"></div>
                <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-red-200 rounded-full blur-2xl opacity-60"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              ¿Cómo funciona?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              En tres simples pasos empezás a conectar con oportunidades
              laborales
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-r from-[#E10600] to-[#FF6A00] rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Creá tu perfil
                </h3>
                <p className="text-gray-600">
                  Elegí tu rubro, puesto y zona. Agregá tus habilidades y grabá
                  un video de presentación.
                </p>
              </div>
              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-gray-300">
                <ArrowRight className="h-8 w-8" />
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-r from-[#FF6A00] to-[#FFB703] rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Descubrí oportunidades
                </h3>
                <p className="text-gray-600">
                  Explorá ofertas ordenadas por relevancia. Mirá las que mejor
                  coinciden con tu perfil.
                </p>
              </div>
              {/* Arrow */}
              <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 text-gray-300">
                <ArrowRight className="h-8 w-8" />
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 text-center h-full">
                <div className="w-16 h-16 bg-gradient-to-r from-[#22C55E] to-[#10B981] rounded-2xl flex items-center justify-center mx-auto mb-6 text-white text-2xl font-bold">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Hacé Match y chateá
                </h3>
                <p className="text-gray-600">
                  Cuando ambos expresan interés, se habilita el chat. ¡Coordiná
                  directamente!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For Who Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              ¿Para quién es LaburoYA?
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Workers */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
                  <Users className="h-7 w-7 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Trabajadores
                </h3>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Creá tu perfil con tus habilidades y experiencia
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Grabá un video de presentación para destacarte
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Recibí ofertas que coinciden con tu perfil
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Chateá directo con los empleadores
                  </span>
                </li>
              </ul>

              <button
                onClick={() => setShowWaitlistModal(true)}
                className="w-full py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Bell className="h-5 w-5" />
                Avisame cuando esté listo
              </button>
            </div>

            {/* Employers */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Briefcase className="h-7 w-7 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">
                  Empleadores
                </h3>
              </div>

              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Publicá ofertas con las habilidades que necesitás
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Encontrá candidatos ordenados por relevancia
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Mirá los videos de presentación antes de contactar
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600">
                    Coordiná entrevistas por chat
                  </span>
                </li>
              </ul>

              <button
                onClick={() => setShowWaitlistModal(true)}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Bell className="h-5 w-5" />
                Próximamente
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Rubros Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Rubros disponibles
            </h2>
            <p className="text-lg text-gray-600">
              Encontrá oportunidades en los principales sectores de Mar del
              Plata
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(JOB_CATEGORIES).map(([key, value]) => (
              <div
                key={key}
                className="bg-white border border-gray-200 rounded-2xl p-6 text-center hover:border-[#E10600] hover:shadow-md transition-all cursor-pointer group"
              >
                <span className="text-4xl mb-3 block group-hover:scale-110 transition-transform">
                  {rubrosEmojis[key]}
                </span>
                <span className="font-medium text-gray-700 group-hover:text-[#E10600] transition-colors">
                  {value.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Matching System Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Target className="h-4 w-4" />
              Sistema inteligente
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Como Tinder, pero para trabajo
            </h2>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Nuestro algoritmo ordena los resultados por relevancia para que
              veas primero lo que más te conviene
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Match Completo</h3>
              <p className="text-gray-300 text-sm">
                Mismo rubro, puesto y zona. La coincidencia perfecta.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Match Parcial</h3>
              <p className="text-gray-300 text-sm">
                Mismo rubro y puesto, diferente zona. Muy buena opción.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Match por Skills</h3>
              <p className="text-gray-300 text-sm">
                Tus habilidades coinciden con lo que buscan.
              </p>
            </div>
          </div>

          <div className="mt-12 text-center px-4">
            <div className="inline-flex flex-wrap items-center justify-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-4 sm:px-6 py-4 max-w-full">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">👤</span>
                <span className="text-xs sm:text-sm">Trabajador</span>
              </div>
              <span className="text-xl sm:text-2xl">+</span>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">🏢</span>
                <span className="text-xs sm:text-sm">Empleador</span>
              </div>
              <span className="text-xl sm:text-2xl">=</span>
              <div className="flex items-center gap-2 bg-green-500 px-3 sm:px-4 py-2 rounded-xl">
                <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-sm sm:text-base font-semibold">
                  ¡Chat!
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitás
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl border border-gray-200 hover:border-[#E10600] transition-colors">
              <Video className="h-10 w-10 text-[#E10600] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Video CV</h3>
              <p className="text-sm text-gray-600">
                Destacate con un video de presentación de 45 segundos
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 hover:border-[#E10600] transition-colors">
              <Target className="h-10 w-10 text-[#E10600] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Matching inteligente
              </h3>
              <p className="text-sm text-gray-600">
                Algoritmo que ordena por relevancia y habilidades
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 hover:border-[#E10600] transition-colors">
              <MessageCircle className="h-10 w-10 text-[#E10600] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Chat directo</h3>
              <p className="text-sm text-gray-600">
                Comunicación directa sin intermediarios
              </p>
            </div>

            <div className="p-6 rounded-2xl border border-gray-200 hover:border-[#E10600] transition-colors">
              <Bell className="h-10 w-10 text-[#E10600] mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">
                Notificaciones
              </h3>
              <p className="text-sm text-gray-600">
                Enterate al instante cuando hay interés mutuo
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Download App Section */}
      <section
        id="descargar"
        className="py-16 sm:py-24 px-4 sm:px-6 bg-gradient-to-br from-[#E10600] to-[#FF6A00]"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white text-center lg:text-left">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Descargá la app
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-lg mx-auto lg:mx-0">
                Llevá LaburoYA en tu bolsillo. Recibí notificaciones push y
                accedé rápidamente desde tu celular.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                {/* App Store Button */}
                <a
                  href="https://apps.apple.com/app/laburoya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-900 transition-colors"
                >
                  <svg
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">Descargá en</div>
                    <div className="text-lg font-semibold">App Store</div>
                  </div>
                </a>

                {/* Google Play Button */}
                <a
                  href="https://play.google.com/store/apps/details?id=com.laburoya"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-900 transition-colors"
                >
                  <svg
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-xs text-gray-400">Disponible en</div>
                    <div className="text-lg font-semibold">Google Play</div>
                  </div>
                </a>
              </div>

              <div className="flex items-center justify-center lg:justify-start gap-6 text-white/80 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Notificaciones push</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Acceso rápido</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Gratis</span>
                </div>
              </div>
            </div>

            {/* Phone illustration */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                <div className="w-64 h-[500px] bg-white/10 backdrop-blur rounded-[3rem] p-2 shadow-2xl">
                  <div className="w-full h-full bg-white rounded-[2.5rem] flex items-center justify-center">
                    <div className="text-center">
                      <Download className="h-16 w-16 text-[#E10600] mx-auto mb-4" />
                      <p className="text-gray-600 font-medium">Escaneá el QR</p>
                      <p className="text-gray-400 text-sm">para descargar</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            ¿Buscás trabajo?
          </h2>
          <p className="text-lg text-gray-600 mb-8">
            Dejanos tus datos y te avisamos cuando tengamos ofertas para vos
          </p>
          <button
            onClick={() => setShowWaitlistModal(true)}
            className="px-12 py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2"
          >
            <Bell className="h-5 w-5" />
            Avisame
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                {/* <span className="text-2xl">🤝</span> */}
                <span className="text-xl font-bold">LaburoYA</span>
              </div>
              <p className="text-gray-400 text-sm">
                Conectando trabajadores con oportunidades en Mar del Plata
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="font-semibold mb-4">Plataforma</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <button
                    onClick={() => setShowWaitlistModal(true)}
                    className="hover:text-white transition-colors"
                  >
                    Avisame cuando esté listo
                  </button>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Cómo funciona
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Términos y condiciones
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Política de privacidad
                  </a>
                </li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="font-semibold mb-4">Seguinos</h4>
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/laburoya.mdq/"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </a>
                <a
                  href="#"
                  className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center text-gray-400 text-sm">
            <p>© 2026 LaburoYA. Todos los derechos reservados.</p>
            <p className="mt-1">Hecho con ❤️ en Mar del Plata, Argentina</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
