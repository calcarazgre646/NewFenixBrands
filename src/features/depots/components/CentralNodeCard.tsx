/**
 * features/depots/components/CentralNodeCard.tsx
 *
 * Card de nodo central (STOCK o RETAILS).
 * Patrón de diseño: MonthlyPerformanceTable (ExecutivePage).
 */
import { formatNumber, formatPYGCompact, formatWeeks } from "@/utils/format";
import type { CentralNode } from "@/domain/depots/types";
import RiskBadge from "./RiskBadge";
import MiniTable from "./MiniTable";

interface Props {
  node: CentralNode;
}

export default function CentralNodeCard({ node }: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">
            {node.label}
          </h2>
          <RiskBadge risk={node.risk} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold tabular-nums leading-none text-gray-900 dark:text-white">
            {formatWeeks(node.weeksOnHand)}
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            WOI
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <Stat label="Unidades" value={formatNumber(node.units)} />
        <Stat label="Valor" value={formatPYGCompact(node.value)} />
        <Stat label="Dem. sem." value={formatNumber(node.weeklyDemand)} />
        <Stat label="SKU/Talle" value={formatNumber(node.skuCount)} />
      </div>

      {/* Tables */}
      <div className="grid sm:grid-cols-2">
        <div className="border-b border-gray-100 sm:border-b-0 sm:border-r dark:border-gray-700">
          <MiniTable
            title="Marcas"
            headers={["Marca", "Uds.", "Valor", "WOI"]}
            rows={node.topBrands.map(r => [r.label, formatNumber(r.units), formatPYGCompact(r.value), formatWeeks(r.woi)])}
          />
        </div>
        <div>
          <MiniTable
            title="Categorias"
            headers={["Categoria", "Uds.", "Valor", "WOI"]}
            rows={node.topCategories.map(r => [r.label, formatNumber(r.units), formatPYGCompact(r.value), formatWeeks(r.woi)])}
          />
        </div>
      </div>
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
