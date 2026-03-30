/**
 * features/action-queue/components/ActionGroupCard.tsx
 *
 * Tarjeta de grupo expandible con secciones operativas.
 *
 * Cuando se expande, muestra sub-secciones por intención operativa:
 *   - Recibir transferencias de otras tiendas
 *   - Recibir desde depósito RETAILS
 *   - Abastecer RETAILS desde STOCK
 *   - Redistribuir excedentes
 *   - Envío B2B
 *
 * Cada sección es una "orden de trabajo" concreta.
 *
 * UI refinada para consistencia con ExecutivePage/SalesPage (TailAdmin DS).
 */
import { useState, useMemo } from "react";
import type { ActionGroup, ActionSection, GroupByMode, OperationalIntent } from "@/domain/actionQueue/grouping";
import { CompactActionList } from "./CompactActionList";
import { downloadGroupHtml } from "./exportHtml";
import { Badge } from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card/Card";
import { formatPYGSuffix } from "@/utils/format";
import type { StoreCluster } from "@/domain/actionQueue/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const CLUSTER_STYLES: Record<StoreCluster, { bg: string; label: string }> = {
  A:   { bg: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", label: "Premium" },
  B:   { bg: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400", label: "Standard" },
  OUT: { bg: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", label: "Outlet" },
};

const INTENT_STYLES: Record<OperationalIntent, { color: string; bg: string; border: string }> = {
  receive_transfer: {
    color: "text-purple-700 dark:text-purple-400",
    bg: "bg-purple-50/80 dark:bg-purple-500/5",
    border: "border-l-purple-400 dark:border-l-purple-500",
  },
  receive_depot: {
    color: "text-cyan-700 dark:text-cyan-400",
    bg: "bg-cyan-50/80 dark:bg-cyan-500/5",
    border: "border-l-cyan-400 dark:border-l-cyan-500",
  },
  resupply_depot: {
    color: "text-orange-700 dark:text-orange-400",
    bg: "bg-orange-50/80 dark:bg-orange-500/5",
    border: "border-l-orange-400 dark:border-l-orange-500",
  },
  redistribute: {
    color: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50/80 dark:bg-blue-500/5",
    border: "border-l-blue-400 dark:border-l-blue-500",
  },
  ship_b2b: {
    color: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50/80 dark:bg-emerald-500/5",
    border: "border-l-emerald-400 dark:border-l-emerald-500",
  },
};

// ─── Icons ───────────────────────────────────────────────────────────────────

function ChevronIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform duration-200 ${open ? "rotate-180" : ""} ${className ?? "h-5 w-5 text-gray-400"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function IntentIcon({ intent, className }: { intent: OperationalIntent; className?: string }) {
  const cls = `${className ?? ""} h-4 w-4 shrink-0`;
  const props = { className: cls, fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 } as const;

  switch (intent) {
    case "receive_transfer":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M19 5l-7 7-7-7M19 12l-7 7-7-7" /></svg>;
    case "receive_depot":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>;
    case "resupply_depot":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4" /></svg>;
    case "redistribute":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>;
    case "ship_b2b":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0a2 2 0 104 0m-4 0a2 2 0 114 0m6-6v6a1 1 0 01-1 1h-1m-6-1a2 2 0 104 0M15 6h5l2 5" /></svg>;
  }
}

// ─── Mini stat pill ──────────────────────────────────────────────────────────

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  if (value === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${color}`}>
      {value}
      <span className="font-normal opacity-70">{label}</span>
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  group: ActionGroup;
  mode: GroupByMode;
  channel: "b2c" | "b2b";
  defaultExpanded?: boolean;
  /** Actual total units currently in the store (all SKUs). null if not available or not store view. */
  storeStock?: number | null;
}

export function ActionGroupCard({ group, mode, channel, defaultExpanded = false, storeStock = null }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const clusterInfo = group.cluster ? CLUSTER_STYLES[group.cluster] : null;

  // WOI general del grupo: promedio ponderado de MOS convertido a semanas.
  // Incluye items con stock=0 pero con historial (MOS=0 → bajan el WOI real del grupo).
  // Excluye depósitos (RETAILS/STOCK) — su MOS es semántica diferente (demanda red vs tienda individual).
  const groupWOI = useMemo(() => {
    // Collect items with meaningful data (have history OR have stock)
    const relevant = group.items.filter(
      (item) =>
        item.store !== "RETAILS" &&
        item.store !== "STOCK" &&
        (item.currentMOS > 0 || item.historicalAvg > 0),
    );
    if (relevant.length === 0) return null;

    // Weighted average by stock. Items with stock=0 contribute MOS=0 weighted by their historicalAvg
    // so they pull the group WOI down (reflecting "we sell this but have nothing").
    let totalWeight = 0;
    let weightedMOS = 0;
    for (const item of relevant) {
      const weight = item.currentStock > 0 ? item.currentStock : item.historicalAvg;
      weightedMOS += item.currentMOS * weight;
      totalWeight += weight;
    }
    if (totalWeight === 0) return null;
    const avgMOS = weightedMOS / totalWeight;
    return avgMOS * 4.33;
  }, [group.items]);

  // DOI-edad promedio del grupo (weighted by historicalAvg, como en grouping.ts)
  const groupDOI = useMemo(() => {
    let doiWeightedSum = 0;
    let doiWeightTotal = 0;
    for (const item of group.items) {
      if (item.daysOfInventory > 0 || item.historicalAvg > 0) {
        const w = item.historicalAvg > 0 ? item.historicalAvg : 1;
        doiWeightedSum += item.daysOfInventory * w;
        doiWeightTotal += w;
      }
    }
    return doiWeightTotal > 0 ? doiWeightedSum / doiWeightTotal : null;
  }, [group.items]);

  const handleExport = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    downloadGroupHtml({
      groupLabel: group.label,
      channel,
      mode,
      items: group.items,
      sections: group.sections,
    });
  };

  return (
    <Card padding="none" className={`transition-shadow ${expanded ? "shadow-theme-sm" : "hover:shadow-theme-sm"}`}>
      {/* ── Group header ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
        aria-expanded={expanded}
      >
        {/* Left: Name + metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              {group.label}
            </h3>
            {clusterInfo && (
              <Badge text={`${group.cluster} · ${clusterInfo.label}`} className={clusterInfo.bg} />
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {group.totalActions} {group.totalActions === 1 ? "acción" : "acciones"}
              <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
              {group.uniqueSkus} SKUs
              <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
              {group.sections.length} {group.sections.length === 1 ? "tarea" : "tareas"}
            </span>
            <MiniStat value={group.criticalCount} label="sin stock" color="bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400" />
            <MiniStat value={group.lowCount} label="bajo" color="bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400" />
            <MiniStat value={group.overstockCount} label="exceso" color="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" />
            {group.totalGapUnits > 0 && (
              <MiniStat value={group.totalGapUnits} label="gap" color="bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400" />
            )}
            {groupWOI !== null && (() => {
              // B2C: 13 semanas (Rodrigo 17/03/2026). B2B: brand-based (12/24).
              const wTarget = channel === "b2c" ? 13 : (group.items[0]?.coverWeeks ?? 12);
              return (
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                  groupWOI < wTarget
                    ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400"
                    : groupWOI < wTarget * 2
                    ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                }`}>
                  {groupWOI.toFixed(1)}
                  <span className="font-normal opacity-70">WOI</span>
                  <span className="font-normal text-gray-400 dark:text-gray-500">obj: {wTarget} sem</span>
                </span>
              );
            })()}
            {groupDOI !== null && groupDOI > 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                groupDOI > 180
                  ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400"
                  : groupDOI > 90
                  ? "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-400"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}>
                {groupDOI.toFixed(0)}d
                <span className="font-normal opacity-70">edad</span>
              </span>
            )}
          </div>

          {mode === "store" && group.timeRestriction && group.timeRestriction !== "—" && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {group.timeRestriction}
            </p>
          )}
        </div>

        {/* Right: Impact + export + assortment + chevron */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
              {formatPYGSuffix(group.totalImpact)}
            </p>
            <p className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
              {group.totalUnits.toLocaleString("es-PY")} u.
            </p>
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={handleExport}
            onKeyDown={(e) => { if (e.key === "Enter") handleExport(e); }}
            title={`Exportar acciones de ${group.label}`}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          {mode === "store" && (
            <OccupancyIndicator stock={storeStock} capacity={group.assortmentCapacity} />
          )}

          <ChevronIcon open={expanded} />
        </div>
      </button>

      {/* ── Expanded: operational sections ── */}
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {/* Sections summary bar */}
          <div className="flex flex-wrap items-center gap-2 bg-gray-50/60 px-5 py-2.5 dark:bg-gray-800/40">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Tareas
            </span>
            {group.sections.map((s) => {
              const st = INTENT_STYLES[s.intent];
              return (
                <span
                  key={s.intent}
                  className={`inline-flex items-center gap-1.5 rounded-full border-l-[3px] py-0.5 pl-2 pr-2.5 text-[10px] font-medium ${st.border} ${st.bg} ${st.color}`}
                >
                  <IntentIcon intent={s.intent} className={`h-3 w-3 ${st.color}`} />
                  {s.items.length}
                </span>
              );
            })}
          </div>

          {group.sections.map((section) => (
            <SectionCard
              key={section.intent}
              section={section}
              groupMode={mode}
              channel={channel}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Section diagnosis ──────────────────────────────────────────────────────

function buildSectionDiagnosis(section: ActionSection, channel: "b2c" | "b2b"): string | null {
  const items = section.items;
  if (items.length === 0) return null;

  // B2C: 13 semanas (Rodrigo 17/03/2026). B2B: coverWeeks de la marca (12/24).
  const wTarget = channel === "b2c" ? 13 : (items[0]?.coverWeeks ?? 12);

  const criticalCount = items.filter(i => i.risk === "critical").length;
  const lowCount = items.filter(i => i.risk === "low").length;
  const overstockCount = items.filter(i => i.risk === "overstock").length;

  // Compute weighted average WOI for store items (exclude depots)
  const storeItems = items.filter(
    i => i.store !== "RETAILS" && i.store !== "STOCK" && (i.currentMOS > 0 || i.historicalAvg > 0),
  );
  let avgWOI: number | null = null;
  if (storeItems.length > 0) {
    let totalWeight = 0;
    let weightedMOS = 0;
    for (const item of storeItems) {
      const w = item.currentStock > 0 ? item.currentStock : item.historicalAvg;
      weightedMOS += item.currentMOS * w;
      totalWeight += w;
    }
    if (totalWeight > 0) avgWOI = (weightedMOS / totalWeight) * 4.33;
  }

  const { intent } = section;

  // Deficit intents: receive_transfer, receive_depot, resupply_depot
  if (intent === "receive_transfer" || intent === "receive_depot" || intent === "resupply_depot") {
    const parts: string[] = [];
    if (criticalCount > 0) parts.push(`${criticalCount} SKU${criticalCount > 1 ? "s" : ""} sin stock`);
    if (lowCount > 0) parts.push(`${lowCount} con stock bajo`);
    if (avgWOI !== null) {
      parts.push(`cobertura prom. ${avgWOI.toFixed(1)} sem (obj: ${wTarget})`);
    }
    return parts.length > 0 ? parts.join(", ") : null;
  }

  // Surplus intents: redistribute, ship_b2b
  if (intent === "redistribute" || intent === "ship_b2b") {
    if (avgWOI !== null && avgWOI > wTarget) {
      const multiple = avgWOI / wTarget;
      if (multiple >= 2) {
        return `Stock para ${Math.round(avgWOI)} sem promedio — ${Math.round(multiple)}× más del objetivo`;
      }
      return `Cobertura prom. ${avgWOI.toFixed(1)} sem — por encima del objetivo de ${wTarget}`;
    }
    if (overstockCount > 0) {
      return `${overstockCount} SKU${overstockCount > 1 ? "s" : ""} con excedente a redistribuir`;
    }
    return null;
  }

  return null;
}

// ─── Section card (work order) ───────────────────────────────────────────────

function SectionCard({
  section,
  groupMode,
  channel,
}: {
  section: ActionSection;
  groupMode: GroupByMode;
  channel: "b2c" | "b2b";
}) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);

  const style = INTENT_STYLES[section.intent];
  const totalPages = Math.ceil(section.items.length / PAGE_SIZE);

  const paginatedItems = useMemo(() => {
    const start = page * PAGE_SIZE;
    return section.items.slice(start, start + PAGE_SIZE);
  }, [section.items, page]);

  const diagnosis = useMemo(() => buildSectionDiagnosis(section, channel), [section, channel]);

  return (
    <div className="border-t border-gray-100 first:border-t-0 last:overflow-hidden last:rounded-b-2xl dark:border-gray-700/50">
      {/* Section header */}
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 px-5 py-3 text-left transition-colors ${style.bg} hover:brightness-[0.98] dark:hover:brightness-110`}
        aria-expanded={open}
      >
        <IntentIcon intent={section.intent} className={style.color} />
        <div className="min-w-0 flex-1">
          <div>
            <span className={`text-xs font-bold ${style.color}`}>
              {section.label}
            </span>
            <span className="ml-2 text-[11px] text-gray-500 dark:text-gray-400">
              {section.items.length} {section.items.length === 1 ? "acción" : "acciones"}
              <span className="mx-1 text-gray-300 dark:text-gray-600">·</span>
              {section.totalUnits.toLocaleString("es-PY")} u.
            </span>
            {section.criticalCount > 0 && (
              <Badge
                text={`${section.criticalCount} sin stock`}
                className="ml-2 bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400"
              />
            )}
          </div>
          {diagnosis && (
            <p className="mt-0.5 text-[10px] italic text-gray-500 dark:text-gray-400">
              {diagnosis}
            </p>
          )}
        </div>
        <ChevronIcon open={open} className="h-4 w-4 text-gray-400" />
      </button>

      {/* Section table */}
      {open && (
        <div>
          <CompactActionList
            items={paginatedItems}
            intent={section.intent}
            groupMode={groupMode}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5 dark:border-gray-700/30">
              <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, section.items.length)} de {section.items.length}
              </span>
              <div className="flex items-center gap-0.5">
                <PageBtn onClick={() => setPage(0)} disabled={page === 0}>&laquo;</PageBtn>
                <PageBtn onClick={() => setPage(p => p - 1)} disabled={page === 0}>&lsaquo;</PageBtn>
                <span className="px-2.5 text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-400">
                  {page + 1}/{totalPages}
                </span>
                <PageBtn onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>&rsaquo;</PageBtn>
                <PageBtn onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>&raquo;</PageBtn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Occupancy indicator ─────────────────────────────────────────────────────

function OccupancyIndicator({ stock, capacity }: { stock: number | null; capacity: number | null }) {
  if (stock === null) return null;

  // Has stock but no capacity defined — show stock count, flag missing capacity
  if (!capacity || capacity <= 0) {
    return (
      <div className="hidden w-20 text-right sm:block">
        <p className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
          {Math.round(stock).toLocaleString("es-PY")} u.
        </p>
        <p className="text-[9px] text-gray-400 dark:text-gray-500">Cap. sin datos</p>
      </div>
    );
  }

  // Full data: real stock / capacity
  const pct = (stock / capacity) * 100;
  const barWidth = Math.min(pct, 100);
  const over = pct > 100;
  const color =
    over       ? "bg-error-500"   :
    pct > 90   ? "bg-orange-500"  :
    pct > 70   ? "bg-warning-500" :
                 "bg-success-500";
  const pctColor =
    over       ? "text-error-600 dark:text-error-400 font-semibold" :
                 "text-gray-500 dark:text-gray-400";

  return (
    <div className="hidden w-20 sm:block" title={`${Math.round(stock).toLocaleString("es-PY")} / ${capacity.toLocaleString("es-PY")} unidades en tienda`}>
      <div className="flex items-center justify-between text-[9px]">
        <span className="text-gray-400 dark:text-gray-500">Ocupación</span>
        <span className={`tabular-nums ${pctColor}`}>{Math.round(pct)}%</span>
      </div>
      <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${barWidth}%` }} />
      </div>
    </div>
  );
}

// ─── Page button ─────────────────────────────────────────────────────────────

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
}
