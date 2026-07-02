'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Capa de cache/revalidación para toda la app. Al volver a una pantalla ya
// visitada, React Query muestra la data cacheada al instante y revalida en
// background, evitando el spinner + re-fetch completo en cada navegación.
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Datos "frescos" por 60s: navegar de ida y vuelta no re-fetchea.
            staleTime: 60_000,
            // Mantener en cache 5 min tras desmontar (para volver sin spinner).
            gcTime: 5 * 60_000,
            // No re-fetchear al reenfocar la ventana (evita ruido/costos).
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
