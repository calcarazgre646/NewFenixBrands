/**
 * LogisticsTable.tsx
 *
 * Tabla agrupada por status con secciones coloreadas (patron ActionQueue).
 * Cada seccion tiene header con border-l accent, label + count + unidades.
 * GroupRow expandible, ChildRow para detalle de linea.
 *
 * Responsive: columnas Origen, PVP B2C, Margen B2C ocultas en mobile.
 * Sin min-width forzado — la tabla se adapta al viewport.
 */
import { Badge } from "@/components/ui/badge/Badge";
import { Card } from "@/components/ui/card/Card";
import { statusLabel } from "@/domain/logistics/arrivals";
import type { LogisticsArrival, LogisticsGroup, StatusSection } from "@/domain/logistics/types";
import { STATUS_STYLE, STATUS_ACCENT, ERP_STATUS_STYLE, erpStatusLabel, pvpRange, marginRange, ChevronIcon } from "./logistics.shared";

// ─── Column definitions with responsive visibility ──────────────────────────

const COLS: { label: string; className?: string }[] = [
  { label: "" },
  { label: "Marca" },
  { label: "Proveedor" },
  { label: "Estado" },
  { label: "Unidades" },
  { label: "ETA" },
  { label: "Categorias" },
  { label: "Origen" },
  { label: "PVP B2C" },
  { label: "Margen" },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface TableProps {
  sections: StatusSection[];
  expanded: Set<string>;
  onToggleGroup: (key: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  totalGroups: number;
}

// ─── Child Row ──────────────────────────────────────────────────────────────

function ChildRow({ row }: { row: LogisticsArrival }) {
  return (
    <tr className="bg-gray-50/60 transition-colors hover:bg-gray-50 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]">
      {/* 1. Chevron spacer */}
      <td className="px-2 py-2" />
      {/* 2-3. Descripción + Color (spans Marca + Proveedor cols) */}
      <td colSpan={2} className="px-2 py-2">
        <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
          {row.description || "Sin descripcion"}
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {row.season && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              Temp. {row.season}
            </span>
          )}
          {row.color && (
            <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full border border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-600" />
              {row.color}
            </span>
          )}
        </div>
      </td>
      {/* 4. Estado spacer */}
      <td className="px-2 py-2" />
      {/* 5. Unidades */}
      <td className="px-2 py-2">
        <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {row.quantity.toLocaleString("es-PY")}
        </span>
      </td>
      {/* 6. ETA spacer */}
      <td className="px-2 py-2" />
      {/* 7. Categoria */}
      <td className="px-2 py-2">
        {row.category ? (
          <Badge text={row.category} className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" />
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
      {/* 8. Origen spacer */}
      <td className="px-2 py-2" />
      {/* 9. PVP B2C */}
      <td className="whitespace-nowrap px-2 py-2 text-xs tabular-nums text-gray-600 dark:text-gray-400">
        {row.pvpB2C > 0 ? row.pvpB2C.toLocaleString("es-PY") : "—"}
      </td>
      {/* 10. Margen */}
      <td className="px-2 py-2">
        {row.marginB2C > 0 ? (
          <span className="text-xs font-semibold text-success-600 dark:text-success-400">{row.marginB2C}%</span>
        ) : (
          <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Group Row ──────────────────────────────────────────────────────────────

function GroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: LogisticsGroup;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const margin = marginRange(group.rows);

  return (
    <>
      <tr
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        tabIndex={0}
        role="row"
        aria-expanded={isExpanded}
        className={`cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.02] ${
          group.status === "past" ? "opacity-50" : ""
        } ${group.status === "overdue" ? "bg-error-50/30 dark:bg-error-500/[0.03]" : ""}`}
      >
        {/* 1. Expand chevron */}
        <td className="w-8 px-2 py-2.5">
          <ChevronIcon open={isExpanded} />
        </td>
        {/* 2. Marca */}
        <td className="whitespace-nowrap px-2 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-300">
          {group.brand}
        </td>
        {/* 3. OC + Proveedor */}
        <td className="px-2 py-2.5">
          {group.purchaseOrder ? (
            <>
              <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-200">
                OC {group.purchaseOrder}
              </span>
              <span className="block truncate max-w-[120px] text-[10px] text-gray-400 dark:text-gray-500">
                {group.supplier}
              </span>
            </>
          ) : (
            <span className="truncate block max-w-[120px] text-xs font-semibold text-gray-600 dark:text-gray-300">
              {group.supplier || "—"}
            </span>
          )}
        </td>
        {/* 4. Estado (date + ERP pipeline) */}
        <td className="px-2 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            <Badge
              text={statusLabel(group.status, group.daysUntil)}
              className={STATUS_STYLE[group.status]}
            />
            {group.erpStatus && (
              <Badge
                text={erpStatusLabel(group.erpStatus)}
                className={ERP_STATUS_STYLE[group.erpStatus] ?? "bg-gray-100 text-gray-500"}
              />
            )}
          </div>
        </td>
        {/* 5. Unidades */}
        <td className="px-2 py-2.5">
          <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
            {group.totalUnits.toLocaleString("es-PY")}
          </span>
          {group.rows.length > 1 && (
            <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">
              ({group.rows.length})
            </span>
          )}
        </td>
        {/* 6. ETA */}
        <td className="whitespace-nowrap px-2 py-2.5">
          <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {group.dateLabel}
          </span>
        </td>
        {/* 7. Categorias */}
        <td className="px-2 py-2.5">
          <div className="flex flex-wrap gap-1">
            {group.categories.slice(0, 2).map(c => (
              <Badge
                key={c}
                text={c}
                className="bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
              />
            ))}
            {group.categories.length > 2 && (
              <span className="text-xs text-gray-400 dark:text-gray-500">
                +{group.categories.length - 2}
              </span>
            )}
          </div>
        </td>
        {/* 8. Origen */}
        <td className="whitespace-nowrap px-2 py-2.5 text-xs text-gray-500 dark:text-gray-400">
          {group.origin || "—"}
        </td>
        {/* 9. PVP B2C */}
        <td className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
          {pvpRange(group.rows)}
        </td>
        {/* 10. Margen */}
        <td className="px-2 py-2.5">
          {margin.value > 0 ? (
            <span className="text-xs font-semibold text-success-600 dark:text-success-400">{margin.label}</span>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600">—</span>
          )}
        </td>
      </tr>
      {isExpanded && group.rows.map((row, ri) => (
        <ChildRow key={`${group.key}-${row.description}-${row.color}-${ri}`} row={row} />
      ))}
    </>
  );
}

// ─── Section Header Row ─────────────────────────────────────────────────────

function SectionHeader({ section }: { section: StatusSection }) {
  return (
    <tr>
      <td colSpan={COLS.length} className="px-0 py-0">
        <div
          className={`flex items-center gap-3 border-l-[3px] ${STATUS_ACCENT[section.status]} bg-gray-50/80 px-4 py-2 dark:bg-gray-800/50`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {section.label}
          </span>
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
            ({section.groups.length})
          </span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            · {section.totalUnits.toLocaleString("es-PY")} uds
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Table ─────────────────────────────────────────────────────────────

export function LogisticsTable({
  sections,
  expanded,
  onToggleGroup,
  onExpandAll,
  onCollapseAll,
  totalGroups,
}: TableProps) {
  const hasGroups = totalGroups > 0;

  return (
    <Card padding="none" className="exec-anim-4">
      {/* Toolbar */}
      {hasGroups && (
        <div className="flex items-center justify-end gap-2 border-b border-gray-100 px-4 py-2 dark:border-gray-700">
          {expanded.size < totalGroups && (
            <button
              onClick={onExpandAll}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Expandir todo
            </button>
          )}
          {expanded.size > 0 && (
            <button
              onClick={onCollapseAll}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              Colapsar todo
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
            {COLS.map((col, i) => (
              <th
                key={col.label || `col-${i}`}
                scope="col"
                className={`whitespace-nowrap px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 ${col.className ?? ""} ${
                  i === 0 ? "w-8" : ""
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {!hasGroups ? (
            <tr>
              <td colSpan={COLS.length} className="px-6 py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                No hay pedidos para los filtros seleccionados.
              </td>
            </tr>
          ) : (
            sections.map(section => (
              <SectionRows
                key={section.status}
                section={section}
                expanded={expanded}
                onToggleGroup={onToggleGroup}
              />
            ))
          )}
        </tbody>
      </table>
      </div>
    </Card>
  );
}

function SectionRows({
  section,
  expanded,
  onToggleGroup,
}: {
  section: StatusSection;
  expanded: Set<string>;
  onToggleGroup: (key: string) => void;
}) {
  return (
    <>
      <SectionHeader section={section} />
      {section.groups.map(group => (
        <GroupRow
          key={group.key}
          group={group}
          isExpanded={expanded.has(group.key)}
          onToggle={() => onToggleGroup(group.key)}
        />
      ))}
    </>
  );
}
