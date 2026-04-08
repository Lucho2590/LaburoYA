'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthLayout } from '@/components/AuthLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';

export default function BasicInfoPage() {
  const router = useRouter();
  const { user, userData, loading, refreshUserData } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const isEmployer = userData?.role === 'employer';

  // Worker fields
  const [workerData, setWorkerData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    age: '',
    nickname: '',
  });

  // Employer fields
  const [employerData, setEmployerData] = useState({
    businessName: '',
    contactName: '',
    phone: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    if (!loading && !userData?.role) {
      router.push('/onboarding');
    }
  }, [loading, user, userData, router]);

  const handleWorkerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setWorkerData(prev => ({ ...prev, [name]: value }));
  };

  const handleEmployerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEmployerData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEmployer) {
      if (!employerData.businessName.trim() || !employerData.contactName.trim()) {
        toast.error('Nombre de empresa y responsable son obligatorios');
        return;
      }
    } else {
      if (!workerData.firstName.trim() || !workerData.lastName.trim()) {
        toast.error('Nombre y apellido son obligatorios');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (isEmployer) {
        await api.updateBasicInfo({
          firstName: employerData.contactName.trim(),
          lastName: '',
          phone: employerData.phone.trim() || undefined,
          businessName: employerData.businessName.trim(),
          contactName: employerData.contactName.trim(),
        });
      } else {
        await api.updateBasicInfo({
          firstName: workerData.firstName.trim(),
          lastName: workerData.lastName.trim(),
          phone: workerData.phone.trim() || undefined,
          age: workerData.age ? parseInt(workerData.age) : undefined,
          nickname: workerData.nickname.trim() || undefined,
        });
      }

      await refreshUserData();
      toast.success('¡Datos guardados!');
      router.push('/home');
    } catch (error) {
      toast.error('Error al guardar los datos');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#E10600]"></div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-3 rounded-xl border-2 theme-border theme-bg-card theme-text-primary focus:border-[#E10600] focus:outline-none transition-colors";

  return (
    <AuthLayout>
      <div className="min-h-screen md:min-h-0 flex flex-col">
        {/* Header */}
        <div className="px-6 pt-16 pb-8 text-center">
          <span className="text-5xl">{isEmployer ? '🏢' : '📝'}</span>
          <h1 className="text-2xl font-bold theme-text-primary mt-4">
            {isEmployer ? 'Datos de tu empresa' : 'Contanos sobre vos'}
          </h1>
          <p className="theme-text-secondary mt-2">
            {isEmployer ? 'Completá los datos de tu negocio' : 'Completá tus datos básicos'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 px-6 space-y-5">
          {isEmployer ? (
            <>
              {/* Nombre de empresa */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Nombre de la empresa *
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={employerData.businessName}
                  onChange={handleEmployerChange}
                  placeholder="Ej: Restaurante Don Julio"
                  className={inputClass}
                  required
                />
              </div>

              {/* Responsable */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Nombre del responsable *
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={employerData.contactName}
                  onChange={handleEmployerChange}
                  placeholder="Nombre de quien administra la cuenta"
                  className={inputClass}
                  required
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Teléfono de contacto
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={employerData.phone}
                  onChange={handleEmployerChange}
                  placeholder="Ej: 2234567890"
                  className={inputClass}
                />
                <p className="text-xs theme-text-muted mt-1">
                  Opcional - Para que los candidatos puedan contactarte
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Nombre *
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={workerData.firstName}
                  onChange={handleWorkerChange}
                  placeholder="Tu nombre"
                  className={inputClass}
                  required
                />
              </div>

              {/* Apellido */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Apellido *
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={workerData.lastName}
                  onChange={handleWorkerChange}
                  placeholder="Tu apellido"
                  className={inputClass}
                  required
                />
              </div>

              {/* Teléfono */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Teléfono
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={workerData.phone}
                  onChange={handleWorkerChange}
                  placeholder="Ej: 2234567890"
                  className={inputClass}
                />
                <p className="text-xs theme-text-muted mt-1">
                  Opcional - Para que puedan contactarte
                </p>
              </div>

              {/* Edad */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  Edad
                </label>
                <input
                  type="number"
                  name="age"
                  value={workerData.age}
                  onChange={handleWorkerChange}
                  placeholder="Tu edad"
                  min="16"
                  max="99"
                  className={inputClass}
                />
              </div>

              {/* Sobrenombre */}
              <div>
                <label className="block text-sm font-medium theme-text-secondary mb-2">
                  ¿Cómo te gusta que te digan?
                </label>
                <input
                  type="text"
                  name="nickname"
                  value={workerData.nickname}
                  onChange={handleWorkerChange}
                  placeholder="Tu sobrenombre o apodo"
                  className={inputClass}
                />
                <p className="text-xs theme-text-muted mt-1">
                  Opcional - Si no lo completás, usaremos tu nombre
                </p>
              </div>
            </>
          )}

          {/* Submit Button */}
          <div className="pt-4 pb-8">
            <button
              type="submit"
              disabled={
                submitting ||
                (isEmployer
                  ? !employerData.businessName || !employerData.contactName
                  : !workerData.firstName || !workerData.lastName)
              }
              className="w-full py-4 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></span>
                  Guardando...
                </span>
              ) : (
                'Continuar'
              )}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
