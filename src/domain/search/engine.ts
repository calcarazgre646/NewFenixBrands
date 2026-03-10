/**
 * domain/search/engine.ts
 *
 * Motor de búsqueda puro — 0 dependencias de React.
 * Multi-word matching con scoring por relevancia.
 *
 * Scoring:
 *   +10 si la query completa aparece en el título
 *   +5  si la query completa aparece en el subtítulo
 *   +3  por cada palabra que matchea en título
 *   +1  por cada palabra que matchea en subtítulo o searchableText
 */
import type { SearchableItem, SearchResult, SearchGroup, SearchResultType } from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Escapa caracteres especiales de regex para uso seguro en RegExp */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Normaliza texto para búsqueda: lowercase + trim + colapsar espacios */
function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

// ─── Core search ──────────────────────────────────────────────────────────────

/**
 * Busca items que matchean TODAS las palabras del query.
 * Retorna resultados ordenados por score descendente.
 *
 * @param items - Catálogo de items buscables
 * @param query - Texto ingresado por el usuario
 * @param maxResults - Máximo de resultados totales (default 12)
 */
export function search(
  items: readonly SearchableItem[],
  query: string,
  maxResults = 12,
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const words = q.split(" ").filter(Boolean);
  if (words.length === 0) return [];

  const results: SearchResult[] = [];

  for (const item of items) {
    const title = normalize(item.title);
    const subtitle = normalize(item.subtitle);
    const extra = normalize(item.searchableText ?? "");
    const all = `${title} ${subtitle} ${extra}`;

    // ALL words must be present somewhere
    const allMatch = words.every((w) => all.includes(w));
    if (!allMatch) continue;

    // Scoring
    let score = 0;

    // Full query in title = highest relevance
    if (title.includes(q)) score += 10;
    // Full query in subtitle
    if (subtitle.includes(q)) score += 5;

    // Per-word scoring
    for (const w of words) {
      if (title.includes(w)) score += 3;
      if (subtitle.includes(w) || extra.includes(w)) score += 1;
    }

    results.push({ ...item, score });
  }

  // Sort: higher score first, then alphabetical by title
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return results.slice(0, maxResults);
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

const TYPE_ORDER: SearchResultType[] = ["page", "kpi", "action"];
const TYPE_LABELS: Record<SearchResultType, string> = {
  kpi: "Indicadores",
  page: "Páginas",
  action: "Acciones rápidas",
};

/**
 * Agrupa resultados por tipo, respetando el orden visual:
 * Páginas → KPIs → Acciones.
 */
export function groupResults(results: SearchResult[]): SearchGroup[] {
  const groups: SearchGroup[] = [];

  for (const type of TYPE_ORDER) {
    const items = results.filter((r) => r.type === type);
    if (items.length > 0) {
      groups.push({ type, label: TYPE_LABELS[type], results: items });
    }
  }

  return groups;
}
