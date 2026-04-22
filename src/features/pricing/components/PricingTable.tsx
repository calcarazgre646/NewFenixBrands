/**
 * features/pricing/components/PricingTable.tsx
 *
 * Tabla de precios agrupada visualmente por Marca → SKU, con pagination.
 * Patrón visual: PurchasePlanningTab (stats arriba + tabla + paginación).
 */
import { useState, useMemo } from "react";
import { calcMBP, calcMBM, isNovelty, getPromotionStatus } from "@/domain/pricing/calculations";
import { formatPYGSuffix } from "@/utils/format";
import { FEATURE_PAGE_SIZE } from "@/domain/config/defaults";
import type { PricingRow } from "@/queries/pricing.queries";

const PAGE_SIZE = FEATURE_PAGE_SIZE;

export function PricingTable({ rows }: { rows: PricingRow[] }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const paginated = useMemo(() => {
    const start = page * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, page]);

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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
              <Th>Producto</Th>
              <Th className="w-24">Línea</Th>
              <Th className="w-24 text-right">Costo</Th>
              <Th className="w-24 text-right">PVP</Th>
              <Th className="w-16 text-right">MBP%</Th>
              <Th className="w-24 text-right">PVM</Th>
              <Th className="w-16 text-right">MBM%</Th>
              <Th className="w-20 text-center">Novedad</Th>
              <Th className="w-28 text-center">Promoción</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
            {paginated.map((row, i) => {
              const prevBrand = i > 0 ? paginated[i - 1].brand : null;
              const showBrandHeader = row.brand !== prevBrand;
              const mbp = calcMBP(row.pvp, row.costo);
              const mbm = calcMBM(row.pvm, row.costo);
              const novelty = isNovelty(row.estComercial);
              const promo = getPromotionStatus(row.skuComercial || row.sku);
              return (
                <BrandGroupRow
                  key={row.sku + row.skuComercial}
                  row={row}
                  mbp={mbp}
                  mbm={mbm}
                  novelty={novelty}
                  promo={promo}
                  showBrandHeader={showBrandHeader}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-2.5 dark:border-gray-700/30">
          <span className="text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} de {rows.length}
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
  );
}

interface RowProps {
  row: PricingRow;
  mbp: number;
  mbm: number;
  novelty: boolean;
  promo: { active: boolean; markdownPct: number };
  showBrandHeader: boolean;
}

function BrandGroupRow({ row, mbp, mbm, novelty, promo, showBrandHeader }: RowProps) {
  return (
    <>
      {showBrandHeader && (
        <tr className="bg-gray-50/80 dark:bg-gray-800/70">
          <td colSpan={9} className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300">
            {row.brand}
          </td>
        </tr>
      )}
      <tr className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
        <td className="px-3 py-2.5">
          <p className="font-medium text-gray-900 dark:text-white">{row.description}</p>
          <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            {row.skuComercial || row.sku}
            {row.skuComercial && <span className="ml-1 text-gray-300 dark:text-gray-600">({row.sku})</span>}
          </p>
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
        <td className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums ${marginColor(mbp, row.pvp)}`}>
          {formatMargin(mbp, row.pvp)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-gray-700 dark:text-gray-300">
          {formatPYGSuffix(row.pvm)}
        </td>
        <td className={`whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-semibold tabular-nums ${marginColor(mbm, row.pvm)}`}>
          {formatMargin(mbm, row.pvm)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center">
          <YesNoPill yes={novelty} />
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 text-center">
          <PromoCell active={promo.active} markdownPct={promo.markdownPct} />
        </td>
      </tr>
    </>
  );
}

function formatMargin(value: number, basePrice: number): string {
  if (basePrice <= 0) return "—";
  return `${value.toFixed(1)}%`;
}

function marginColor(value: number, basePrice: number): string {
  if (basePrice <= 0) return "text-gray-300 dark:text-gray-600";
  if (value < 0) return "text-error-600 dark:text-error-400";
  if (value < 20) return "text-warning-600 dark:text-warning-400";
  return "text-success-600 dark:text-success-400";
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}

function PageBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-md px-2 py-1 text-[11px] font-medium text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700"
    >
      {children}
    </button>
  );
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
