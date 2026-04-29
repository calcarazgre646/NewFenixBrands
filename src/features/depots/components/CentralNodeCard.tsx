/**
 * features/depots/components/CentralNodeCard.tsx
 *
 * Card de nodo central (STOCK o RETAILS) — desplegable + filtro por marca.
 *
 * Patrón Oracle Retail / Foundry: header colapsable con KPIs sticky,
 * brand chips para drill-by dentro del card, tabla de categorías que
 * se filtra al elegir marca. Stock y Retails mantienen estado independiente.
 *
 * Pedido cliente (Rodrigo, 31/03): "Stock y Retail como tarjetas
 * desplegables. En cada depósito seleccionar marca → filtra categorías".
 */
import { useMemo, useState } from "react";
import { formatNumber, formatPYGCompact, formatWeeks } from "@/utils/format";
import type { CentralNode, GroupBreakdown } from "@/domain/depots/types";
import RiskBadge from "./RiskBadge";

interface Props {
  node: CentralNode;
  /** Estado inicial del accordion. Default: abierto. */
  defaultOpen?: boolean;
}

export default function CentralNodeCard({ node, defaultOpen = true }: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);

  const headerId = `central-${node.key}-header`;
  const bodyId = `central-${node.key}-body`;

  const availableBrands = useMemo(
    () => node.topBrands.map((b) => b.label),
    [node.topBrands],
  );
  const showBrandSelector = availableBrands.length > 1;

  const categoryRows: GroupBreakdown[] = useMemo(() => {
    if (!activeBrand) return node.topCategories;
    return node.categoriesByBrand[activeBrand] ?? [];
  }, [activeBrand, node.topCategories, node.categoriesByBrand]);

  const maxBrandUnits = useMemo(
    () => Math.max(1, ...node.topBrands.map((b) => b.units)),
    [node.topBrands],
  );
  const maxCategoryUnits = useMemo(
    () => Math.max(1, ...categoryRows.map((c) => c.units)),
    [categoryRows],
  );

  const categoriesLabel = activeBrand ? `Categorías · ${activeBrand}` : "Categorías";

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header — toggle + stats sticky (visibles aún colapsado) */}
      <button
        id={headerId}
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full flex-col gap-2 px-5 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-white/[0.02]"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              {node.label}
            </h2>
            <RiskBadge risk={node.risk} />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold tabular-nums leading-none text-gray-900 dark:text-white">
                {formatWeeks(node.weeksOnHand)}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                WOI
              </span>
            </div>
            <svg
              className={`h-3 w-3 shrink-0 text-gray-400 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{node.subtitle}</p>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-1">
          <Stat label="Unidades" value={formatNumber(node.units)} />
          <Stat label="Valor" value={formatPYGCompact(node.value)} />
          <Stat label="Dem./sem." value={formatNumber(node.weeklyDemand)} />
          <Stat label="SKU/Talle" value={formatNumber(node.skuCount)} />
        </div>
      </button>

      {/* Body — colapsable */}
      {isOpen && (
        <div
          id={bodyId}
          role="region"
          aria-labelledby={headerId}
          className="border-t border-gray-100 bg-gray-50/40 px-5 py-4 dark:border-gray-700 dark:bg-white/[0.01]"
        >
          {showBrandSelector && (
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Filtrar por marca
                </span>
                {activeBrand && (
                  <button
                    type="button"
                    onClick={() => setActiveBrand(null)}
                    className="text-[10px] font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    Reiniciar
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <BrandChip
                  label="Todas"
                  active={activeBrand === null}
                  onClick={() => setActiveBrand(null)}
                />
                {availableBrands.map((b) => (
                  <BrandChip
                    key={b}
                    label={b}
                    active={activeBrand === b}
                    onClick={() => setActiveBrand(activeBrand === b ? null : b)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <BreakdownTable
              dimension="brand"
              rows={node.topBrands}
              maxUnits={maxBrandUnits}
              activeLabel={activeBrand}
            />
            <BreakdownTable
              dimension="category"
              titleOverride={categoriesLabel}
              rows={categoryRows}
              maxUnits={maxCategoryUnits}
              emptyHint={
                activeBrand && categoryRows.length === 0
                  ? `Sin categorías para ${activeBrand}`
                  : undefined
              }
            />
          </div>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {label}
      </span>
      <span className="block text-sm font-bold tabular-nums text-gray-900 dark:text-white">
        {value}
      </span>
    </div>
  );
}

function BrandChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${
        active
          ? "border-brand-500 bg-brand-500 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
      }`}
    >
      {label}
    </button>
  );
}

function BreakdownTable({
  dimension,
  rows,
  maxUnits,
  activeLabel,
  titleOverride,
  emptyHint,
}: {
  dimension: "brand" | "category";
  rows: GroupBreakdown[];
  maxUnits: number;
  activeLabel?: string | null;
  titleOverride?: string;
  emptyHint?: string;
}) {
  const title = titleOverride ?? (dimension === "brand" ? "Marcas" : "Categorías");
  const colHeader = dimension === "brand" ? "Marca" : "Categoría";

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-700">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {title}
        </h3>
      </div>
      {rows.length === 0 ? (
        <div className="px-3 py-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
          {emptyHint ?? "Sin datos"}
        </div>
      ) : (
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-600">
              <th className="px-3 py-1.5 text-left text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                {colHeader}
              </th>
              <th className="px-3 py-1.5 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Uds.
              </th>
              <th className="hidden sm:table-cell px-3 py-1.5 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                Valor
              </th>
              <th className="px-3 py-1.5 text-right text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                WOI
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {rows.map((row, i) => {
              const isActive = activeLabel === row.label;
              const fillPct = Math.max(0, Math.min(100, (row.units / maxUnits) * 100));
              return (
                <tr
                  key={`${row.label}-${i}`}
                  className={`transition-colors ${
                    isActive
                      ? "bg-brand-50/70 dark:bg-brand-500/10"
                      : "hover:bg-gray-50/70 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <td
                    className={`px-3 py-1.5 font-medium text-gray-800 dark:text-white ${
                      isActive ? "border-l-2 border-brand-500" : ""
                    }`}
                  >
                    {row.label}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className="hidden h-1 w-10 overflow-hidden rounded-full bg-gray-100 sm:inline-block dark:bg-gray-700"
                        aria-hidden
                      >
                        <span
                          className={`block h-full rounded-full ${
                            isActive
                              ? "bg-brand-500"
                              : "bg-brand-300/60 dark:bg-brand-500/40"
                          }`}
                          style={{ width: `${fillPct}%` }}
                        />
                      </span>
                      <span>{formatNumber(row.units)}</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                    {formatPYGCompact(row.value)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-gray-800 dark:text-white">
                    {formatWeeks(row.woi)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
