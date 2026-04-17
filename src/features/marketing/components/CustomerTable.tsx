/**
 * features/marketing/components/CustomerTable.tsx
 *
 * Tabla paginada de clientes SAM con búsqueda y filtro de tier.
 */
import { Badge } from "@/components/ui/badge/Badge";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamCustomer, CustomerTier } from "@/domain/marketing/types";

interface Props {
  customers: SamCustomer[];
  total: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  tierFilter: CustomerTier | "all";
  onTierFilterChange: (v: CustomerTier | "all") => void;
  page: number;
  onPageChange: (p: number) => void;
  pageSize: number;
}

const TIER_BADGE: Record<CustomerTier, { text: string; className: string }> = {
  vip: { text: "VIP", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  frequent: { text: "Frecuente", className: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  occasional: { text: "Ocasional", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  at_risk: { text: "En Riesgo", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  inactive: { text: "Inactivo", className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" },
};

function fmtGs(n: number): string {
  if (n === 0) return "—";
  return `₲ ${n.toLocaleString("es-PY")}`;
}

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
}

export function CustomerTable({
  customers,
  total,
  isLoading,
  search,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  page,
  onPageChange,
  pageSize,
}: Props) {
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, RUC o código..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 w-64"
          aria-label="Buscar clientes"
        />
        <select
          value={tierFilter}
          onChange={(e) => onTierFilterChange(e.target.value as CustomerTier | "all")}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          aria-label="Filtrar por tier"
        >
          <option value="all">Todos los tiers</option>
          <option value="vip">VIP</option>
          <option value="frequent">Frecuente</option>
          <option value="occasional">Ocasional</option>
          <option value="at_risk">En Riesgo</option>
          <option value="inactive">Inactivo</option>
        </select>
        <span className="text-xs text-gray-400">{total.toLocaleString("es-PY")} clientes</span>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : customers.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          {search || tierFilter !== "all" ? "Sin resultados para los filtros aplicados" : "Sin clientes. Ejecutá el ETL primero."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-3">RUC</th>
                <th className="px-4 py-3">Razón Social</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3 text-center">Cuentas</th>
                <th className="px-4 py-3">Teléfono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Última Compra</th>
                <th className="px-4 py-3 text-right">Total Gs.</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {customers.map((c) => {
                const tierInfo = TIER_BADGE[c.tier];
                return (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">{c.ruc}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.razonSocial}</td>
                    <td className="px-4 py-3"><Badge text={tierInfo.text} className={tierInfo.className} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-center tabular-nums text-gray-600 dark:text-gray-400">{c.codeCount}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600 dark:text-gray-400">{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{c.email ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-gray-600 dark:text-gray-400">{fmtDate(c.lastPurchase)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-gray-900 dark:text-white">{fmtGs(c.totalSpent)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right tabular-nums ${c.hasPendingDebt ? "text-red-600 dark:text-red-400" : "text-gray-400"}`}>
                      {c.hasPendingDebt ? fmtGs(c.pendingAmount) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Página {page + 1} de {totalPages}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => onPageChange(page - 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              aria-label="Página anterior"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => onPageChange(page + 1)}
              className="rounded-lg border border-gray-200 px-3 py-1.5 disabled:opacity-40 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              aria-label="Página siguiente"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
