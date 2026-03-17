'use client';

import { useState, useRef, useEffect } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { QrCode, Download, Copy, Check, Plus, Trash2 } from 'lucide-react';
import QRCode from 'qrcode';
import { toast } from 'sonner';

interface QRConfig {
  id: string;
  name: string;
  code: string;
  role: 'worker' | 'employer' | 'any';
  createdAt: Date;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://laburo-ya.com.ar';

export default function QRGeneratorPage() {
  const [qrConfigs, setQrConfigs] = useState<QRConfig[]>([
    { id: '1', name: 'QR Trabajadores', code: 'qr_worker', role: 'worker', createdAt: new Date() },
    { id: '2', name: 'QR Empleadores', code: 'qr_employer', role: 'employer', createdAt: new Date() },
  ]);
  const [selectedQR, setSelectedQR] = useState<QRConfig | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Form para nuevo QR
  const [showForm, setShowForm] = useState(false);
  const [newQR, setNewQR] = useState({
    name: '',
    code: '',
    role: 'any' as 'worker' | 'employer' | 'any',
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Generar QR cuando se selecciona uno
  useEffect(() => {
    if (selectedQR) {
      generateQR(selectedQR);
    }
  }, [selectedQR]);

  const getURL = (config: QRConfig) => {
    let url = `${BASE_URL}/register?ref=${config.code}`;
    if (config.role !== 'any') {
      url += `&role=${config.role}`;
    }
    return url;
  };

  const generateQR = async (config: QRConfig) => {
    const url = getURL(config);
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1a1a1a',
          light: '#ffffff',
        },
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('Error generating QR:', err);
      toast.error('Error al generar QR');
    }
  };

  const downloadQR = async () => {
    if (!selectedQR) return;

    const url = getURL(selectedQR);

    // Generar QR más grande para descarga
    const dataUrl = await QRCode.toDataURL(url, {
      width: 1024,
      margin: 2,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    });

    const link = document.createElement('a');
    link.download = `qr-${selectedQR.code}.png`;
    link.href = dataUrl;
    link.click();

    toast.success('QR descargado');
  };

  const copyURL = () => {
    if (!selectedQR) return;
    navigator.clipboard.writeText(getURL(selectedQR));
    setCopied(true);
    toast.success('URL copiada');
    setTimeout(() => setCopied(false), 2000);
  };

  const addQR = () => {
    if (!newQR.name || !newQR.code) {
      toast.error('Completá nombre y código');
      return;
    }

    // Verificar que el código no exista
    if (qrConfigs.some(q => q.code === newQR.code)) {
      toast.error('Ya existe un QR con ese código');
      return;
    }

    const config: QRConfig = {
      id: Date.now().toString(),
      name: newQR.name,
      code: newQR.code.toLowerCase().replace(/\s+/g, '_'),
      role: newQR.role,
      createdAt: new Date(),
    };

    setQrConfigs([...qrConfigs, config]);
    setSelectedQR(config);
    setNewQR({ name: '', code: '', role: 'any' });
    setShowForm(false);
    toast.success('QR creado');
  };

  const deleteQR = (id: string) => {
    setQrConfigs(qrConfigs.filter(q => q.id !== id));
    if (selectedQR?.id === id) {
      setSelectedQR(null);
      setQrDataUrl('');
    }
    toast.success('QR eliminado');
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      worker: 'bg-blue-100 text-blue-800',
      employer: 'bg-green-100 text-green-800',
      any: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      worker: 'Trabajador',
      employer: 'Empleador',
      any: 'Cualquiera',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[role]}`}>
        {labels[role]}
      </span>
    );
  };

  return (
    <AdminLayout title="Generador de QR">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de QRs */}
        <div className="lg:col-span-1">
          <div className="theme-bg-card rounded-xl border theme-border p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold theme-text-primary">Códigos QR</h2>
              <button
                onClick={() => setShowForm(!showForm)}
                className="p-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-lg hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Form nuevo QR */}
            {showForm && (
              <div className="mb-4 p-4 theme-bg-secondary rounded-lg space-y-3">
                <input
                  type="text"
                  placeholder="Nombre (ej: Flyer Marzo)"
                  value={newQR.name}
                  onChange={(e) => setNewQR({ ...newQR, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
                />
                <input
                  type="text"
                  placeholder="Código (ej: flyer_marzo)"
                  value={newQR.code}
                  onChange={(e) => setNewQR({ ...newQR, code: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
                />
                <select
                  value={newQR.role}
                  onChange={(e) => setNewQR({ ...newQR, role: e.target.value as 'worker' | 'employer' | 'any' })}
                  className="w-full px-3 py-2 rounded-lg border theme-border theme-bg-primary theme-text-primary text-sm"
                >
                  <option value="any">Cualquier rol</option>
                  <option value="worker">Solo trabajadores</option>
                  <option value="employer">Solo empleadores</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={addQR}
                    className="flex-1 py-2 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-lg text-sm font-medium"
                  >
                    Crear
                  </button>
                  <button
                    onClick={() => setShowForm(false)}
                    className="px-4 py-2 theme-bg-primary border theme-border rounded-lg text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista */}
            <div className="space-y-2">
              {qrConfigs.map((config) => (
                <div
                  key={config.id}
                  onClick={() => setSelectedQR(config)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedQR?.id === config.id
                      ? 'bg-[#E10600]/10 border-2 border-[#E10600]'
                      : 'theme-bg-secondary hover:theme-bg-primary border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium theme-text-primary text-sm">{config.name}</p>
                      <p className="text-xs theme-text-muted font-mono">{config.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getRoleBadge(config.role)}
                      {config.id !== '1' && config.id !== '2' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteQR(config.id);
                          }}
                          className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Preview QR */}
        <div className="lg:col-span-2">
          <div className="theme-bg-card rounded-xl border theme-border p-6">
            {selectedQR ? (
              <div className="flex flex-col items-center">
                <h2 className="text-xl font-bold theme-text-primary mb-2">{selectedQR.name}</h2>
                <p className="text-sm theme-text-secondary mb-6">
                  Código: <span className="font-mono">{selectedQR.code}</span>
                </p>

                {/* QR Image */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
                  {qrDataUrl && (
                    <img src={qrDataUrl} alt="QR Code" className="w-64 h-64" />
                  )}
                </div>

                {/* URL */}
                <div className="w-full max-w-md mb-6">
                  <label className="block text-xs theme-text-muted mb-1">URL del QR</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={getURL(selectedQR)}
                      className="flex-1 px-3 py-2 rounded-lg border theme-border theme-bg-secondary theme-text-primary text-sm font-mono"
                    />
                    <button
                      onClick={copyURL}
                      className="p-2 theme-bg-secondary border theme-border rounded-lg hover:theme-bg-primary transition-colors"
                    >
                      {copied ? (
                        <Check className="w-5 h-5 text-green-500" />
                      ) : (
                        <Copy className="w-5 h-5 theme-text-muted" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={downloadQR}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#E10600] to-[#FF6A00] text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
                  >
                    <Download className="w-5 h-5" />
                    Descargar QR
                  </button>
                </div>

                {/* Info */}
                <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl w-full max-w-md">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>¿Cómo funciona?</strong>
                  </p>
                  <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                    <li>• El usuario escanea el QR</li>
                    <li>• Entra a la app con el código de referencia</li>
                    <li>• Se registra normalmente</li>
                    <li>• Guardamos de dónde vino (trackeable en admin)</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
                  <QrCode className="w-10 h-10 theme-text-muted" />
                </div>
                <p className="theme-text-muted">Seleccioná un QR para ver el preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
