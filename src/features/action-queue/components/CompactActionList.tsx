/**
 * features/action-queue/components/CompactActionList.tsx
 *
 * Lista compacta tipo "ticket" para secciones operativas.
 *
 * Orden de lectura optimizado para operadores:
 *   1. Producto (qué) — descripción + talle fusionado + SKU secundario
 *   2. Estado (situación actual) — stock + riesgo compactados
 *   3. Instrucción (qué hacer) — columna hero, frase natural con TODOS los contrapartes
 *
 * Principios UX:
 *   - Cada fila se lee como una instrucción, no como datos tabulares
 *   - Talle es atributo del producto, no del movimiento → fusionado con producto
 *   - La instrucción es la columna más ancha y con mayor peso visual
 *   - El contexto de sección (intent) ya dice la dirección general;
 *     la instrucción da el detalle específico
 *
 * UI refinada para consistencia con design system TailAdmin.
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { RiskLevel, StoreCluster } from "@/domain/actionQueue/types";
import type { GroupByMode, OperationalIntent } from "@/domain/actionQueue/grouping";
import { Badge } from "@/components/ui/badge/Badge";

// ─── Styles ──────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, string> = {
  critical:  "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  low:       "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  overstock: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  balanced:  "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical:  "Sin Stock",
  low:       "Stock Bajo",
  overstock: "Sobrestock",
  balanced:  "OK",
};

const CLUSTER_STYLES: Record<StoreCluster, string> = {
  A:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  B:   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  OUT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
};

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  intent: OperationalIntent;
  groupMode: GroupByMode;
}

export function CompactActionList({ items, intent, groupMode }: Props) {
  if (items.length === 0) return null;

  const showStore = groupMode === "brand";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
            <Th className="w-8 text-center">#</Th>
            {showStore && <Th>Tienda</Th>}
            <Th>Producto</Th>
            <Th className="w-14 text-center">Talle</Th>
            <Th className="w-28 text-center">Estado</Th>
            <UnitsHeader intent={intent} />
            <CounterpartHeader intent={intent} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700/40">
          {items.map((item, i) => (
            <tr key={item.id} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
              {/* Row number */}
              <td className="px-3 py-2.5 text-center text-[11px] tabular-nums text-gray-300 dark:text-gray-600">
                {i + 1}
              </td>

              {/* Store (brand view only) */}
              {showStore && (
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="font-semibold text-gray-900 dark:text-white">{item.store}</span>
                  {item.storeCluster && (
                    <Badge text={item.storeCluster} className={`ml-1.5 ${CLUSTER_STYLES[item.storeCluster]}`} />
                  )}
                </td>
              )}

              {/* Product: description + SKU secondary */}
              <td className="px-3 py-2.5">
                <p className="font-medium text-gray-900 dark:text-white">
                  {item.description || "Sin descripción"}
                </p>
                <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                  {item.skuComercial || item.sku}
                  {item.skuComercial && (
                    <span className="ml-1 text-gray-300 dark:text-gray-600">({item.sku})</span>
                  )}
                  {groupMode === "store" && (
                    <span className="ml-1.5">
                      <span className="text-gray-300 dark:text-gray-600">·</span>
                      <span className="ml-1 font-medium text-gray-500 dark:text-gray-400">{item.brand}</span>
                    </span>
                  )}
                </p>
              </td>

              {/* Talle */}
              <td className="whitespace-nowrap px-3 py-2.5 text-center font-medium text-gray-700 dark:text-gray-300">
                {item.talle}
              </td>

              {/* Status: stock + MOS + risk — compact diagnosis */}
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {item.currentStock} u.
                  </span>
                  <Badge text={RISK_LABELS[item.risk]} className={RISK_STYLES[item.risk]} />
                </div>
                {item.currentMOS > 0 && (
                  <p className={`mt-0.5 text-[10px] tabular-nums ${
                    item.currentMOS < 1
                      ? "font-semibold text-error-600 dark:text-error-400"
                      : item.currentMOS < 2
                      ? "font-medium text-warning-600 dark:text-warning-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}>
                    {item.currentMOS.toFixed(1)} MOS
                  </p>
                )}
              </td>

              {/* Units to move */}
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                  {item.suggestedUnits}
                </span>
                <span className="ml-0.5 text-[10px] text-gray-400">u.</span>
              </td>

              {/* Instruction */}
              <InstructionCell item={item} intent={intent} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Contextual column headers ───────────────────────────────────────────────

function UnitsHeader({ intent }: { intent: OperationalIntent }) {
  const label =
    intent === "receive_transfer" ? "Recibir" :
    intent === "receive_depot"    ? "Recibir" :
    intent === "resupply_depot"   ? "Resurtir" :
    intent === "redistribute"     ? "Mover" :
    intent === "ship_b2b"         ? "Enviar" :
    "Unidades";

  return <Th className="w-16 text-right">{label}</Th>;
}

function CounterpartHeader({ intent }: { intent: OperationalIntent }) {
  const label =
    intent === "receive_transfer" ? "Desde" :
    intent === "receive_depot"    ? "Desde" :
    intent === "resupply_depot"   ? "Desde" :
    intent === "redistribute"     ? "Hacia" :
    intent === "ship_b2b"         ? "Destino" :
    "Ref.";

  return <Th>{label}</Th>;
}

// ─── Instruction cell ────────────────────────────────────────────────────────
//
// Units column is separate now — this cell only shows from/to where.
//   - Single source  → inline:  "← UNIFORMES"
//   - Multi source   → vertical list with left border
//   - Liquidation    → quiet label
//   - No counterpart → dash

function InstructionCell({ item, intent }: { item: ActionItemFull; intent: OperationalIntent }) {
  const stores = item.counterpartStores;
  const arrow = intent === "redistribute" || intent === "ship_b2b" ? "→" : "←";

  // Liquidation
  if (intent === "redistribute" && stores.length === 0) {
    return (
      <td className="px-3 py-2.5 text-[11px] italic text-gray-400 dark:text-gray-500">
        Liquidar · markdown
      </td>
    );
  }

  // No counterparts
  if (stores.length === 0) {
    return <td className="px-3 py-2.5 text-gray-300 dark:text-gray-600">—</td>;
  }

  // Single source — compact inline
  if (stores.length === 1) {
    return (
      <td className="px-3 py-2.5">
        <span className="text-gray-300 dark:text-gray-600">{arrow}</span>
        <span className="ml-1.5 font-medium text-gray-700 dark:text-gray-300">{stores[0].store}</span>
        {stores[0].units > 0 && (
          <span className="ml-1.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
            {stores[0].units} u.
          </span>
        )}
      </td>
    );
  }

  // Multiple sources — vertical list
  return (
    <td className="px-3 py-2.5">
      <div className="flex flex-col gap-0.5 border-l-2 border-gray-200 pl-2.5 dark:border-gray-600">
        {stores.map(s => (
          <div key={s.store} className="flex items-baseline gap-1.5 text-[11px] leading-tight">
            <span className="font-medium text-gray-700 dark:text-gray-300">{s.store}</span>
            <span className="tabular-nums text-gray-400 dark:text-gray-500">{s.units} u.</span>
          </div>
        ))}
      </div>
    </td>
  );
}

// ─── Table header cell ───────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}
