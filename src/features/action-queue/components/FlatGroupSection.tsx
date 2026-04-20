/**
 * features/action-queue/components/FlatGroupSection.tsx
 *
 * Grupo plano para vistas Prioridad y Marca.
 *
 * Header ligero + grid de tarjetas DIRECTO. Sin secciones por intent,
 * sin collapse, sin clicks intermedios. El usuario ve las tarjetas al instante.
 *
 * Vista Prioridad: header con icono+color por nivel (rojo/ámbar/gris)
 * Vista Marca: header con nombre de marca + stats
 */
import { useState } from "react";
import type { ActionGroup, GroupByMode } from "@/domain/actionQueue/grouping";
import type { ViewProfile } from "@/domain/auth/types";
import { ActionCardList } from "./ActionCardList";
import { Badge } from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card/Card";
import { formatPYGSuffix } from "@/utils/format";
import { downloadGroupHtml } from "./exportHtml";
import { downloadGroupCsv } from "./exportCsv";

// ─── Priority styling ────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, { accent: string; bg: string; border: string; badge: string }> = {
  critical: {
    accent: "text-error-700 dark:text-error-400",
    bg: "bg-error-50/60 dark:bg-error-500/5",
    border: "border-l-error-500",
    badge: "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  },
  high: {
    accent: "text-warning-700 dark:text-warning-400",
    bg: "bg-warning-50/60 dark:bg-warning-500/5",
    border: "border-l-warning-500",
    badge: "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  },
  normal: {
    accent: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-50/60 dark:bg-gray-800/40",
    border: "border-l-gray-400 dark:border-l-gray-500",
    badge: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  },
};

function PriorityIcon({ level, className }: { level: string; className?: string }) {
  const cls = className ?? "h-5 w-5";
  const props = { className: cls, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 } as const;

  if (level === "critical") {
    return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>;
  }
  if (level === "high") {
    return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
  }
  return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  group: ActionGroup;
  mode: GroupByMode;
  channel: string;
  defaultExpanded?: boolean;
  viewProfile?: ViewProfile;
}

export function FlatGroupSection({ group, mode, channel, defaultExpanded = false, viewProfile = "detail" }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isPriority = mode === "priority";
  const style = isPriority ? PRIORITY_STYLES[group.key] ?? PRIORITY_STYLES.normal : null;

  const exportOptions = {
    groupLabel: group.label,
    channel,
    mode,
    items: group.items,
    sections: group.sections,
  };
  const handleExportHtml = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    downloadGroupHtml(exportOptions);
  };
  const handleExportCsv = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    downloadGroupCsv(exportOptions);
  };

  return (
    <Card padding="none" className={`transition-shadow ${expanded ? "shadow-theme-sm" : "hover:shadow-theme-sm"} ${
      ""
    }`}>
      {/* ── Header — collapsible ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02] ${
          isPriority ? style!.bg : ""
        }`}
        aria-expanded={expanded}
      >
        {/* Icon (priority only) */}
        {isPriority && (
          <span className={style!.accent}>
            <PriorityIcon level={group.key} />
          </span>
        )}

        {/* Label + stats */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-sm font-bold ${isPriority ? style!.accent : "text-gray-900 dark:text-white"}`}>
              {group.label}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold tabular-nums ${
              isPriority ? style!.badge : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {group.totalActions}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {group.uniqueSkus} SKUs
            </span>
            {group.criticalCount > 0 && (
              <Badge
                text={`${group.criticalCount} sin stock`}
                className="bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
              />
            )}
            {group.totalGapUnits > 0 && (
              <Badge
                text={`${group.totalGapUnits} gap`}
                className="bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400"
              />
            )}
          </div>
        </div>

        {/* Impact + export + chevron */}
        <div className="flex shrink-0 items-center gap-3">
          <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
            {formatPYGSuffix(group.totalImpact)}
          </p>

          {/* Export buttons */}
          <div className="flex items-center gap-1">
            <span
              role="button"
              tabIndex={0}
              onClick={handleExportHtml}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleExportHtml(e); }}
              title={`Exportar ${group.label} como HTML`}
              aria-label={`Exportar ${group.label} como HTML`}
              className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              HTML
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={handleExportCsv}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleExportCsv(e); }}
              title={`Exportar ${group.label} como CSV`}
              aria-label={`Exportar ${group.label} como CSV`}
              className="rounded-md border border-gray-200 px-2 py-1 text-[10px] font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            >
              CSV
            </span>
          </div>

          <svg
            className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* ── Cards grid — direct, no sections ── */}
      {expanded && (
        <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-700">
          <ActionCardList
            items={group.items}
            groupMode={mode}
            viewProfile={viewProfile}
          />
        </div>
      )}
    </Card>
  );
}
