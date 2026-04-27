/**
 * features/pricing/components/PricingTable.tsx
 *
 * Tabla de precios con scroll, cabecera fija (sticky) y orden por columna.
 * Sin paginación. Click en header para ordenar (asc/desc).
 */
import { useState, useMemo } from "react";
import { calcMBP, calcMBM, isNovelty, getPromotionStatus, MIN_VALID_PRICE } from "@/domain/pricing/calculations";
import { formatPYGSuffix } from "@/utils/format";
import type { PricingRow } from "@/queries/pricing.queries";

type SortKey =
  | "brand"
  | "description"
  | "linea"
  | "costo"
  | "pvp"
  | "mbp"
  | "pvm"
  | "mbm"
  | "novelty"
  | "promo";
type SortDir = "asc" | "desc";

interface EnrichedRow extends PricingRow {
  mbp: number;
  mbm: number;
  novelty: boolean;
  promoActive: boolean;
  promoMarkdown: number;
}

export function PricingTable({ rows }: { rows: PricingRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("brand");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const enriched: EnrichedRow[] = useMemo(
    () =>
      rows.map(r => {
        const promo = getPromotionStatus(r.skuComercial || r.sku);
        return {
          ...r,
          mbp: calcMBP(r.pvp, r.costo),
          mbm: calcMBM(r.pvm, r.costo),
          novelty: isNovelty(r.estComercial),
          promoActive: promo.active,
          promoMarkdown: promo.markdownPct,
        };
      }),
    [rows]
  );

  const sorted = useMemo(() => {
    const arr = [...enriched];
    arr.sort((a, b) => {
      const cmp = compareRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [enriched, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(defaultDirFor(key));
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No hay SKUs para los filtros seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div className="exec-anim-3 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="max-h-[calc(100vh-340px)] min-h-[400px] overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
              <SortableTh sortKey="description" current={sortKey} dir={sortDir} onSort={handleSort}>Producto</SortableTh>
              <SortableTh sortKey="brand"       current={sortKey} dir={sortDir} onSort={handleSort} className="w-24">Marca</SortableTh>
              <SortableTh sortKey="linea"       current={sortKey} dir={sortDir} onSort={handleSort} className="w-24">Línea</SortableTh>
              <SortableTh sortKey="costo"       current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="w-24">Costo</SortableTh>
              <SortableTh sortKey="pvp"         current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="w-24">PVP</SortableTh>
              <SortableTh sortKey="mbp"         current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="w-16">MBP%</SortableTh>
              <SortableTh sortKey="pvm"         current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="w-24">PVM</SortableTh>
              <SortableTh sortKey="mbm"         current={sortKey} dir={sortDir} onSort={handleSort} align="right" className="w-16">MBM%</SortableTh>
              <SortableTh sortKey="novelty"     current={sortKey} dir={sortDir} onSort={handleSort} align="center" className="w-20">Novedad</SortableTh>
              <SortableTh sortKey="promo"       current={sortKey} dir={sortDir} onSort={handleSort} align="center" className="w-28">Promoción</SortableTh>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
            {sorted.map(row => (
              <tr key={row.skuComercial || row.sku} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
                <td className="px-3 py-2.5">
                  <p className="font-medium text-gray-900 dark:text-white">{row.description}</p>
                  <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                    {row.skuComercial || row.sku}
                    {row.skuComercial && <span className="ml-1 text-gray-300 dark:text-gray-600">({row.sku})</span>}
                  </p>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
                  {row.brand}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-gray-500 dark:text-gray-400">
                  {row.linea}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-700 dark:text-gray-300">
                  {formatPYGSuffix(row.costo)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-900 dark:text-white">
                  {formatPYGSuffix(row.pvp)}
                </td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums ${marginColor(row.mbp, row.pvp, row.costo)}`}>
                  {formatMargin(row.mbp, row.pvp, row.costo)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-700 dark:text-gray-300">
                  {formatPYGSuffix(row.pvm)}
                </td>
                <td className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums ${marginColor(row.mbm, row.pvm, row.costo)}`}>
                  {formatMargin(row.mbm, row.pvm, row.costo)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <YesNoPill yes={row.novelty} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-center">
                  <PromoCell active={row.promoActive} markdownPct={row.promoMarkdown} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2 dark:border-gray-700/30">
        <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
          {rows.length} {rows.length === 1 ? "SKU" : "SKUs"}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-gray-300 dark:text-gray-600">
          Click en columna para ordenar
        </span>
      </div>
    </div>
  );
}

function compareRows(a: EnrichedRow, b: EnrichedRow, key: SortKey): number {
  switch (key) {
    case "brand":       return a.brand.localeCompare(b.brand) || a.description.localeCompare(b.description);
    case "description": return a.description.localeCompare(b.description);
    case "linea":       return a.linea.localeCompare(b.linea);
    case "costo":       return a.costo - b.costo;
    case "pvp":         return a.pvp - b.pvp;
    case "pvm":         return a.pvm - b.pvm;
    case "mbp":         return a.mbp - b.mbp;
    case "mbm":         return a.mbm - b.mbm;
    case "novelty":     return Number(a.novelty) - Number(b.novelty);
    case "promo":       return Number(a.promoActive) - Number(b.promoActive);
  }
}

// Numéricos y booleanos: por defecto descendente (lo más alto / "Sí" arriba).
// Texto: por defecto ascendente (A → Z).
function defaultDirFor(key: SortKey): SortDir {
  if (key === "brand" || key === "description" || key === "linea") return "asc";
  return "desc";
}

function isPlaceholderMargin(basePrice: number, costo: number): boolean {
  return basePrice < MIN_VALID_PRICE || costo < MIN_VALID_PRICE;
}

function formatMargin(value: number, basePrice: number, costo: number): string {
  if (isPlaceholderMargin(basePrice, costo)) return "—";
  return `${value.toFixed(1)}%`;
}

function marginColor(value: number, basePrice: number, costo: number): string {
  if (isPlaceholderMargin(basePrice, costo)) return "text-gray-300 dark:text-gray-600";
  if (value < 0) return "text-error-600 dark:text-error-400";
  if (value < 20) return "text-warning-600 dark:text-warning-400";
  return "text-success-600 dark:text-success-400";
}

interface SortableThProps {
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right" | "center";
  className?: string;
  children: React.ReactNode;
}

function SortableTh({ sortKey, current, dir, onSort, align = "left", className, children }: SortableThProps) {
  const isActive = current === sortKey;
  const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const justifyClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${alignClass} ${
        isActive ? "text-brand-600 dark:text-brand-400" : "text-gray-400 dark:text-gray-500"
      } ${className ?? ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex w-full items-center gap-1 ${justifyClass} cursor-pointer select-none transition-colors hover:text-brand-600 dark:hover:text-brand-400`}
      >
        <span>{children}</span>
        <SortIndicator active={isActive} dir={dir} />
      </button>
    </th>
  );
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) {
    return <span className="text-[8px] text-gray-300 dark:text-gray-600">▲▼</span>;
  }
  return <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>;
}

function YesNoPill({ yes }: { yes: boolean }) {
  if (yes) {
    return (
      <span className="inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
        Sí
      </span>
    );
  }
  return <span className="text-[11px] text-gray-300 dark:text-gray-600">No</span>;
}

function PromoCell({ active, markdownPct }: { active: boolean; markdownPct: number }) {
  if (!active) {
    return <span className="text-[11px] text-gray-300 dark:text-gray-600">No</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 dark:bg-warning-500/20 dark:text-warning-300">
      Sí
      <span className="tabular-nums opacity-80">−{markdownPct.toFixed(0)}%</span>
    </span>
  );
}
