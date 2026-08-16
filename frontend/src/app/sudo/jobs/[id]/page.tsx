'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { IAdminOfferDetail, IAdminOfferWorker } from '@/types';
import { downloadCsv, formatCsvDate } from '@/lib/csv';

const formatUsd = (n: number) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

const formatDateTime = (date?: string | null) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type TabId = 'matches' | 'interactions' | 'requests' | 'candidates';

const RECOMMENDATION_LABELS: Record<string, string> = {
  yes: 'Sí',
  maybe: 'Tal vez',
  no: 'No',
  sin_dato: 'Sin dato',
};

export default function AdminJobOfferDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [detail, setDetail] = useState<IAdminOfferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('matches');

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await api.getAdminJobOfferDetail(id));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la oferta');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Una fila por persona que tocó la oferta, con qué hizo: es lo que se baja
  // para analizar después en una planilla.
  const csvRows = useMemo(() => {
    if (!detail) return [];
    const base = {
      offerId: detail.offer.id,
      rubro: detail.offer.rubro,
      puesto: detail.offer.puesto,
      empleador: detail.employer?.businessName || '',
    };
    return [
      ...detail.matches.map((m) => ({
        ...base,
        evento: 'match',
        estado: m.status,
        detalle: [
          m.mutualInterest ? 'interes mutuo' : '',
          m.statusUpdatedByRole ? `cerrado por ${m.statusUpdatedByRole}` : '',
        ].filter(Boolean).join(' / '),
        workerUid: m.worker.uid,
        workerNombre: m.worker.nombre || '',
        workerEmail: m.worker.email || '',
        workerRubro: m.worker.rubro || '',
        workerPuesto: m.worker.puesto || '',
        workerZona: m.worker.zona || '',
        workerSkills: m.worker.skills.join(' | '),
        fecha: formatCsvDate(m.createdAt),
      })),
      ...detail.interactions.map((i) => ({
        ...base,
        evento: i.type === 'not_interested' ? 'descarto la oferta' : 'le intereso',
        estado: i.type,
        detalle: '',
        workerUid: i.worker.uid,
        workerNombre: i.worker.nombre || '',
        workerEmail: i.worker.email || '',
        workerRubro: i.worker.rubro || '',
        workerPuesto: i.worker.puesto || '',
        workerZona: i.worker.zona || '',
        workerSkills: i.worker.skills.join(' | '),
        fecha: formatCsvDate(i.createdAt),
      })),
      ...detail.requests.map((r) => ({
        ...base,
        evento: r.direction === 'employer_to_worker' ? 'invitacion del empleador' : 'postulacion del worker',
        estado: r.expired ? 'vencida' : r.status,
        detalle: '',
        workerUid: r.worker.uid,
        workerNombre: r.worker.nombre || '',
        workerEmail: r.worker.email || '',
        workerRubro: r.worker.rubro || '',
        workerPuesto: r.worker.puesto || '',
        workerZona: r.worker.zona || '',
        workerSkills: r.worker.skills.join(' | '),
        fecha: formatCsvDate(r.createdAt),
      })),
      ...detail.candidates.map((c) => ({
        ...base,
        evento: 'cv analizado',
        estado: c.recommendation || 'sin dato',
        detalle: `score ${c.score} · ${c.stars}★${c.selected ? ' · seleccionado' : ''} · ${c.mode}`,
        workerUid: '',
        workerNombre: c.nombre || '',
        workerEmail: c.email || '',
        workerRubro: '',
        workerPuesto: c.puesto || '',
        workerZona: c.zona || '',
        workerSkills: c.matchingSkills.join(' | '),
        fecha: formatCsvDate(c.createdAt),
      })),
    ];
  }, [detail]);

  if (loading) {
    return (
      <AdminLayout title="Detalle de oferta">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !detail) {
    return (
      <AdminLayout title="Detalle de oferta">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error || 'Oferta no encontrada'}</div>
        <Link href="/sudo/jobs" className="text-sm text-[#E10600] hover:underline mt-4 inline-block">
          ← Volver a ofertas
        </Link>
      </AdminLayout>
    );
  }

  const { offer, employer, counts, skills } = detail;
  const ai = offer.aiUsage;
  const totalAiTokens = (ai?.inputTokens || 0) + (ai?.outputTokens || 0);
  const isExpired = !!offer.expiresAt && new Date(offer.expiresAt) < new Date();
  // Cuánta gente vio la oferta y decidió algo: base para la tasa de interés.
  const decisiones = counts.interactions.interested + counts.interactions.notInterested;
  const tasaInteres = decisiones > 0
    ? Math.round((counts.interactions.interested / decisiones) * 100)
    : null;

  return (
    <AdminLayout title="Detalle de oferta">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link href="/sudo/jobs" className="text-sm text-[#E10600] hover:underline">
          ← Volver a ofertas
        </Link>
        <button
          onClick={() => downloadCsv(`oferta-${offer.id}.csv`, csvRows)}
          disabled={csvRows.length === 0}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#E10600] text-white hover:bg-[#c10500] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Descargar CSV ({csvRows.length})
        </button>
      </div>

      {/* Cabecera */}
      <div className="theme-bg-card rounded-xl border theme-border p-4 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-semibold theme-text-primary">{offer.puesto}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                offer.active !== false
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
              }`}>
                {offer.active !== false ? 'Activa' : 'Inactiva'}
              </span>
              {isExpired && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  Expirada
                </span>
              )}
            </div>
            <p className="theme-text-secondary text-sm">
              {offer.rubro}
              {offer.zona ? ` · ${offer.zona}` : ''}
              {employer && (
                <>
                  {' · '}
                  <Link href={`/sudo/users/${employer.uid}`} className="text-[#E10600] hover:underline">
                    {employer.businessName || employer.uid}
                  </Link>
                  {employer.isCompany ? ' (empresa)' : ''}
                </>
              )}
            </p>
            <p className="text-xs theme-text-muted mt-1 font-mono">{offer.id}</p>
          </div>
          <div className="text-xs theme-text-muted text-right">
            <div>Creada: {formatDateTime(offer.createdAt)}</div>
            <div>Expira: {formatDateTime(offer.expiresAt)}</div>
            <div>Duración: {offer.durationDays || 3} días</div>
          </div>
        </div>
      </div>

      {/* Datos cargados por el empleador */}
      <div className="theme-bg-card rounded-xl border theme-border p-4 mb-6">
        <h3 className="text-sm font-medium theme-text-primary mb-3">Datos de la oferta</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
          <Field label="Salario" value={offer.salary} />
          <Field label="Horario" value={offer.schedule} />
          <Field label="Zona" value={offer.zona} />
          <Field label="Ciudad" value={offer.city} />
        </div>
        {offer.description && (
          <div className="mb-3">
            <div className="text-xs theme-text-muted mb-1">Descripción</div>
            <p className="text-sm theme-text-secondary whitespace-pre-wrap">{offer.description}</p>
          </div>
        )}
        {offer.requirements && (
          <div>
            <div className="text-xs theme-text-muted mb-1">Requisitos</div>
            <p className="text-sm theme-text-secondary whitespace-pre-wrap">{offer.requirements}</p>
          </div>
        )}
      </div>

      {/* Números de la oferta */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <StatCard label="Matches" value={counts.matches.total} tone="primary" />
        <StatCard label="Aceptados" value={counts.matches.accepted} tone="green" />
        <StatCard label="Pendientes" value={counts.matches.pending} tone="yellow" />
        <StatCard label="Matches rechazados" value={counts.matches.rejected} tone="red" />
        <StatCard label="Les interesó" value={counts.interactions.interested} tone="green" />
        <StatCard
          label="Descartaron la oferta"
          value={counts.interactions.notInterested}
          tone="red"
          hint="Workers que marcaron 'no me interesa' en Descubrir"
        />
        <StatCard
          label="CVs en el ranking"
          value={counts.cvRanking.total}
          hint="CVs cargados y evaluados para esta oferta"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Postulaciones */}
        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <h3 className="text-sm font-medium theme-text-primary mb-3">Postulaciones (contact requests)</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <Row label="Del worker a la oferta" value={counts.requests.fromWorker} />
            <Row label="Del empleador al worker" value={counts.requests.fromEmployer} />
            <Row label="Pendientes" value={counts.requests.pending} />
            <Row label="Pendientes vencidas" value={counts.requests.expiredPending} />
            <Row label="Convertidas en match" value={counts.requests.matched + counts.requests.accepted} />
            <Row label="Rechazadas" value={counts.requests.rejected} />
          </div>
          {tasaInteres !== null && (
            <p className="text-xs theme-text-muted mt-3">
              Tasa de interés: <span className="theme-text-primary font-medium">{tasaInteres}%</span> sobre{' '}
              {decisiones} decisiones de workers.
            </p>
          )}
        </div>

        {/* IA */}
        <div className="theme-bg-card rounded-xl border theme-border p-4">
          <h3 className="text-sm font-medium theme-text-primary mb-3">IA — análisis de CVs</h3>
          {ai && ai.cvCount > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <Row label="Costo estimado" value={`U$D ${formatUsd(ai.costUsd)}`} />
                <Row label="CVs analizados" value={ai.cvCount} />
                <Row label="Tokens entrada" value={formatTokens(ai.inputTokens)} />
                <Row label="Tokens salida" value={formatTokens(ai.outputTokens)} />
                <Row label="Tokens totales" value={formatTokens(totalAiTokens)} />
                <Row
                  label="Costo por CV"
                  value={`U$D ${formatUsd(ai.cvCount ? ai.costUsd / ai.cvCount : 0)}`}
                />
              </div>
              <p className="text-xs theme-text-muted mt-3">
                Último análisis: {formatDateTime(ai.updatedAt)} · IA {offer.aiAssessEnabled === false ? 'apagada' : 'encendida'} en esta oferta.
              </p>
              <div className="grid grid-cols-2 gap-y-2 text-sm mt-3 pt-3 border-t theme-border">
                <Row label="CVs en el ranking" value={counts.cvRanking.total} />
                <Row label="Score promedio" value={counts.cvRanking.avgScore} />
                <Row label="Seleccionados" value={counts.cvRanking.selected} />
                <Row
                  label="Recomendación IA"
                  value={
                    Object.entries(counts.cvRanking.byRecommendation)
                      .map(([k, v]) => `${RECOMMENDATION_LABELS[k] || k}: ${v}`)
                      .join(' · ') || '-'
                  }
                />
              </div>
            </>
          ) : (
            <p className="text-sm theme-text-muted">Esta oferta todavía no consumió IA.</p>
          )}
        </div>
      </div>

      {/* Skills */}
      <div className="theme-bg-card rounded-xl border theme-border p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium theme-text-primary">Skills pedidas ({skills.total})</h3>
          <Link href="/sudo/skills" className="text-xs text-[#E10600] hover:underline">
            Ver auditoría de skills →
          </Link>
        </div>
        {skills.total === 0 ? (
          <p className="text-sm theme-text-muted">La oferta no pide skills.</p>
        ) : (
          <div className="space-y-3">
            <SkillGroup
              title="Del catálogo (sugeridas para el puesto)"
              skills={skills.known}
              className="bg-[#E10600] text-white"
            />
            <SkillGroup
              title="Del catálogo pero de otro puesto"
              skills={skills.offCatalog}
              className="bg-amber-500 text-white"
            />
            <SkillGroup
              title="Escritas a mano (no están en el catálogo)"
              skills={skills.custom}
              className="bg-purple-600 text-white"
            />
          </div>
        )}

        {(detail.cvInsights.topMissingSkills.length > 0 ||
          detail.cvInsights.topCandidateSkills.length > 0) && (
          <div className="grid md:grid-cols-2 gap-4 mt-4 pt-4 border-t theme-border">
            <SkillCounts
              title="Lo que más les faltó a los CVs"
              items={detail.cvInsights.topMissingSkills}
            />
            <SkillCounts
              title="Skills que traen los CVs"
              items={detail.cvInsights.topCandidateSkills}
            />
          </div>
        )}
      </div>

      {/* Listas */}
      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <div className="flex border-b theme-border">
          {([
            ['matches', `Matches (${detail.matches.length})`],
            ['interactions', `Interacciones (${detail.interactions.length})`],
            ['requests', `Postulaciones (${detail.requests.length})`],
            ['candidates', `CVs analizados (${detail.candidates.length})`],
          ] as [TabId, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                tab === key
                  ? 'text-[#E10600] border-b-2 border-[#E10600]'
                  : 'theme-text-secondary hover:theme-text-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="theme-bg-secondary">
              <tr>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">
                  {tab === 'candidates' ? 'Candidato (CV)' : 'Worker'}
                </th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Perfil</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Estado</th>
                <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y theme-border">
              {tab === 'matches' && detail.matches.map((m) => (
                <tr key={m.id}>
                  <WorkerCells worker={m.worker} />
                  <td className="px-4 py-3">
                    <StatusPill
                      status={m.status}
                      label={m.status === 'accepted' ? 'Aceptado' : m.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                    />
                    <div className="text-xs theme-text-muted mt-1">
                      {m.mutualInterest ? 'Interés mutuo' : 'Match directo'}
                      {m.statusUpdatedByRole ? ` · cerrado por ${m.statusUpdatedByRole === 'worker' ? 'el worker' : 'el empleador'}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs theme-text-muted">{formatDateTime(m.createdAt)}</td>
                </tr>
              ))}

              {tab === 'interactions' && detail.interactions.map((i) => (
                <tr key={i.id}>
                  <WorkerCells worker={i.worker} />
                  <td className="px-4 py-3">
                    <StatusPill
                      status={i.type === 'interested' ? 'accepted' : 'rejected'}
                      label={i.type === 'interested' ? 'Le interesó' : 'Descartó la oferta'}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs theme-text-muted">{formatDateTime(i.createdAt)}</td>
                </tr>
              ))}

              {tab === 'requests' && detail.requests.map((r) => (
                <tr key={r.id}>
                  <WorkerCells worker={r.worker} />
                  <td className="px-4 py-3">
                    <StatusPill
                      status={
                        r.expired ? 'rejected'
                          : r.status === 'rejected' ? 'rejected'
                          : r.status === 'pending' ? 'pending'
                          : 'accepted'
                      }
                      label={
                        r.expired ? 'Vencida'
                          : r.status === 'pending' ? 'Pendiente'
                          : r.status === 'rejected' ? 'Rechazada'
                          : 'Match'
                      }
                    />
                    <div className="text-xs theme-text-muted mt-1">
                      {r.direction === 'employer_to_worker' ? 'La mandó el empleador' : 'Se postuló el worker'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs theme-text-muted">{formatDateTime(r.createdAt)}</td>
                </tr>
              ))}

              {tab === 'candidates' && detail.candidates.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="text-sm theme-text-primary">{c.nombre || 'Sin nombre'}</div>
                    <div className="text-xs theme-text-muted">{c.email || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm theme-text-primary">{c.puesto || '-'}</div>
                    <div className="text-xs theme-text-muted">
                      {[c.zona, c.locationStatus].filter(Boolean).join(' · ') || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm theme-text-primary">
                      {c.score} pts · {c.stars}★
                    </div>
                    <div className="text-xs theme-text-muted">
                      {RECOMMENDATION_LABELS[c.recommendation || 'sin_dato'] || c.recommendation}
                      {c.mode === 'ai' ? ' · IA' : ' · sin IA'}
                      {c.selected ? ' · seleccionado' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs theme-text-muted">{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}

              {((tab === 'matches' && detail.matches.length === 0) ||
                (tab === 'interactions' && detail.interactions.length === 0) ||
                (tab === 'candidates' && detail.candidates.length === 0) ||
                (tab === 'requests' && detail.requests.length === 0)) && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center theme-text-muted">
                    Sin registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: 'primary' | 'green' | 'red' | 'yellow';
  hint?: string;
}) {
  const color =
    tone === 'green' ? 'text-green-600'
      : tone === 'red' ? 'text-red-600'
      : tone === 'yellow' ? 'text-yellow-600'
      : tone === 'primary' ? 'text-[#E10600]'
      : 'theme-text-primary';
  return (
    <div className="theme-bg-card rounded-xl border theme-border p-3 text-center" title={hint}>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs theme-text-muted mt-1">{label}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="theme-bg-secondary rounded-lg p-3">
      <div className="text-xs theme-text-muted mb-1">{label}</div>
      <div className="text-sm theme-text-primary font-medium">{value || '-'}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <>
      <span className="theme-text-muted">{label}</span>
      <span className="theme-text-primary font-medium text-right">{value}</span>
    </>
  );
}

function SkillGroup({ title, skills, className }: { title: string; skills: string[]; className: string }) {
  if (skills.length === 0) return null;
  return (
    <div>
      <div className="text-xs theme-text-muted mb-1">{title} ({skills.length})</div>
      <div className="flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span key={skill} className={`px-2.5 py-1 rounded-full text-xs font-medium ${className}`}>
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ranking de skills salido de los CVs. Marca las que no están en el catálogo:
// son candidatas a sumarse a SKILLS_BY_RUBRO.
function SkillCounts({
  title,
  items,
}: {
  title: string;
  items: { skill: string; count: number; inCatalog: boolean }[];
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-xs theme-text-muted mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span
            key={i.skill}
            title={i.inCatalog ? 'Está en el catálogo' : 'No está en el catálogo'}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              i.inCatalog
                ? 'theme-bg-secondary theme-text-primary'
                : 'bg-purple-600 text-white'
            }`}
          >
            {i.skill} · {i.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkerCells({ worker }: { worker: IAdminOfferWorker }) {
  return (
    <>
      <td className="px-4 py-3">
        <Link href={`/sudo/users/${worker.uid}`} className="text-sm text-[#E10600] hover:underline">
          {worker.nombre || worker.uid.slice(0, 8)}
        </Link>
        <div className="text-xs theme-text-muted">{worker.email || '-'}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm theme-text-primary">{worker.puesto || '-'}</div>
        <div className="text-xs theme-text-muted">
          {[worker.rubro, worker.zona].filter(Boolean).join(' · ') || '-'}
        </div>
      </td>
    </>
  );
}

function StatusPill({ status, label }: { status: 'accepted' | 'rejected' | 'pending'; label: string }) {
  const colors = {
    accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>{label}</span>
  );
}
