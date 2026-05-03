/**
 * components/filters/compositeChannel.ts
 *
 * Helper puro: serializa Canal + sub-canal B2B en un único valor de select.
 * Permite que el dropdown de Canal del GlobalFilters tenga UNA sola interacción
 * para elegir B2B (todos) / B2B → Mayorista / B2B → UTP / B2C / Total.
 *
 * Extracto a módulo separado para tests puros (el repo no tiene infra
 * de component testing).
 */
import type { B2bSubchannel, ChannelFilter } from "@/domain/filters/types";

/** Valor compuesto del select: "total" | "b2c" | "b2b:all" | "b2b:mayorista" | "b2b:utp" */
export type CompositeChannel = "total" | "b2c" | `b2b:${B2bSubchannel}`;

/** Convierte el estado del FilterContext en el value del <select>. */
export function toComposite(channel: ChannelFilter, sub: B2bSubchannel): CompositeChannel {
  if (channel === "total") return "total";
  if (channel === "b2c") return "b2c";
  return `b2b:${sub}`;
}

/** Parsea el value del <select> de vuelta a (channel, sub). */
export function fromComposite(value: CompositeChannel): { channel: ChannelFilter; sub: B2bSubchannel } {
  if (value === "total") return { channel: "total", sub: "all" };
  if (value === "b2c") return { channel: "b2c", sub: "all" };
  const [, sub] = value.split(":") as ["b2b", B2bSubchannel];
  return { channel: "b2b", sub };
}
