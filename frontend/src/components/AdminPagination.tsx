'use client';

// Paginación client-side reutilizable para las tablas del panel de admin.
// Mismo look & feel que la de /sudo/jobs.
export function AdminPagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((page) => {
      if (page === 1 || page === totalPages) return true;
      if (Math.abs(page - currentPage) <= 2) return true;
      return false;
    })
    .reduce((acc: (number | string)[], page, idx, arr) => {
      if (idx > 0 && typeof arr[idx - 1] === 'number' && page - (arr[idx - 1] as number) > 1) {
        acc.push('...');
      }
      acc.push(page);
      return acc;
    }, []);

  return (
    <div className="px-4 py-3 border-t theme-border flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="theme-text-secondary text-sm">Mostrar:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="theme-bg-secondary border theme-border rounded px-2 py-1 text-sm theme-text-primary"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <span className="theme-text-muted text-sm">
          Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalItems)} de {totalItems}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
        >
          ««
        </button>
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
        >
          «
        </button>

        {pages.map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-1 theme-text-muted">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-[#E10600] text-white'
                  : 'theme-bg-secondary theme-text-primary hover:opacity-80'
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
        >
          »
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-2 py-1 rounded theme-bg-secondary theme-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80"
        >
          »»
        </button>
      </div>
    </div>
  );
}
