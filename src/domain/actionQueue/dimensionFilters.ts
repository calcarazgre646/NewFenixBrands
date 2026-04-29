/**
 * domain/actionQueue/dimensionFilters.ts
 *
 * Helpers puros para los filtros de dimensión (Línea / Tipo de Artículo).
 *
 * Limpia el ruido de la BD donde la columna `linea` a menudo replica el valor
 * de `categoria` en lugar de actuar como agrupador real (camisería → camisa,
 * vaquería → jean). Una "línea verdadera" es la que agrupa >1 categoría.
 *
 * Funciones puras — sin React, sin side effects.
 */
import type { ActionItemFull } from "./waterfall";

export interface DimensionOption {
  value: string;
  label: string;
  count: number;
}

interface ItemLike {
  linea?: string | null;
  categoria?: string | null;
}

/** Capitaliza primer caracter (para mostrar "camisa" → "Camisa"). */
function prettify(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Devuelve líneas que realmente agrupan >1 categoría.
 * Las que aparecen con un solo `categoria` y ese categoria coincide en string
 * con la línea son ruido — las descartamos para que no aparezca "bermuda" en
 * la lista de Línea cuando ya está en la lista de Tipo.
 */
export function buildLineaOptions(
  items: ReadonlyArray<ItemLike>,
  scope?: { categoria?: string | null },
): DimensionOption[] {
  const lineaCategorias = new Map<string, Set<string>>();
  const lineaCounts = new Map<string, number>();

  for (const it of items) {
    const linea = (it.linea ?? "").trim();
    const cat = (it.categoria ?? "").trim();
    if (!linea) continue;
    if (scope?.categoria && cat.toLowerCase() !== scope.categoria.toLowerCase()) continue;

    let cats = lineaCategorias.get(linea);
    if (!cats) {
      cats = new Set();
      lineaCategorias.set(linea, cats);
    }
    if (cat) cats.add(cat.toLowerCase());

    lineaCounts.set(linea, (lineaCounts.get(linea) ?? 0) + 1);
  }

  const options: DimensionOption[] = [];
  for (const [linea, cats] of lineaCategorias) {
    const isNoise =
      cats.size <= 1 &&
      [...cats][0] === linea.toLowerCase();
    if (isNoise) continue;
    options.push({
      value: linea,
      label: prettify(linea),
      count: lineaCounts.get(linea) ?? 0,
    });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return options;
}

/**
 * Categoría = "tipo de artículo" en la jerga del cliente.
 * Si se pasa scope.linea, se restringe a esa línea.
 */
export function buildCategoriaOptions(
  items: ReadonlyArray<ItemLike>,
  scope?: { linea?: string | null },
): DimensionOption[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const cat = (it.categoria ?? "").trim();
    const linea = (it.linea ?? "").trim();
    if (!cat) continue;
    if (scope?.linea && linea.toLowerCase() !== scope.linea.toLowerCase()) continue;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const options: DimensionOption[] = [];
  for (const [value, count] of counts) {
    options.push({ value, label: prettify(value), count });
  }
  options.sort((a, b) => a.label.localeCompare(b.label, "es"));
  return options;
}

/**
 * Aplica los filtros de dimensión a una lista de ActionItemFull.
 * Si el filtro está null, no filtra esa dimensión.
 */
export function filterByDimensions(
  items: ActionItemFull[],
  linea: string | null,
  categoria: string | null,
): ActionItemFull[] {
  if (!linea && !categoria) return items;
  return items.filter(it => {
    if (linea && (it.linea ?? "").toLowerCase() !== linea.toLowerCase()) return false;
    if (categoria && (it.categoria ?? "").toLowerCase() !== categoria.toLowerCase()) return false;
    return true;
  });
}
