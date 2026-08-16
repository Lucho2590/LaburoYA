'use client';

import { ReactNode } from 'react';

interface AdminTableProps {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  loading?: boolean;
  error?: string;
  /** Texto del estado vacío. Si no se pasa, no se muestra fila de vacío. */
  emptyText?: string;
  isEmpty?: boolean;
  children?: ReactNode;
}

/**
 * Tabla del panel con sus estados de carga, vacío y error.
 *
 * El bloque `theme-bg-card + <table> + thead theme-bg-secondary` estaba
 * copypasteado en todas las pantallas de listado de /sudo, cada una con su
 * propio ternario triple para loading/vacío/filas. Acá vive una sola vez.
 */
export function AdminTable({
  columns,
  loading = false,
  error,
  emptyText,
  isEmpty = false,
  children,
}: AdminTableProps) {
  return (
    <>
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">{error}</div>
      )}

      <div className="theme-bg-card rounded-xl border theme-border overflow-hidden">
        <table className="w-full">
          <thead className="theme-bg-secondary">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`${c.align === 'right' ? 'text-right' : 'text-left'} px-6 py-4 theme-text-secondary text-sm font-medium`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y theme-border">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E10600] mx-auto" />
                </td>
              </tr>
            ) : isEmpty ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center theme-text-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
