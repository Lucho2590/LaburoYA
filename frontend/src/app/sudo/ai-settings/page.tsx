'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { PinModal } from '@/components/PinModal';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Bot, Eye, Copy, Pencil, AlertCircle, RotateCcw } from 'lucide-react';

type Provider = 'claude' | 'openai' | 'gemini';
type Tab = 'config' | 'prompt';

const PROVIDER_LABELS: Record<Provider, string> = {
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
};

const PROVIDER_HINTS: Record<Provider, string> = {
  claude: 'Costo estimado: ~$0.01 por CV (Sonnet 4.6).',
  openai: 'Costo estimado: ~$0.001-0.005 por CV (gpt-4o-mini).',
  gemini: 'Costo estimado: ~$0.001 por CV (Gemini 1.5 Flash).',
};

type AiPrompts = {
  parse: string;
  assess: string;
  defaults: { parse: string; assess: string };
  isCustom: { parse: boolean; assess: boolean };
};

type PromptKey = 'parse' | 'assess';

const PROMPT_META: Record<PromptKey, { title: string; description: string }> = {
  parse: {
    title: 'Prompt de parseo (extracción de datos)',
    description: 'Indica a la IA cómo extraer nombre, rubro, puesto, zona, skills y experiencia desde el texto del CV.',
  },
  assess: {
    title: 'Prompt de análisis (evaluación de candidato)',
    description: 'Indica a la IA cómo evaluar si un candidato encaja en una búsqueda: fitScore, recomendación, fortalezas y gaps.',
  },
};

export default function AiSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [pinSet, setPinSet] = useState(false);
  const [tab, setTab] = useState<Tab>('config');

  // Config tab state
  const [provider, setProvider] = useState<Provider | null>(null);
  const [apiKeyMasked, setApiKeyMasked] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [savingProvider, setSavingProvider] = useState(false);

  // Prompt tab state
  const [prompts, setPrompts] = useState<AiPrompts | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<PromptKey | null>(null);
  const [promptDraft, setPromptDraft] = useState('');

  const [pinModal, setPinModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onVerified: (token: string) => void | Promise<void>;
  } | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      const [configRes, pinRes, promptsRes] = await Promise.all([
        api.getAdminAiConfig(),
        api.getAdminPinStatus(),
        api.getAdminAiPrompts(),
      ]);
      setProvider(configRes.provider);
      setApiKeyMasked(configRes.apiKeyMasked);
      setPinSet(pinRes.isSet);
      setPrompts(promptsRes);
    } catch (error) {
      const err = error as Error;
      toast.error(err.message || 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  };

  const requirePin = (title: string, description: string, action: (token: string) => void | Promise<void>) => {
    if (!pinSet) {
      toast.error('Configurá un PIN primero en /sudo/security');
      return;
    }
    setPinModal({ open: true, title, description, onVerified: action });
  };

  const handleProviderChange = async (newProvider: Provider) => {
    if (newProvider === provider) return;
    setSavingProvider(true);
    requirePin(
      'Cambiar provider de IA',
      `Vas a cambiar el provider activo a ${PROVIDER_LABELS[newProvider]}.`,
      async (token) => {
        try {
          await api.updateAdminAiConfig(token, { provider: newProvider });
          toast.success('Provider actualizado');
          setProvider(newProvider);
          setRevealedKey(null);
          await load();
        } catch (error) {
          const err = error as Error;
          toast.error(err.message || 'Error al cambiar provider');
        } finally {
          setSavingProvider(false);
        }
      }
    );
    // setSavingProvider stays true until modal completes; reset on cancel:
    setTimeout(() => setSavingProvider(false), 100);
  };

  const handleReveal = () => {
    requirePin('Ver API key', 'Ingresá tu PIN para mostrar la API key en pantalla.', async (token) => {
      try {
        const { apiKey } = await api.revealAdminAiKey(token);
        setRevealedKey(apiKey);
        setTimeout(() => setRevealedKey(null), 30_000);
      } catch (error) {
        const err = error as Error;
        toast.error(err.message || 'Error al obtener API key');
      }
    });
  };

  const handleCopy = () => {
    requirePin('Copiar API key', 'Ingresá tu PIN para copiar la API key al portapapeles.', async (token) => {
      try {
        const { apiKey } = await api.revealAdminAiKey(token);
        await navigator.clipboard.writeText(apiKey);
        toast.success('API key copiada al portapapeles');
      } catch (error) {
        const err = error as Error;
        toast.error(err.message || 'Error al copiar API key');
      }
    });
  };

  const handleSaveNewKey = async () => {
    if (!newApiKey.trim()) {
      toast.error('Ingresá una API key');
      return;
    }
    requirePin(
      'Guardar nueva API key',
      'Ingresá tu PIN para guardar la nueva API key (la anterior se reemplaza).',
      async (token) => {
        try {
          await api.updateAdminAiConfig(token, { apiKey: newApiKey.trim() });
          toast.success('API key actualizada');
          setNewApiKey('');
          setEditing(false);
          setRevealedKey(null);
          await load();
        } catch (error) {
          const err = error as Error;
          toast.error(err.message || 'Error al guardar API key');
        }
      }
    );
  };

  const startEditPrompt = (key: PromptKey) => {
    if (!pinSet) {
      toast.error('Configurá un PIN primero en /sudo/security');
      return;
    }
    if (!prompts) return;
    setEditingPrompt(key);
    setPromptDraft(prompts[key]);
  };

  const cancelEditPrompt = () => {
    setEditingPrompt(null);
    setPromptDraft('');
  };

  const handleSavePrompt = (key: PromptKey) => {
    if (!promptDraft.trim()) {
      toast.error('El prompt no puede estar vacío');
      return;
    }
    requirePin(
      `Guardar ${key === 'parse' ? 'prompt de parseo' : 'prompt de análisis'}`,
      'Ingresá tu PIN para guardar el prompt. La IA lo usará en las próximas operaciones.',
      async (token) => {
        try {
          const payload = key === 'parse' ? { parsePrompt: promptDraft } : { assessPrompt: promptDraft };
          const updated = await api.updateAdminAiPrompts(token, payload);
          setPrompts(updated);
          setEditingPrompt(null);
          setPromptDraft('');
          toast.success('Prompt actualizado');
        } catch (error) {
          const err = error as Error;
          toast.error(err.message || 'Error al guardar el prompt');
        }
      }
    );
  };

  const handleResetPrompt = (key: PromptKey) => {
    requirePin(
      `Restaurar ${key === 'parse' ? 'prompt de parseo' : 'prompt de análisis'}`,
      'Ingresá tu PIN para volver al prompt por defecto (se descarta la versión personalizada).',
      async (token) => {
        try {
          const payload = key === 'parse' ? { parsePrompt: null } : { assessPrompt: null };
          const updated = await api.updateAdminAiPrompts(token, payload);
          setPrompts(updated);
          if (editingPrompt === key) {
            setEditingPrompt(null);
            setPromptDraft('');
          }
          toast.success('Prompt restaurado al valor por defecto');
        } catch (error) {
          const err = error as Error;
          toast.error(err.message || 'Error al restaurar el prompt');
        }
      }
    );
  };

  return (
    <AdminLayout title="Configuración de IA">
      <div className={`${tab === 'prompt' ? 'w-full' : 'max-w-2xl'} space-y-6`}>
        <div className="theme-bg-card rounded-xl p-6 border theme-border">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#E10600] to-[#FF6A00] rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold theme-text-primary">Inteligencia Artificial</h1>
              <p className="text-sm theme-text-secondary">
                Configurá el proveedor y la API key, y administrá los prompts que usa la IA con los CVs.
              </p>
            </div>
          </div>
        </div>

        {!pinSet && !loading && (
          <div className="theme-bg-card rounded-xl p-4 border-2 border-amber-400 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold theme-text-primary">Falta configurar el PIN</p>
              <p className="theme-text-secondary mt-1">
                Antes de poder cambiar la configuración o los prompts, necesitás{' '}
                <Link href="/sudo/security" className="text-[#E10600] underline">
                  configurar el PIN de admin
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex theme-bg-secondary rounded-xl p-1">
          <button
            onClick={() => setTab('config')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all cursor-pointer ${
              tab === 'config' ? 'theme-bg-card theme-text-primary shadow-sm' : 'theme-text-secondary'
            }`}
          >
            Configuración
          </button>
          <button
            onClick={() => setTab('prompt')}
            className={`flex-1 py-2.5 rounded-lg font-medium text-sm transition-all cursor-pointer ${
              tab === 'prompt' ? 'theme-bg-card theme-text-primary shadow-sm' : 'theme-text-secondary'
            }`}
          >
            Prompt
          </button>
        </div>

        {loading ? (
          <div className="theme-bg-card rounded-xl p-6 border theme-border">
            <p className="theme-text-secondary">Cargando...</p>
          </div>
        ) : tab === 'config' ? (
          <>
            <div className="theme-bg-card rounded-xl p-6 border theme-border">
              <h2 className="text-lg font-semibold theme-text-primary mb-3">Provider activo</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(['claude', 'openai', 'gemini'] as Provider[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    disabled={savingProvider}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                      provider === p
                        ? 'border-[#E10600] bg-[#E10600]/5'
                        : 'theme-border hover:border-gray-400'
                    }`}
                  >
                    <p className="font-medium theme-text-primary">{PROVIDER_LABELS[p]}</p>
                    <p className="text-xs theme-text-muted mt-1">{PROVIDER_HINTS[p]}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-bg-card rounded-xl p-6 border theme-border">
              <h2 className="text-lg font-semibold theme-text-primary mb-3">API key</h2>

              {!editing ? (
                <>
                  <div className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg theme-text-primary break-all">
                    {revealedKey || apiKeyMasked || '(sin configurar)'}
                  </div>
                  {revealedKey && (
                    <p className="text-xs theme-text-muted mt-1">
                      Se vuelve a ocultar automáticamente en 30 segundos.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-4">
                    <button
                      onClick={handleReveal}
                      disabled={!apiKeyMasked || !pinSet}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border theme-border theme-text-primary hover:theme-bg-primary cursor-pointer disabled:opacity-50"
                    >
                      <Eye className="w-4 h-4" /> Ver
                    </button>
                    <button
                      onClick={handleCopy}
                      disabled={!apiKeyMasked || !pinSet}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border theme-border theme-text-primary hover:theme-bg-primary cursor-pointer disabled:opacity-50"
                    >
                      <Copy className="w-4 h-4" /> Copiar
                    </button>
                    <button
                      onClick={() => {
                        if (!pinSet) {
                          toast.error('Configurá un PIN primero en /sudo/security');
                          return;
                        }
                        setEditing(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" /> {apiKeyMasked ? 'Cambiar' : 'Configurar'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Pegá la API key acá"
                    className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none font-mono text-sm"
                    autoComplete="off"
                  />
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => {
                        setEditing(false);
                        setNewApiKey('');
                      }}
                      className="px-4 py-2 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleSaveNewKey}
                      disabled={!newApiKey.trim()}
                      className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium disabled:opacity-50 cursor-pointer"
                    >
                      Guardar
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {prompts && (['parse', 'assess'] as PromptKey[]).map((key) => {
              const meta = PROMPT_META[key];
              const isEditing = editingPrompt === key;
              const isCustom = prompts.isCustom[key];
              return (
                <div key={key} className="theme-bg-card rounded-xl p-6 border theme-border">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h2 className="text-lg font-semibold theme-text-primary">{meta.title}</h2>
                    <span
                      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${
                        isCustom
                          ? 'bg-[#E10600]/10 text-[#E10600]'
                          : 'theme-bg-secondary theme-text-muted'
                      }`}
                    >
                      {isCustom ? 'Personalizado' : 'Por defecto'}
                    </span>
                  </div>
                  <p className="text-sm theme-text-secondary mb-3">{meta.description}</p>

                  {!isEditing ? (
                    <>
                      <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-100 dark:bg-gray-800 px-4 py-3 rounded-lg theme-text-primary max-h-80 overflow-auto">
                        {prompts[key]}
                      </pre>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() => startEditPrompt(key)}
                          disabled={!pinSet}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium cursor-pointer disabled:opacity-50"
                        >
                          <Pencil className="w-4 h-4" /> Editar
                        </button>
                        {isCustom && (
                          <button
                            onClick={() => handleResetPrompt(key)}
                            disabled={!pinSet}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg border theme-border theme-text-primary hover:theme-bg-primary cursor-pointer disabled:opacity-50"
                          >
                            <RotateCcw className="w-4 h-4" /> Restaurar default
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <textarea
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        rows={14}
                        className="w-full px-4 py-3 rounded-xl border theme-border theme-bg-primary theme-text-primary focus:border-[#E10600] focus:outline-none font-mono text-sm"
                      />
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={cancelEditPrompt}
                          className="px-4 py-2 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleSavePrompt(key)}
                          disabled={!promptDraft.trim()}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white font-medium disabled:opacity-50 cursor-pointer"
                        >
                          Guardar
                        </button>
                        <button
                          onClick={() => setPromptDraft(prompts.defaults[key])}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg border theme-border theme-text-primary hover:theme-bg-primary cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" /> Cargar default
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {pinModal && (
        <PinModal
          open={pinModal.open}
          title={pinModal.title}
          description={pinModal.description}
          onClose={() => setPinModal(null)}
          onVerified={pinModal.onVerified}
        />
      )}
    </AdminLayout>
  );
}
