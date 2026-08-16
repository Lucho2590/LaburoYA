'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminLayout } from '@/components/AdminLayout';
import { api } from '@/services/api';
import { ISkillsAudit } from '@/types';
import { downloadCsv, formatCsvDate } from '@/lib/csv';

type TabId = 'custom' | 'ai' | 'offers' | 'catalog';

export default function AdminSkillsPage() {
  const [audit, setAudit] = useState<ISkillsAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<TabId>('custom');
  const [search, setSearch] = useState('');
  const [onlyUnused, setOnlyUnused] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setAudit(await api.getAdminSkillsAudit());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al cargar la auditoría de skills');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const q = search.trim().toLowerCase();

  const customRows = useMemo(
    () => (audit?.custom || []).filter((s) => !q || s.skill.toLowerCase().includes(q)),
    [audit, q]
  );
  const offerRows = useMemo(
    () =>
      (audit?.offers || []).filter(
        (o) =>
          !q ||
          o.custom.some((s) => s.toLowerCase().includes(q)) ||
          o.puesto?.toLowerCase().includes(q) ||
          o.businessName?.toLowerCase().includes(q)
      ),
    [audit, q]
  );
  const aiRows = useMemo(
    () => (audit?.aiSkills || []).filter((s) => !q || s.skill.toLowerCase().includes(q)),
    [audit, q]
  );
  const catalogRows = useMemo(
    () =>
      (audit?.catalog || []).filter(
        (s) => (!q || s.skill.toLowerCase().includes(q)) && (!onlyUnused || s.uses === 0)
      ),
    [audit, q, onlyUnused]
  );

  if (loading) {
    return (
      <AdminLayout title="Skills">
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600]"></div>
        </div>
      </AdminLayout>
    );
  }

  if (error || !audit) {
    return (
      <AdminLayout title="Skills">
        <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error || 'Sin datos'}</div>
      </AdminLayout>
    );
  }

  const exportCsv = () => {
    if (tab === 'custom') {
      downloadCsv(
        'skills-fuera-de-catalogo.csv',
        customRows.map((s) => ({
          skill: s.skill,
          enOfertas: s.offers,
          enWorkers: s.workers,
          enCvs: s.cvs,
          total: s.total,
          rubros: s.rubros.join(' | '),
          puestos: s.puestos.join(' | '),
        }))
      );
    } else if (tab === 'ai') {
      downloadCsv(
        'skills-detectadas-por-ia.csv',
        aiRows.map((s) => ({
          skill: s.skill,
          comoFortaleza: s.matching,
          comoFaltante: s.missing,
          total: s.total,
        }))
      );
    } else if (tab === 'offers') {
      downloadCsv(
        'ofertas-con-skills-a-revisar.csv',
        offerRows.map((o) => ({
          offerId: o.id,
          rubro: o.rubro || '',
          puesto: o.puesto || '',
          empleador: o.businessName || '',
          activa: o.active ? 'si' : 'no',
          creada: formatCsvDate(o.createdAt),
          skillsPedidas: o.requiredSkills.join(' | '),
          fueraDeCatalogo: o.custom.join(' | '),
          deOtroPuesto: o.offCatalog.join(' | '),
        }))
      );
    } else {
      downloadCsv(
        'catalogo-skills.csv',
        catalogRows.map((s) => ({
          skill: s.skill,
          usos: s.uses,
          rubros: s.rubros.join(' | '),
          puestos: s.puestos.join(' | '),
        }))
      );
    }
  };

  return (
    <AdminLayout title="Skills">
      <p className="theme-text-muted text-sm mb-4">
        Qué skills escriben a mano empleadores y workers (no están en el catálogo{' '}
        <code className="text-xs">SKILLS_BY_RUBRO</code>), qué nombra la IA al evaluar CVs y qué skills
        del catálogo no usa nadie. Sirve para decidir qué sumar, renombrar o sacar.
      </p>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-6">
        <Stat label="Skills en catálogo" value={audit.summary.catalogSkills} />
        <Stat label="Fuera de catálogo" value={audit.summary.customSkills} tone="purple" />
        <Stat label="Del catálogo sin uso" value={audit.summary.unusedCatalogSkills} tone="yellow" />
        <Stat label="Ofertas" value={audit.summary.totalOffers} />
        <Stat label="Ofertas con skills propias" value={audit.summary.offersWithCustom} tone="purple" />
        <Stat label="Workers con skills propias" value={audit.summary.workersWithCustom} tone="purple" />
        <Stat label="CVs analizados" value={audit.summary.totalCvs} />
      </div>

      {/* Controles */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar skill, puesto o empleador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[240px] max-w-md theme-bg-card border theme-border rounded-lg px-4 py-2 text-sm theme-text-primary placeholder:theme-text-muted"
        />
        {tab === 'catalog' && (
          <label className="flex items-center gap-2 text-sm theme-text-secondary">
            <input
              type="checkbox"
              checked={onlyUnused}
              onChange={(e) => setOnlyUnused(e.target.checked)}
            />
            Solo sin uso
          </label>
        )}
        <button
          onClick={exportCsv}
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-[#E10600] text-white hover:bg-[#c10500]"
        >
          Descargar CSV
        </button>
      </div>

      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <div className="flex border-b theme-border">
          {([
            ['custom', `Fuera de catálogo (${audit.custom.length})`],
            ['ai', `Detectadas por la IA (${audit.aiSkills.length})`],
            ['offers', `Ofertas a revisar (${audit.offers.length})`],
            ['catalog', `Catálogo (${audit.catalog.length})`],
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
          {tab === 'custom' && (
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <Th>Skill</Th>
                  <Th>En ofertas</Th>
                  <Th>En perfiles</Th>
                  <Th>En CVs</Th>
                  <Th>Total</Th>
                  <Th>Rubros</Th>
                  <Th>Puestos</Th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {customRows.map((s) => (
                  <tr key={s.skill}>
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">
                        {s.skill}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm theme-text-primary">{s.offers}</td>
                    <td className="px-4 py-3 text-sm theme-text-primary">{s.workers}</td>
                    <td className="px-4 py-3 text-sm theme-text-primary">{s.cvs}</td>
                    <td className="px-4 py-3 text-sm font-medium theme-text-primary">{s.total}</td>
                    <td className="px-4 py-3 text-xs theme-text-muted">{s.rubros.join(', ') || '-'}</td>
                    <td className="px-4 py-3 text-xs theme-text-muted">{s.puestos.join(', ') || '-'}</td>
                  </tr>
                ))}
                {customRows.length === 0 && <Empty colSpan={7} text="No hay skills fuera del catálogo" />}
              </tbody>
            </table>
          )}

          {tab === 'ai' && (
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <Th>Skill nombrada por la IA</Th>
                  <Th>Como fortaleza del CV</Th>
                  <Th>Como faltante</Th>
                  <Th>Total</Th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {aiRows.map((s) => (
                  <tr key={s.skill}>
                    <td className="px-4 py-3 text-sm theme-text-primary">{s.skill}</td>
                    <td className="px-4 py-3 text-sm text-green-600">{s.matching}</td>
                    <td className="px-4 py-3 text-sm text-red-600">{s.missing}</td>
                    <td className="px-4 py-3 text-sm font-medium theme-text-primary">{s.total}</td>
                  </tr>
                ))}
                {aiRows.length === 0 && (
                  <Empty colSpan={4} text="La IA no nombró skills fuera del catálogo" />
                )}
              </tbody>
            </table>
          )}

          {tab === 'offers' && (
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <Th>Oferta</Th>
                  <Th>Empleador</Th>
                  <Th>Fuera de catálogo</Th>
                  <Th>Del catálogo, otro puesto</Th>
                  <Th>Creada</Th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {offerRows.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3">
                      <Link href={`/sudo/jobs/${o.id}`} className="text-sm text-[#E10600] hover:underline">
                        {o.puesto || o.id.slice(0, 8)}
                      </Link>
                      <div className="text-xs theme-text-muted">
                        {o.rubro || '-'}
                        {o.active ? '' : ' · inactiva'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm theme-text-primary">{o.businessName || '-'}</td>
                    <td className="px-4 py-3">
                      <Pills skills={o.custom} className="bg-purple-600 text-white" />
                    </td>
                    <td className="px-4 py-3">
                      <Pills skills={o.offCatalog} className="bg-amber-500 text-white" />
                    </td>
                    <td className="px-4 py-3 text-xs theme-text-muted">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString('es-AR') : '-'}
                    </td>
                  </tr>
                ))}
                {offerRows.length === 0 && <Empty colSpan={5} text="Ninguna oferta usa skills raras" />}
              </tbody>
            </table>
          )}

          {tab === 'catalog' && (
            <table className="w-full">
              <thead className="theme-bg-secondary">
                <tr>
                  <Th>Skill</Th>
                  <Th>Usos (ofertas + perfiles)</Th>
                  <Th>Rubros</Th>
                  <Th>Puestos</Th>
                </tr>
              </thead>
              <tbody className="divide-y theme-border">
                {catalogRows.map((s) => (
                  <tr key={s.skill}>
                    <td className="px-4 py-3 text-sm theme-text-primary">{s.skill}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${s.uses === 0 ? 'text-yellow-600' : 'theme-text-primary'}`}>
                      {s.uses}
                    </td>
                    <td className="px-4 py-3 text-xs theme-text-muted">{s.rubros.join(', ')}</td>
                    <td className="px-4 py-3 text-xs theme-text-muted">{s.puestos.join(', ') || 'común del rubro'}</td>
                  </tr>
                ))}
                {catalogRows.length === 0 && <Empty colSpan={4} text="Sin resultados" />}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'purple' | 'yellow' }) {
  const color =
    tone === 'purple' ? 'text-purple-600' : tone === 'yellow' ? 'text-yellow-600' : 'theme-text-primary';
  return (
    <div className="theme-bg-card rounded-xl border theme-border p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs theme-text-muted mt-1">{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-4 py-3 theme-text-secondary text-sm font-medium">{children}</th>
  );
}

function Empty({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center theme-text-muted">
        {text}
      </td>
    </tr>
  );
}

function Pills({ skills, className }: { skills: string[]; className: string }) {
  if (skills.length === 0) return <span className="theme-text-muted text-sm">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {skills.map((s) => (
        <span key={s} className={`px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
          {s}
        </span>
      ))}
    </div>
  );
}
