// Exportación a CSV de las tablas de /sudo, para seguir el análisis en una
// planilla. Se arma en el cliente con los datos que ya se pidieron al backend.

type CsvValue = string | number | boolean | null | undefined;

const escapeCell = (value: CsvValue) => {
  const str = value === null || value === undefined ? '' : String(value);
  // Excel/Sheets: comillas dobles duplicadas y celda entrecomillada si hay
  // separadores o saltos de línea.
  return /[";\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

// Fecha ISO corta (YYYY-MM-DD HH:mm), estable para ordenar en la planilla.
export function formatCsvDate(date?: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Descarga `rows` como CSV. Las columnas salen de las claves del primer objeto.
// Separador `;` porque es lo que espera Excel en es-AR.
export function downloadCsv(filename: string, rows: Record<string, CsvValue>[]) {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(';'),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h])).join(';')),
  ];

  // BOM para que Excel abra los acentos bien.
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
