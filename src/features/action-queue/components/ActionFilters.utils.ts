/**
 * features/action-queue/components/ActionFilters.utils.ts
 *
 * Constantes, tipos y helpers de filtrado. Separado de ActionFilters.tsx
 * para permitir fast-refresh sobre el componente.
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import { classifyIntent } from "@/domain/actionQueue/grouping";
import type { OperationalIntent } from "@/domain/actionQueue/grouping";

// ─── Filter categories (map intents to visual groups) ───────────────────────

export type ActionFilterType = "all" | "reposition" | "redistribute" | "size_curve" | "lifecycle" | "exit";

export const FILTER_META: { type: ActionFilterType; label: string; intents: OperationalIntent[] }[] = [
  { type: "all",          label: "Todas",           intents: [] },
  { type: "reposition",   label: "Reposición",      intents: ["receive_transfer", "receive_depot", "resupply_depot"] },
  { type: "redistribute", label: "Redistribución",  intents: ["redistribute", "ship_b2b"] },
  { type: "size_curve",   label: "Curva tallas",    intents: ["lifecycle_reposition"] },
  { type: "lifecycle",    label: "Lifecycle",        intents: ["lifecycle_review", "lifecycle_commercial"] },
  { type: "exit",         label: "Salida",           intents: ["lifecycle_exit"] },
];

export const FILTER_COLORS: Record<ActionFilterType, string> = {
  all:          "bg-brand-500 text-white",
  reposition:   "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  redistribute: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  size_curve:   "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  lifecycle:    "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  exit:         "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
};

// ─── Filter logic ───────────────────────────────────────────────────────────

/** Apply type filter to items. Returns filtered items. */
export function filterActions(
  items: ActionItemFull[],
  _search: string, // deprecated param kept for compatibility
  filterType: ActionFilterType,
): ActionItemFull[] {
  if (filterType === "all") return items;

  const meta = FILTER_META.find(f => f.type === filterType);
  if (!meta || meta.intents.length === 0) return items;

  const intentSet = new Set(meta.intents);
  return items.filter(item => intentSet.has(classifyIntent(item)));
}

/** Count items per filter type */
export function countByFilterType(items: ActionItemFull[]): Record<ActionFilterType, number> {
  const counts: Record<ActionFilterType, number> = {
    all: items.length,
    reposition: 0,
    redistribute: 0,
    size_curve: 0,
    lifecycle: 0,
    exit: 0,
  };

  for (const item of items) {
    const intent = classifyIntent(item);
    for (const meta of FILTER_META) {
      if (meta.type !== "all" && meta.intents.includes(intent)) {
        counts[meta.type]++;
        break;
      }
    }
  }

  return counts;
}
