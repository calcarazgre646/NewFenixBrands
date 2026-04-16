/**
 * domain/lifecycle/classify.ts
 *
 * Clasificación de tipo de producto basada en campos del ERP.
 * Fuente: Rodrigo Aguayo — definiciones 09/04/2026.
 *
 * - Carry Over: carry_over = "SI" (producto que se repite entre temporadas)
 * - Temporada / Moda: est_comercial = "lanzamiento" (producto de temporada)
 * - Básicos: todo lo demás (producto estándar)
 */
import type { ProductType } from "./types";

/**
 * Clasifica un producto por su tipo de lifecycle.
 *
 * Carry Over tiene prioridad sobre Temporada: un producto puede ser
 * carry over Y tener est_comercial="lanzamiento" si se relanza.
 * En ese caso, el comportamiento de carry over (más estricto) aplica.
 */
export function classifyProductType(
  estComercial: string,
  carryOver: boolean,
): ProductType {
  if (carryOver) return "carry_over";
  if (estComercial.toLowerCase() === "lanzamiento") return "temporada";
  return "basicos";
}
