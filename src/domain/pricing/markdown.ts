/**
 * domain/pricing/markdown.ts
 *
 * Funciones puras para aplicar markdown manual a un SKU comercial.
 * Sin React. Sin Supabase. Sin efectos secundarios.
 *
 * @contract markdown-pct
 *   markdownPct está en escala 0-100 (no 0-1).
 *   Rango válido en BD: (0, 90]. Cero o negativo no es markdown.
 *
 * @contract effective-price
 *   PVP efectivo = PVP × (1 − markdownPct/100), redondeado a Gs. enteros.
 *   No clampea: si pct = 90 → efectivo = 10% del original.
 *
 * @contract guard
 *   Si el PVP base es placeholder ERP (< MIN_VALID_PRICE) el efectivo es 0
 *   y el margen efectivo se delega a calcMBP que ya devuelve 0.
 */

import { calcMBP, MIN_VALID_PRICE } from "./calculations";

/** Rango válido de markdownPct (escala 0-100). */
export const MARKDOWN_PCT_MIN = 0.01;
export const MARKDOWN_PCT_MAX = 90;

/** Markdown activo cargado contra un SKU comercial. */
export interface ActiveMarkdown {
  skuComercial: string;
  brand: string;
  markdownPct: number;
  note: string | null;
  validFrom: string;
  validUntil: string | null;
}

/**
 * PVP con markdown aplicado.
 *
 * @returns precio efectivo en Gs. enteros. Si pvp es placeholder o pct está
 *          fuera de rango, retorna pvp sin tocar (no aplica markdown).
 */
export function applyMarkdown(pvp: number, markdownPct: number): number {
  if (pvp < MIN_VALID_PRICE) return pvp;
  if (!isValidMarkdownPct(markdownPct)) return pvp;
  const factor = 1 - markdownPct / 100;
  return Math.round(pvp * factor);
}

/**
 * MBP% recalculado con PVP efectivo. Reusa la fórmula canónica de calcMBP
 * para mantener el comportamiento (placeholder, negativo, etc.) coherente
 * con la columna read-only.
 */
export function calcMbpEffective(pvp: number, costo: number, markdownPct: number): number {
  return calcMBP(applyMarkdown(pvp, markdownPct), costo);
}

/** Valida que el pct esté dentro del rango aceptado por la BD. */
export function isValidMarkdownPct(pct: number): boolean {
  return Number.isFinite(pct) && pct >= MARKDOWN_PCT_MIN && pct <= MARKDOWN_PCT_MAX;
}

export type MarkdownValidationError =
  | "out_of_range"
  | "not_a_number";

export interface MarkdownValidationResult {
  ok: boolean;
  error?: MarkdownValidationError;
  message?: string;
}

/**
 * Validación con mensaje human-readable para la UI del modal.
 * UI puede deshabilitar el botón Guardar y mostrar `message` debajo del input.
 */
export function validateMarkdownPct(pct: number): MarkdownValidationResult {
  if (!Number.isFinite(pct)) {
    return { ok: false, error: "not_a_number", message: "Ingresá un número" };
  }
  if (pct < MARKDOWN_PCT_MIN || pct > MARKDOWN_PCT_MAX) {
    return {
      ok: false,
      error: "out_of_range",
      message: `El markdown debe estar entre ${MARKDOWN_PCT_MIN}% y ${MARKDOWN_PCT_MAX}%`,
    };
  }
  return { ok: true };
}
