/**
 * queries/paginate.ts
 *
 * Paginación estructural para Supabase.
 *
 * PROBLEMA: el servidor Supabase tiene max_rows=1000. Cualquier query con
 * .limit(10000) devuelve silenciosamente solo 1000 filas. Esto truncaba
 * datos de fjdhstvta1 (250K+ filas/año), fjdexisemp y cualquier tabla grande.
 *
 * SOLUCIÓN: paginar con .range() en lotes de PAGE_SIZE, acumulando resultados
 * hasta que la respuesta tenga menos filas que el lote (= última página).
 *
 * NOTA SOBRE ORDER BY:
 *   Si la query incluye .order() → la paginación es determinista.
 *   Si NO incluye .order() → PostgreSQL no garantiza orden estable entre
 *   requests. Esto puede causar filas duplicadas/faltantes entre páginas.
 *   Sin embargo, para tablas ERP legacy sin índices (fjdhstvta1, 250K+ filas),
 *   .order() causa statement timeout en Supabase. En estos casos, la paginación
 *   secuencial minimiza el riesgo (mismo plan de ejecución entre páginas).
 *
 *   Tablas con .order() (tienen índices o son pequeñas):
 *     - mv_ventas_mensual: .order("v_mes", "v_marca", ...)
 *
 *   Tablas SIN .order() (causan timeout bajo carga concurrente):
 *     - fjdhstvta1 (250K+ filas, sin índice)
 *     - fjdexisemp (54K+ filas, sin índice adecuado para sort)
 *     - vw_ticket_promedio_diario (vista, sin índice)
 *
 * USO:
 *   const rows = await fetchAllRows(() =>
 *     dataClient.from("fjdhstvta1")
 *       .select("v_año, v_mes, ...")
 *       .eq("v_año", 2026)
 *       .in("v_mes", [1, 2, 3])
 *   );
 */

/** Tamaño de página — coincide con max_rows de Supabase (1000). */
const PAGE_SIZE = 1000;

/**
 * Ejecuta una query de Supabase paginando automáticamente.
 * Acumula todas las páginas y retorna el array completo.
 *
 * @param buildQuery  Factory que crea una query FRESCA por cada página.
 *                    El builder de Supabase muta estado interno, así que no
 *                    se puede reutilizar un mismo builder con .range() distinto.
 * @returns Todas las filas de la query.
 * @throws Error si alguna página falla.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildQuery: () => any,
): Promise<T[]> {
  const allRows: T[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await buildQuery().range(from, to);

    if (error) throw new Error(`fetchAllRows page ${page}: ${error.message}`);
    if (!data || data.length === 0) break;

    allRows.push(...(data as T[]));

    if (data.length < PAGE_SIZE) break;
    page++;
  }

  return allRows;
}
