/**
 * features/marketing/components/DryRunPreview.tsx
 *
 * Preview de clientes que matchean un trigger (dry run).
 */
import { Badge } from "@/components/ui/badge/Badge";
import { Spinner } from "@/components/ui/spinner/Spinner";
import type { SamCustomer, CustomerTier } from "@/domain/marketing/types";

interface Props {
  customers: SamCustomer[];
  isEvaluating: boolean;
  onClose: () => void;
}

const TIER_BADGE: Record<CustomerTier, { text: string; className: string }> = {
  vip: { text: "VIP", className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400" },
  frequent: { text: "Frecuente", className: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400" },
  occasional: { text: "Ocasional", className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400" },
  at_risk: { text: "En Riesgo", className: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400" },
  inactive: { text: "Inactivo", className: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400" },
};

export function DryRunPreview({ customers, isEvaluating, onClose }: Props) {
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Vista Previa</h4>
          <Badge text={`${customers.length} clientes`} className="bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400" />
          {isEvaluating && <Spinner />}
        </div>
        <button type="button" onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600" aria-label="Cerrar vista previa">
          Cerrar
        </button>
      </div>

      {customers.length > 0 && (
        <div className="max-h-60 overflow-y-auto space-y-1">
          {customers.slice(0, 100).map((c) => {
            const tier = TIER_BADGE[c.tier];
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-white dark:hover:bg-gray-800">
                <span className="font-mono text-gray-400 w-24 shrink-0">{c.ruc}</span>
                <span className="flex-1 text-gray-700 dark:text-gray-300 truncate">{c.razonSocial}</span>
                <Badge text={tier.text} className={tier.className} />
              </div>
            );
          })}
          {customers.length > 100 && (
            <p className="text-center text-xs text-gray-400 py-2">
              +{customers.length - 100} clientes más
            </p>
          )}
        </div>
      )}
    </div>
  );
}
