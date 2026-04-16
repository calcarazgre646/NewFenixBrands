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
import type { ViewProfile } from "@/domain/auth/types";
import { Badge } from "@/components/ui/badge/Badge";
import { WEEKS_PER_MONTH } from "@/domain/config/defaults";

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

const LIFECYCLE_RISK_LABELS: Record<RiskLevel, string> = {
  critical:  "Liquidar",
  low:       "Intervenir",
  overstock: "Sobrestock",
  balanced:  "Revisar",
};

const CLUSTER_STYLES: Record<StoreCluster, string> = {
  A:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  B:   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  OUT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
};

const PRODUCT_TYPE_BADGE: Record<string, { label: string; style: string }> = {
  carry_over: { label: "CO", style: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  temporada:  { label: "TM", style: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400" },
};

// ─── Age bracket formatting (Rule 10) ───────────────────────────────────────

function formatAgeBracket(days: number, profile: ViewProfile): string {
  if (profile === "executive") {
    if (days <= 45) return "(0-45d)";
    if (days <= 90) return "(46-90d)";
    return "(90d+)";
  }
  // detail: 15-day brackets
  if (days <= 15) return "(0-15d)";
  if (days <= 30) return "(16-30d)";
  if (days <= 45) return "(31-45d)";
  if (days <= 60) return "(46-60d)";
  if (days <= 75) return "(61-75d)";
  if (days <= 90) return "(76-90d)";
  return "(90d+)";
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  items: ActionItemFull[];
  intent: OperationalIntent;
  groupMode: GroupByMode;
  /** Default roles for this section (computed from first item). If an item's roles match, they're not repeated. */
  sectionDefaultRoles?: string[];
  /** View profile: detail (15d brackets) or executive (45d brackets) */
  viewProfile?: ViewProfile;
}

export function CompactActionList({ items, intent, groupMode, sectionDefaultRoles, viewProfile = "detail" }: Props) {
  if (items.length === 0) return null;

  const showStore = groupMode === "brand";
  // Compute default roles for dedup (Fix 5): if all items share the same roles, don't repeat in each row
  const defaultRolesKey = sectionDefaultRoles?.join(",") ?? items[0]?.responsibleRoles?.join(",") ?? "";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
            <Th className="w-8 text-center">#</Th>
            {showStore && <Th>Tienda</Th>}
            <Th>Producto</Th>
            {!isLifecycleIntent(intent) && <Th className="w-14 text-center">Talle</Th>}
            <Th className="w-28 text-center">Estado</Th>
            {isSizeCurveIntent(intent)
              ? <>
                  <Th>Curva</Th>
                  <th colSpan={2} className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Acción</th>
                </>
              : <>
                  <Th className="w-20 text-center">{isLifecycleIntent(intent) ? "Edad" : "Cobertura"}</Th>
                  <UnitsHeader intent={intent} />
                  {!isLifecycleIntent(intent) && <Th className="w-14 text-right">Ideal</Th>}
                  {!isLifecycleIntent(intent) && <Th className="w-14 text-right">Gap</Th>}
                  <Th className="w-14 text-center">DOI</Th>
                  <CounterpartHeader intent={intent} />
                </>
            }
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
                  {PRODUCT_TYPE_BADGE[item.productType] && (
                    <Badge
                      text={PRODUCT_TYPE_BADGE[item.productType].label}
                      className={`ml-1.5 ${PRODUCT_TYPE_BADGE[item.productType].style}`}
                    />
                  )}
                </p>
              </td>

              {/* Talle (movement only) */}
              {!isLifecycleIntent(intent) && (
                <td className="whitespace-nowrap px-3 py-2.5 text-center font-medium text-gray-700 dark:text-gray-300">
                  {item.talle}
                </td>
              )}

              {/* Status: stock+risk (non-curve) or visual curve (curve actions) */}
              {isSizeCurveIntent(intent) ? (
                <>
                  {/* Curva visual: tallas presentes (verde) + faltantes (ámbar) */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {item.networkSizes && item.networkSizes.length > 0 ? (
                        item.networkSizes.map(t => {
                          const units = item.sizeUnits?.[t] ?? 0;
                          const present = units > 0;
                          return (
                            <span key={t} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              present
                                ? "bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                                : "bg-warning-50 text-warning-700 ring-1 ring-warning-300 dark:bg-warning-900/30 dark:text-warning-400 dark:ring-warning-700"
                            }`}>
                              {t}<span className="text-[9px] opacity-70">{units}</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[11px] text-gray-300">—</span>
                      )}
                      <span className="ml-1 text-[10px] tabular-nums text-gray-400">
                        {item.sizeCurveCoverage != null ? `${item.sizeCurveCoverage.toFixed(0)}%` : ""}
                      </span>
                    </div>
                  </td>

                  {/* Accion con detalle de tallas y unidades */}
                  <td className="px-3 py-2.5" colSpan={2}>
                    <p className="text-[11px] leading-snug text-gray-700 dark:text-gray-300">
                      {item.recommendedAction}
                    </p>
                  </td>
                </>
              ) : (
              <>
              {/* Status: stock + risk (non-curve) */}
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {item.currentStock} u.
                  </span>
                  <Badge
                    text={item.category === "lifecycle" ? LIFECYCLE_RISK_LABELS[item.risk] : RISK_LABELS[item.risk]}
                    className={RISK_STYLES[item.risk]}
                  />
                </div>
              </td>
              {/* Cobertura (movement) or Edad (lifecycle) */}
              <td className="px-3 py-2.5 text-center">
                {item.category === "lifecycle" ? (
                  // Lifecycle: show cohort age with bracket label based on view profile
                  item.cohortAgeDays != null && item.cohortAgeDays > 0 ? (
                    <span className={`text-[11px] font-medium tabular-nums ${
                      item.cohortAgeDays > 90 ? "text-error-600 dark:text-error-400" :
                      item.cohortAgeDays > 45 ? "text-warning-600 dark:text-warning-400" :
                      "text-gray-500 dark:text-gray-400"
                    }`}>
                      {item.cohortAgeDays}d
                      <span className="ml-0.5 text-[9px] font-normal text-gray-400 dark:text-gray-500">
                        {formatAgeBracket(item.cohortAgeDays, viewProfile)}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>
                  )
                ) : (
                  // Movement: show WOI (Weeks of Inventory)
                  (() => {
                    if (item.currentMOS <= 0 && item.historicalAvg <= 0) return <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>;
                    const value = item.currentMOS * WEEKS_PER_MONTH;
                    const low = item.coverWeeks;
                    const mid = item.coverWeeks * 2;
                    return (
                      <p className={`text-[11px] font-medium tabular-nums ${
                        value < low
                          ? "text-error-600 dark:text-error-400"
                          : value < mid
                          ? "text-warning-600 dark:text-warning-400"
                          : "text-gray-500 dark:text-gray-400"
                      }`}>
                        {value.toFixed(1)}
                        <span className="ml-0.5 text-[9px] font-normal text-gray-400 dark:text-gray-500">WOI</span>
                      </p>
                    );
                  })()
                )}
              </td>

              {/* Units to move / STH for lifecycle */}
              <td className="whitespace-nowrap px-3 py-2.5 text-right">
                {item.category === "lifecycle" ? (
                  <span className={`text-sm font-bold tabular-nums ${
                    (item.sth ?? 0) < 30 ? "text-error-600 dark:text-error-400" :
                    (item.sth ?? 0) < 60 ? "text-warning-600 dark:text-warning-400" :
                    "text-gray-900 dark:text-white"
                  }`}>
                    {item.sth != null ? `${item.sth.toFixed(0)}%` : "—"}
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                      {item.suggestedUnits}
                    </span>
                    <span className="ml-0.5 text-[10px] text-gray-400">u.</span>
                  </>
                )}
              </td>

              {/* Ideal units (movement only) */}
              {!isLifecycleIntent(intent) && (
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {item.idealUnits > 0 ? item.idealUnits : "—"}
                  </span>
                </td>
              )}

              {/* Gap (movement only) */}
              {!isLifecycleIntent(intent) && (
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  {item.gapUnits > 0 ? (
                    <span className="text-[11px] font-semibold tabular-nums text-error-600 dark:text-error-400">
                      {item.gapUnits}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-300 dark:text-gray-600">0</span>
                  )}
                </td>
              )}

              {/* DOI — Edad del inventario (días desde último movimiento) */}
              <td className="whitespace-nowrap px-3 py-2.5 text-center">
                {item.daysOfInventory > 0 ? (
                  <span className={`text-[11px] font-medium tabular-nums ${
                    item.daysOfInventory > 180 ? "text-error-600 dark:text-error-400" :
                    item.daysOfInventory > 90 ? "text-warning-600 dark:text-warning-400" :
                    "text-gray-500 dark:text-gray-400"
                  }`}>
                    {item.daysOfInventory.toFixed(0)}d
                  </span>
                ) : (
                  <span className="text-[11px] text-gray-300 dark:text-gray-600">—</span>
                )}
              </td>

              {/* Instruction */}
              <InstructionCell item={item} intent={intent} defaultRolesKey={defaultRolesKey} />
              </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Contextual column headers ───────────────────────────────────────────────

const isLifecycleIntent = (intent: OperationalIntent): boolean =>
  intent === "lifecycle_review" || intent === "lifecycle_commercial" || intent === "lifecycle_exit" || intent === "lifecycle_reposition";

const isSizeCurveIntent = (intent: OperationalIntent): boolean =>
  intent === "lifecycle_reposition";

function UnitsHeader({ intent }: { intent: OperationalIntent }) {
  if (isLifecycleIntent(intent)) return <Th className="w-16 text-right">STH</Th>;
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
  if (isLifecycleIntent(intent)) return <Th>Acción</Th>;
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

const ROLE_LABELS: Record<string, string> = {
  marketing_b2c: "Marketing B2C",
  brand_manager: "Brand Manager",
  gerencia_retail: "Gerencia Retail",
  operaciones_retail: "Operaciones",
  logistica: "Logística",
};

function InstructionCell({ item, intent, defaultRolesKey }: { item: ActionItemFull; intent: OperationalIntent; defaultRolesKey: string }) {
  // Lifecycle actions: show reason + sourcable sizes + roles (if different from section default)
  if (item.category === "lifecycle") {
    const itemRolesKey = item.responsibleRoles.join(",");
    const showRoles = itemRolesKey !== defaultRolesKey; // Only show if different from section default
    return (
      <td className="px-3 py-2.5">
        {/* Recommended action — the WHY and WHAT */}
        <p className="text-[11px] text-gray-700 dark:text-gray-300">
          {item.recommendedAction}
        </p>
        {/* Roles — only if different from section default */}
        {showRoles && item.responsibleRoles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.responsibleRoles.map(role => (
              <span key={role} className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
                {ROLE_LABELS[role] ?? role}
              </span>
            ))}
          </div>
        )}
      </td>
    );
  }

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
