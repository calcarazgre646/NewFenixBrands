/**
 * domain/search/types.ts
 *
 * Tipos del dominio de búsqueda global.
 * Sin dependencias de React — puro TypeScript.
 */

/** Tipos de resultado que puede devolver el buscador */
export type SearchResultType = "kpi" | "page" | "action";

/** Un item indexable para búsqueda */
export interface SearchableItem {
  type: SearchResultType;
  id: string;
  /** Texto principal (nombre del KPI, nombre de la página, etc.) */
  title: string;
  /** Texto secundario (definición, descripción) */
  subtitle: string;
  /** Texto adicional para buscar pero no mostrar (fórmula, keywords) */
  searchableText?: string;
  /** Path de navegación al seleccionar (vacío = solo informativo, sin click) */
  path?: string;
  /** Metadata extra para renderizar en la UI */
  meta?: Record<string, string>;
}

/** Resultado de búsqueda con score de relevancia */
export interface SearchResult extends SearchableItem {
  /** Score de relevancia (mayor = más relevante). Usado para ordenar. */
  score: number;
}

/** Grupo de resultados por tipo */
export interface SearchGroup {
  type: SearchResultType;
  label: string;
  results: SearchResult[];
}
