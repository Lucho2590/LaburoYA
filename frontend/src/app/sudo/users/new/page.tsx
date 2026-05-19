'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { ArrowLeft, UserPlus, Mail, Send, Upload, FileText, Sparkles } from 'lucide-react';

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'worker' | 'employer';
  plan: 'free' | 'premium';
  rubro: string;
  puesto: string;
  zona: string;
  description: string;
  experience: string;
  skills: string;
}

const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'worker',
  plan: 'premium',
  rubro: '',
  puesto: '',
  zona: '',
  description: '',
  experience: '',
  skills: '',
};

export default function CreateUserPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);

  const [useAi, setUseAi] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [rawText, setRawText] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getAdminAiConfig()
      .then((cfg) => setAiConfigured(cfg.configured))
      .catch(() => setAiConfigured(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('El archivo debe ser un PDF');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El PDF supera el límite de 5MB');
      return;
    }

    setParsing(true);
    setRawText(null);
    try {
      const result = await api.adminParseCv(file, useAi);
      setRawText(result.rawText);
      const f = result.fields;
      setFormData((prev) => ({
        ...prev,
        firstName: f.firstName || prev.firstName,
        lastName: f.lastName || prev.lastName,
        email: f.email || prev.email,
        phone: f.phone || prev.phone,
        rubro: f.rubro || prev.rubro,
        puesto: f.puesto || prev.puesto,
        zona: f.zona || prev.zona,
        description: f.description || prev.description,
        experience: f.experience || prev.experience,
        skills: f.skills?.length ? f.skills.join(', ') : prev.skills,
      }));
      toast.success(
        result.mode === 'ai'
          ? 'CV parseado con IA. Revisá los datos antes de guardar.'
          : 'Texto extraído del PDF. Completá los campos a mano.'
      );
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al procesar el PDF');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      toast.error('Email es requerido');
      return;
    }

    setLoading(true);
    try {
      const payload: Parameters<typeof api.createAdminUser>[0] = {
        email: formData.email,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        phone: formData.phone || undefined,
        role: formData.role,
        plan: formData.plan,
      };

      if (formData.role === 'worker' && formData.rubro && formData.puesto) {
        payload.workerProfile = {
          rubro: formData.rubro,
          puesto: formData.puesto,
          zona: formData.zona || null,
          description: formData.description || null,
          experience: formData.experience || null,
          skills: formData.skills
            ? formData.skills.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
        };
      }

      const result = await api.createAdminUser(payload);
      toast.success(
        result.workerProfileCreated
          ? 'Usuario y perfil de trabajador creados. Email de invitación enviado.'
          : 'Usuario creado y email de invitación enviado'
      );
      router.push('/sudo/users');
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al crear usuario');
    } finally {
      setLoading(false);
    }
  };

  const isWorker = formData.role === 'worker';

  return (
    <AdminLayout title="Crear Usuario">
      <Link
        href="/sudo/users"
        className="inline-flex items-center gap-2 theme-text-secondary hover:theme-text-primary mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a usuarios
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="theme-bg-card rounded-xl p-6 border theme-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold theme-text-primary">Crear nuevo usuario</h1>
                <p className="text-sm theme-text-secondary">
                  Opcionalmente subí un CV en PDF para precargar los campos.
                </p>
              </div>
            </div>
          </div>

          {isWorker && (
            <div className="theme-bg-card rounded-xl p-6 border theme-border">
              <h2 className="text-lg font-semibold theme-text-primary mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#E10600]" />
                Subir CV (PDF)
              </h2>

              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(e) => setUseAi(e.target.checked)}
                  className="w-4 h-4 cursor-pointer"
                  disabled={!aiConfigured}
                />
                <span className="text-sm theme-text-primary">
                  Usar IA para parsear el CV{' '}
                  <span className="text-xs theme-text-muted">(extrae todos los campos automáticamente)</span>
                </span>
              </label>

              {!aiConfigured && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
                  La IA no está configurada.{' '}
                  <Link href="/sudo/ai-settings" className="underline">
                    Configurala acá
                  </Link>{' '}
                  para activarla.
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={parsing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed theme-border hover:border-[#E10600] cursor-pointer disabled:opacity-50"
              >
                {parsing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#E10600] border-t-transparent rounded-full animate-spin" />
                    Procesando PDF...
                  </>
                ) : (
                  <>
                    {useAi ? <Sparkles className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                    {useAi ? 'Subir y parsear con IA' : 'Subir y extraer texto'}
                  </>
                )}
              </button>
              <p className="text-xs theme-text-muted mt-2">Máximo 5MB. PDFs escaneados (imágenes) no funcionan.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="theme-bg-card rounded-xl p-6 border theme-border">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Email *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 theme-text-muted" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="usuario@ejemplo.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium theme-text-primary mb-2">Nombre</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Juan"
                    className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium theme-text-primary mb-2">Apellido</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Pérez"
                    className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Teléfono</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+54 9 223 1234567"
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Rol *</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none cursor-pointer"
                >
                  <option value="worker">Trabajador</option>
                  <option value="employer">Empleador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium theme-text-primary mb-2">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.plan === 'free'
                        ? 'border-[#E10600] bg-[#E10600]/5'
                        : 'theme-border hover:border-gray-400'
                    }`}
                  >
                    <input type="radio" name="plan" value="free" checked={formData.plan === 'free'} onChange={handleChange} className="sr-only" />
                    <div className="text-center">
                      <p className="font-medium theme-text-primary">Free</p>
                      <p className="text-xs theme-text-muted">Acceso básico</p>
                    </div>
                  </label>
                  <label
                    className={`relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      formData.plan === 'premium'
                        ? 'border-[#E10600] bg-[#E10600]/5'
                        : 'theme-border hover:border-gray-400'
                    }`}
                  >
                    <input type="radio" name="plan" value="premium" checked={formData.plan === 'premium'} onChange={handleChange} className="sr-only" />
                    <div className="text-center">
                      <p className="font-medium theme-text-primary">Premium</p>
                      <p className="text-xs theme-text-muted">Acceso completo</p>
                    </div>
                  </label>
                </div>
              </div>

              {isWorker && (
                <>
                  <div className="border-t theme-border pt-5">
                    <h3 className="text-sm font-semibold theme-text-primary mb-3">
                      Perfil de trabajador (opcional, completá si querés crear el perfil ya)
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium theme-text-primary mb-2">Rubro</label>
                        <input
                          type="text"
                          name="rubro"
                          value={formData.rubro}
                          onChange={handleChange}
                          placeholder="Gastronomía"
                          className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium theme-text-primary mb-2">Puesto</label>
                        <input
                          type="text"
                          name="puesto"
                          value={formData.puesto}
                          onChange={handleChange}
                          placeholder="Mozo"
                          className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Zona / Barrio</label>
                    <input
                      type="text"
                      name="zona"
                      value={formData.zona}
                      onChange={handleChange}
                      placeholder="Centro, Mar del Plata"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Descripción</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={2}
                      placeholder="Resumen breve del candidato"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">Experiencia</label>
                    <textarea
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      rows={3}
                      placeholder="Experiencia laboral previa"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium theme-text-primary mb-2">
                      Skills <span className="text-xs theme-text-muted">(separadas por coma)</span>
                    </label>
                    <input
                      type="text"
                      name="skills"
                      value={formData.skills}
                      onChange={handleChange}
                      placeholder="atención al cliente, manejo de caja, trabajo en equipo"
                      className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !formData.email}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white py-4 rounded-xl font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creando usuario...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Crear y enviar invitación
                </>
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 theme-bg-card rounded-xl p-4 border theme-border max-h-[calc(100vh-7rem)] flex flex-col">
            <h3 className="text-sm font-semibold theme-text-primary mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Texto del CV
            </h3>
            {rawText ? (
              <pre className="text-xs theme-text-secondary whitespace-pre-wrap font-mono overflow-y-auto flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                {rawText}
              </pre>
            ) : (
              <p className="text-xs theme-text-muted">
                Subí un PDF para ver acá el texto extraído. Útil para copiar datos a mano cuando no usás IA.
              </p>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
