'use client';

import { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';
import { toast } from 'sonner';
import { api } from '@/services/api';
import { IAssessCvResponse } from '@/types';

// ---------------------------------------------------------------------------
// Análisis de CVs con IA "en segundo plano".
//
// El estado y el loop de evaluación viven acá (no en la página de Ofertas) para
// que el proceso SOBREVIVA a la navegación entre pantallas de (app): el provider
// se monta en (app)/layout.tsx. La página de Ofertas renderiza el modal detallado
// leyendo de este contexto, y un widget flotante global muestra el progreso desde
// cualquier pantalla. Alcance client-side: corre mientras la app esté abierta.
// ---------------------------------------------------------------------------

export const MAX_CVS = 20;
// Procesamiento de tandas de CV con IA. En el free tier de Gemini el techo es
// ~15 req/min, así que espaciamos los arranques (throttle) para acercarnos a ese
// techo sin gatillar 429 de más, con algo de concurrencia para solapar latencia.
const AI_CONCURRENCY = 2; // CVs en vuelo simultáneos (IA)
const AI_MIN_INTERVAL_MS = 4200; // ~14 req/min: arranque mínimo entre llamadas
const AI_RATE_BACKOFF_MS = 20000; // espera al pegar contra el límite por minuto
const AI_MAX_RETRIES = 4; // reintentos por CV ante 429 por minuto
const BASIC_CONCURRENCY = 4; // modo básico (sin IA): sin rate-limit, más paralelo

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// SHA-256 hex of a file (Web Crypto) — used to detect the same file twice.
async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isAllowedCvFile(file: File): boolean {
  const allowedMime = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'docx'];
  return allowedMime.includes(file.type) || allowedExt.includes(ext);
}

export interface AssessItem {
  id: string;
  file: File;
  hash?: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: IAssessCvResponse;
  error?: string;
}

// Datos mínimos de la oferta que necesita el análisis/widget. La página de Ofertas
// resuelve la oferta completa (DashboardOffer) por id cuando hace falta.
export interface CvAnalysisJob {
  id: string;
  puesto: string;
  aiAssessEnabled?: boolean;
}

interface CvSession {
  job: CvAnalysisJob;
  aiEnabled: boolean;
}

interface CvAnalysisContextValue {
  session: CvSession | null;
  items: AssessItem[];
  running: boolean;
  minimized: boolean;
  completedTick: number; // se incrementa al terminar una tanda/reintento (para refrescar el ranking)
  start: (job: CvAnalysisJob, aiEnabled: boolean) => void;
  addFiles: (files: File[]) => Promise<void>;
  removeItem: (id: string) => void;
  run: () => Promise<void>;
  retryItem: (item: AssessItem) => Promise<void>;
  minimize: () => void;
  restore: () => void;
  close: () => void;
}

const CvAnalysisContext = createContext<CvAnalysisContextValue | null>(null);

export function CvAnalysisProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CvSession | null>(null);
  const [items, setItems] = useState<AssessItem[]>([]);
  const [running, setRunning] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [completedTick, setCompletedTick] = useState(0);

  // Refs para leer lo último dentro del loop sin closures viejos.
  const itemsRef = useRef<AssessItem[]>([]);
  itemsRef.current = items;
  const sessionRef = useRef<CvSession | null>(null);
  sessionRef.current = session;
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);

  const updateItem = useCallback((id: string, patch: Partial<AssessItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const start = useCallback((job: CvAnalysisJob, aiEnabled: boolean) => {
    cancelledRef.current = false;
    setSession({ job, aiEnabled });
    setItems([]);
    setRunning(false);
    setMinimized(false);
  }, []);

  const addFiles = useCallback(async (picked: File[]) => {
    if (picked.length === 0) return;

    const valid: File[] = [];
    for (const file of picked) {
      if (!isAllowedCvFile(file)) {
        toast.error(`${file.name}: formato no soportado`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: supera el límite de 5MB`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;

    // Hash each file to drop duplicates already queued in this batch.
    const hashed = await Promise.all(
      valid.map(async (file) => ({ file, hash: await hashFile(file) }))
    );

    setItems((prev) => {
      const seen = new Set(prev.map((it) => it.hash).filter(Boolean) as string[]);
      const fresh: { file: File; hash: string }[] = [];
      const dupeNames: string[] = [];
      for (const h of hashed) {
        if (seen.has(h.hash)) { dupeNames.push(h.file.name); continue; }
        seen.add(h.hash);
        fresh.push(h);
      }
      if (dupeNames.length > 0) {
        toast.error(
          dupeNames.length === 1
            ? `Ese archivo ya lo agregaste: ${dupeNames[0]}`
            : `${dupeNames.length} archivos repetidos se omitieron: ${dupeNames.join(', ')}`
        );
      }

      const room = MAX_CVS - prev.length;
      if (room <= 0) {
        toast.error(`Máximo ${MAX_CVS} CVs`);
        return prev;
      }
      if (fresh.length > room) {
        toast.error(`Máximo ${MAX_CVS} CVs (se agregaron ${room})`);
      }
      const toAdd = fresh.slice(0, room).map(({ file, hash }, i) => ({
        id: `${file.name}-${file.size}-${hash.slice(0, 8)}-${prev.length + i}`,
        file,
        hash,
        status: 'pending' as const,
      }));
      return [...prev, ...toAdd];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  // Evalúa un único CV. Devuelve el resultado para que el llamador (tanda o
  // reintento) decida cómo seguir. El detalle técnico queda en el log de admin.
  const assessOne = useCallback(async (
    item: AssessItem,
    jobId: string,
  ): Promise<{ outcome: 'done' | 'error' | 'rate_limited'; rateScope?: string }> => {
    updateItem(item.id, { status: 'running', error: undefined });
    try {
      const result = await api.assessOfferCv(jobId, item.file);
      updateItem(item.id, { status: 'done', result });
      return { outcome: 'done' };
    } catch (error) {
      const e = error as { rateLimited?: boolean; retryable?: boolean; rateScope?: string; message?: string };
      if (e?.rateLimited || e?.retryable) {
        // Límite de IA o saturación transitoria del proveedor: dejamos el item
        // pendiente para reintentar (el worker aplica backoff).
        updateItem(item.id, { status: 'pending', error: undefined });
        return { outcome: 'rate_limited', rateScope: e.rateScope };
      }
      updateItem(item.id, { status: 'error', error: e?.message || 'Error al evaluar el CV' });
      return { outcome: 'error' };
    }
  }, [updateItem]);

  const run = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess || runningRef.current) return;

    // Snapshot de los CVs a procesar (pendientes o con error previo).
    const pending = itemsRef.current.filter((it) => it.status === 'pending' || it.status === 'error');
    if (pending.length === 0) return;

    runningRef.current = true;
    setRunning(true);

    // Modo IA: llama a Gemini (rate-limited). Modo básico: sin IA, más paralelo.
    const willUseAi = sess.aiEnabled;
    const jobId = sess.job.id;

    let index = 0;
    let dayLimit = false;
    let nextStart = 0; // throttle de arranques compartido entre workers

    // Espacia los arranques de las llamadas de IA para respetar el rate-limit.
    const throttle = async () => {
      if (!willUseAi) return;
      const now = Date.now();
      const wait = Math.max(0, nextStart - now);
      nextStart = Math.max(now, nextStart) + AI_MIN_INTERVAL_MS;
      if (wait > 0) await sleep(wait);
    };

    // Un worker toma CVs de la cola hasta agotarla. Ante 429 por minuto, espera
    // y reintenta el MISMO CV (no corta la tanda); ante 429 diario, se detiene.
    const worker = async () => {
      while (!dayLimit && !cancelledRef.current) {
        const i = index++;
        if (i >= pending.length) return;
        const item = pending[i];
        let attempts = 0;
        while (!dayLimit && !cancelledRef.current) {
          await throttle();
          if (cancelledRef.current) return;
          const r = await assessOne(item, jobId);
          if (r.outcome !== 'rate_limited') break; // done o error → siguiente CV
          if (r.rateScope === 'day') { dayLimit = true; break; }
          attempts += 1;
          if (attempts > AI_MAX_RETRIES) {
            updateItem(item.id, { status: 'error', error: 'Límite de IA alcanzado. Reintentá con "Evaluar".' });
            break;
          }
          await sleep(AI_RATE_BACKOFF_MS); // límite por minuto → esperar y reintentar
        }
      }
    };

    const workers = willUseAi ? AI_CONCURRENCY : BASIC_CONCURRENCY;
    const n = Math.min(workers, pending.length || 1);
    await Promise.all(Array.from({ length: n }, () => worker()));

    runningRef.current = false;
    setRunning(false);
    if (cancelledRef.current) return; // se cerró: no toasts ni refresh
    if (dayLimit) {
      toast.error('Límite diario de la IA alcanzado. Reintentá mañana con "Evaluar".');
    }
    setCompletedTick((t) => t + 1); // dispara refresh del ranking en la página
  }, [assessOne, updateItem]);

  // Reintenta la evaluación de un único CV (botón "Reintentar" del item).
  const retryItem = useCallback(async (item: AssessItem) => {
    const sess = sessionRef.current;
    if (!sess) return;
    runningRef.current = true;
    setRunning(true);
    const r = await assessOne(item, sess.job.id);
    if (r.outcome === 'rate_limited') {
      toast.error(
        (r.rateScope === 'day'
          ? 'Límite diario de la IA alcanzado. '
          : 'Límite por minuto de la IA alcanzado. ') + 'Reintentá en unos minutos.'
      );
    }
    runningRef.current = false;
    setRunning(false);
    if (!cancelledRef.current) setCompletedTick((t) => t + 1);
  }, [assessOne]);

  const minimize = useCallback(() => setMinimized(true), []);
  const restore = useCallback(() => setMinimized(false), []);

  const close = useCallback(() => {
    cancelledRef.current = true; // frena la tanda en curso
    runningRef.current = false;
    setSession(null);
    setItems([]);
    setRunning(false);
    setMinimized(false);
  }, []);

  return (
    <CvAnalysisContext.Provider
      value={{
        session,
        items,
        running,
        minimized,
        completedTick,
        start,
        addFiles,
        removeItem,
        run,
        retryItem,
        minimize,
        restore,
        close,
      }}
    >
      {children}
    </CvAnalysisContext.Provider>
  );
}

export function useCvAnalysis() {
  const context = useContext(CvAnalysisContext);
  if (!context) {
    throw new Error('useCvAnalysis must be used within CvAnalysisProvider');
  }
  return context;
}
