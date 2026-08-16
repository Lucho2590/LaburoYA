'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AdminLayout } from '@/components/AdminLayout';
import { AdminTable } from '@/components/admin/AdminTable';
import { TypedConfirmDialog } from '@/components/admin/TypedConfirmDialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { ICleanupReport, IOrphanWorker, IOrphanOffer, IAbandonedAccount } from '@/types';

type Tab = 'datos' | 'perfiles' | 'ofertas' | 'abandonadas';

const TABS: { id: Tab; label: string }[] = [
  { id: 'datos', label: 'Datos huérfanos' },
  { id: 'perfiles', label: 'Perfiles huérfanos' },
  { id: 'ofertas', label: 'Ofertas huérfanas' },
  { id: 'abandonadas', label: 'Cuentas abandonadas' },
];

function LimpiezaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : 'datos',
  );

  const changeTab = (t: Tab) => {
    setTab(t);
    router.replace(`/sudo/limpieza?tab=${t}`);
  };

  return (
    <AdminLayout title="Limpieza de datos">
      <div className="mb-6 flex gap-1 border-b theme-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => changeTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-[#E10600] text-[#E10600]'
                : 'border-transparent theme-text-secondary hover:theme-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'datos' && <DatosHuerfanos />}
      {tab === 'perfiles' && <PerfilesHuerfanos />}
      {tab === 'ofertas' && <OfertasHuerfanas />}
      {tab === 'abandonadas' && <CuentasAbandonadas />}
    </AdminLayout>
  );
}

/** Referencias a usuarios que ya no existen ni en `users` ni en Auth. */
function DatosHuerfanos() {
  const [report, setReport] = useState<ICleanupReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await api.getCleanupReport());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el diagnóstico');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const { deleted } = await api.runCleanup();
      const total = Object.values(deleted).reduce((a, b) => a + b, 0);
      toast.success(`Limpieza ejecutada: ${total} registros eliminados`);
      setConfirming(false);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al ejecutar la limpieza');
    } finally {
      setRunning(false);
    }
  };

  const totals = report?.totals ?? {};
  const totalDocs = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <>
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Documentos y archivos que siguen referenciando usuarios que ya no existen ni en{' '}
          <code>users</code> ni en Firebase Auth. Quedan cuando se borra una cuenta a mano
          desde la consola.
        </p>
        {report && report.keep.length > 0 && (
          <p className="theme-text-muted text-xs mt-2">
            Se conserva a propósito: {report.keep.join(', ')}.
          </p>
        )}
      </div>

      {report && report.deadUids > 0 && (
        <div className="theme-bg-card border theme-border rounded-xl p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="theme-text-primary font-medium">
                {report.deadUids} usuario{report.deadUids !== 1 ? 's' : ''} inexistente
                {report.deadUids !== 1 ? 's' : ''} · {totalDocs} registro{totalDocs !== 1 ? 's' : ''} para borrar
              </p>
              <p className="theme-text-muted text-sm mt-1">
                {Object.entries(totals).map(([k, v]) => `${k}: ${v}`).join(' · ')}
              </p>
            </div>
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-2.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 cursor-pointer"
            >
              Limpiar todo
            </button>
          </div>
        </div>
      )}

      <AdminTable
        columns={[
          { key: 'uid', label: 'UID' },
          { key: 'where', label: 'Aparece en' },
          { key: 'what', label: 'Se borraría' },
        ]}
        loading={loading}
        error={error}
        isEmpty={!report || report.items.length === 0}
        emptyText="No hay referencias a usuarios inexistentes 🎉"
      >
        {report?.items.map((item) => (
          <tr key={item.uid} className="hover:theme-bg-secondary transition-colors">
            <td className="px-6 py-4 theme-text-primary font-mono text-sm">
              {item.uid.slice(0, 12)}…
            </td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{item.foundIn.join(', ')}</td>
            <td className="px-6 py-4 theme-text-secondary text-sm">
              {Object.entries(item.counts)
                .filter(([k]) => k !== 'storageBytes')
                .map(([k, v]) => `${k}=${v}`)
                .join(' ') || '—'}
            </td>
          </tr>
        ))}
      </AdminTable>

      <TypedConfirmDialog
        open={confirming}
        title="Limpiar datos huérfanos"
        description={`Se van a borrar ${totalDocs} registros de ${report?.deadUids ?? 0} usuarios inexistentes, incluidos los archivos de Storage. No se puede deshacer.`}
        keyword="LIMPIAR"
        confirmLabel="Limpiar todo"
        loading={running}
        onConfirm={run}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

/** Workers con perfil pero sin doc en `users`. */
function PerfilesHuerfanos() {
  const [items, setItems] = useState<IOrphanWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<IOrphanWorker | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getOrphanWorkers()
      .then((d) => setItems(d.orphans))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  const remove = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.deleteOrphanWorker(target.uid);
      setItems((prev) => prev.filter((o) => o.uid !== target.uid));
      toast.success('Perfil eliminado');
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Perfiles de candidato que existen en <code>workers</code> pero no tienen usuario
          asociado. Aparecen como candidatos en la app pero no en la lista de Usuarios.
        </p>
        <span className="theme-text-muted text-sm">
          {items.length} perfil{items.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <AdminTable
        columns={[
          { key: 'uid', label: 'UID' },
          { key: 'puesto', label: 'Puesto / Rubro' },
          { key: 'zona', label: 'Zona' },
          { key: 'video', label: 'Video' },
          { key: 'acciones', label: 'Acciones', align: 'right' },
        ]}
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyText="No hay perfiles huérfanos 🎉"
      >
        {items.map((o) => (
          <tr key={o.uid} className="hover:theme-bg-secondary transition-colors">
            <td className="px-6 py-4 theme-text-primary font-mono text-sm">{o.uid.slice(0, 10)}…</td>
            <td className="px-6 py-4 theme-text-primary text-sm">
              {o.puesto || '—'} / {o.rubro || '—'}
            </td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{o.zona || '—'}</td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{o.hasVideo ? 'Sí' : 'No'}</td>
            <td className="px-6 py-4 text-right">
              <button
                onClick={() => setTarget(o)}
                className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 cursor-pointer"
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <ConfirmDialog
        open={!!target}
        title="¿Eliminar este perfil huérfano?"
        description={`${target?.puesto || '?'} / ${target?.rubro || '?'} — ${target?.zona || 'sin zona'}. Se borra el perfil y su data relacionada. Es irreversible.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}

/** Ofertas sin dueño válido, o creadas por un superuser. */
function OfertasHuerfanas() {
  const [items, setItems] = useState<IOrphanOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState<IOrphanOffer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.getOrphanOffers()
      .then((d) => setItems(d.offers))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  const remove = async () => {
    if (!target) return;
    setDeleting(true);
    try {
      await api.deleteOrphanOffer(target.id);
      setItems((prev) => prev.filter((o) => o.id !== target.id));
      toast.success('Oferta eliminada');
      setTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const badge = (c: IOrphanOffer['category']) =>
    c === 'orphan'
      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
      : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';

  return (
    <>
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Ofertas sin dueño válido: <strong>huérfanas</strong> (el <code>employerId</code> ya
          no existe) o creadas por un <strong>superuser</strong> (ofertas de prueba).
        </p>
        <span className="theme-text-muted text-sm">
          {items.length} oferta{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      <AdminTable
        columns={[
          { key: 'tipo', label: 'Tipo' },
          { key: 'puesto', label: 'Puesto / Rubro' },
          { key: 'zona', label: 'Zona' },
          { key: 'activa', label: 'Activa' },
          { key: 'acciones', label: 'Acciones', align: 'right' },
        ]}
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyText="No hay ofertas para limpiar 🎉"
      >
        {items.map((o) => (
          <tr key={o.id} className="hover:theme-bg-secondary transition-colors">
            <td className="px-6 py-4">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${badge(o.category)}`}>
                {o.category === 'orphan' ? 'Huérfana' : 'Superuser'}
              </span>
            </td>
            <td className="px-6 py-4 theme-text-primary text-sm">
              {o.puesto || '—'} / {o.rubro || '—'}
            </td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{o.zona || '—'}</td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{o.active ? 'Sí' : 'No'}</td>
            <td className="px-6 py-4 text-right">
              <button
                onClick={() => setTarget(o)}
                className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-sm font-medium hover:bg-red-800 cursor-pointer"
              >
                Eliminar
              </button>
            </td>
          </tr>
        ))}
      </AdminTable>

      <ConfirmDialog
        open={!!target}
        title="¿Eliminar esta oferta?"
        description={`${target?.puesto || '?'} / ${target?.rubro || '?'}. Se borra la oferta y su data relacionada. Es irreversible.`}
        confirmLabel="Eliminar"
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}

/** Cuentas de Auth que nunca completaron el registro. Sólo lectura. */
function CuentasAbandonadas() {
  const [items, setItems] = useState<IAbandonedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getAbandonedAccounts()
      .then((d) => setItems(d.accounts))
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="mb-6">
        <p className="theme-text-secondary text-sm">
          Cuentas de Firebase Auth que se registraron pero nunca eligieron rol, así que no
          tienen doc en <code>users</code>.
        </p>
        <p className="theme-text-muted text-sm mt-1">
          No se borran desde acá a propósito: son personas reales que abandonaron el
          registro, no datos rotos. Se decide una por una desde la consola de Firebase.
        </p>
      </div>

      <AdminTable
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'verificado', label: 'Verificado' },
          { key: 'antiguedad', label: 'Antigüedad' },
          { key: 'uid', label: 'UID' },
        ]}
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        emptyText="No hay cuentas abandonadas 🎉"
      >
        {items.map((a) => (
          <tr key={a.uid} className="hover:theme-bg-secondary transition-colors">
            <td className="px-6 py-4 theme-text-primary text-sm">{a.email || '(sin email)'}</td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{a.emailVerified ? 'Sí' : 'No'}</td>
            <td className="px-6 py-4 theme-text-secondary text-sm">{a.ageDays} días</td>
            <td className="px-6 py-4 theme-text-muted font-mono text-sm">{a.uid.slice(0, 10)}…</td>
          </tr>
        ))}
      </AdminTable>
    </>
  );
}

export default function LimpiezaPage() {
  return (
    <Suspense fallback={null}>
      <LimpiezaContent />
    </Suspense>
  );
}
