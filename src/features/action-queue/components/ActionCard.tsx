/**
 * features/action-queue/components/ActionCard.tsx
 *
 * Tarjeta de acción operativa — ticket auto-contenido.
 *
 * 5 variantes por tipo de acción, layout compartido:
 *   Header: verbo + cantidad + urgencia
 *   Body:   producto + contenido específico por tipo
 *   Footer: métricas contextuales
 *
 * Mobile-first: una columna en <640px, sin scroll horizontal.
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { OperationalIntent } from "@/domain/actionQueue/grouping";
import { classifyIntent } from "@/domain/actionQueue/grouping";
import type { RiskLevel, StoreCluster } from "@/domain/actionQueue/types";
import type { ViewProfile } from "@/domain/auth/types";
import { Badge } from "@/components/ui/badge/Badge";
import { formatPYGSuffix } from "@/utils/format";

// ─── Styles ──────────────────────────────────────────────────────────────────

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  low:      "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  overstock:"bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  balanced: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Sin Stock",
  low:      "Stock Bajo",
  overstock:"Sobrestock",
  balanced: "OK",
};

const LIFECYCLE_RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Urgente",
  low:      "Atención",
  overstock:"Exceso",
  balanced: "Revisar",
};

const CLUSTER_STYLES: Record<StoreCluster, string> = {
  A:   "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  B:   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  OUT: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
};

const INTENT_ACCENT: Record<OperationalIntent, { border: string; headerBg: string; icon: string }> = {
  receive_transfer:    { border: "border-l-purple-400 dark:border-l-purple-500",  headerBg: "bg-purple-50/60 dark:bg-purple-500/5",  icon: "text-purple-600 dark:text-purple-400" },
  receive_depot:       { border: "border-l-cyan-400 dark:border-l-cyan-500",      headerBg: "bg-cyan-50/60 dark:bg-cyan-500/5",      icon: "text-cyan-600 dark:text-cyan-400" },
  resupply_depot:      { border: "border-l-orange-400 dark:border-l-orange-500",  headerBg: "bg-orange-50/60 dark:bg-orange-500/5",  icon: "text-orange-600 dark:text-orange-400" },
  redistribute:        { border: "border-l-blue-400 dark:border-l-blue-500",      headerBg: "bg-blue-50/60 dark:bg-blue-500/5",      icon: "text-blue-600 dark:text-blue-400" },
  ship_b2b:            { border: "border-l-emerald-400 dark:border-l-emerald-500",headerBg: "bg-emerald-50/60 dark:bg-emerald-500/5",icon: "text-emerald-600 dark:text-emerald-400" },
  lifecycle_review:    { border: "border-l-amber-400 dark:border-l-amber-500",    headerBg: "bg-amber-50/60 dark:bg-amber-500/5",    icon: "text-amber-600 dark:text-amber-400" },
  lifecycle_commercial:{ border: "border-l-rose-400 dark:border-l-rose-500",      headerBg: "bg-rose-50/60 dark:bg-rose-500/5",      icon: "text-rose-600 dark:text-rose-400" },
  lifecycle_exit:      { border: "border-l-red-400 dark:border-l-red-500",        headerBg: "bg-red-50/60 dark:bg-red-500/5",        icon: "text-red-600 dark:text-red-400" },
  lifecycle_reposition:{ border: "border-l-indigo-400 dark:border-l-indigo-500",  headerBg: "bg-indigo-50/60 dark:bg-indigo-500/5",  icon: "text-indigo-600 dark:text-indigo-400" },
};

const PRODUCT_TYPE_BADGE: Record<string, { label: string; style: string }> = {
  carry_over: { label: "Carry Over", style: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400" },
  temporada:  { label: "Temporada", style: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400" },
};


// ─── Header verb ─────────────────────────────────────────────────────────────

function getHeaderVerb(item: ActionItemFull, intent: OperationalIntent): string {
  if (intent === "lifecycle_reposition") return "Completar curva";
  if (intent === "lifecycle_exit") return "Salida obligatoria";
  if (intent === "lifecycle_commercial") return "Acción Comercial";
  if (intent === "lifecycle_review") return "Revisar exhibición";

  const units = item.suggestedUnits;
  if (intent === "receive_transfer" || intent === "receive_depot") return `Recibir ${units}u`;
  if (intent === "resupply_depot") return `Resurtir ${units}u`;
  if (intent === "redistribute") return `Mover ${units}u`;
  if (intent === "ship_b2b") return `Enviar ${units}u`;
  return `${units}u`;
}

// ─── Age bracket (Rule 10) ──────────────────────────────────────────────────

function formatAgeBracket(days: number, profile: ViewProfile): string {
  if (profile === "executive") {
    if (days <= 45) return "0-45d";
    if (days <= 90) return "46-90d";
    return "90d+";
  }
  if (days <= 15) return "0-15d";
  if (days <= 30) return "16-30d";
  if (days <= 45) return "31-45d";
  if (days <= 60) return "46-60d";
  if (days <= 75) return "61-75d";
  if (days <= 90) return "76-90d";
  return "90d+";
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  item: ActionItemFull;
  showStore?: boolean;
  viewProfile?: ViewProfile;
}

export function ActionCard({ item, showStore = false, viewProfile = "detail" }: Props) {
  const intent = classifyIntent(item);
  const accent = INTENT_ACCENT[intent];
  const isLifecycle = item.category === "lifecycle";
  const isSizeCurve = intent === "lifecycle_reposition";
  const isReposition = intent === "receive_transfer" || intent === "receive_depot" || intent === "resupply_depot";
  const isRedistribute = intent === "redistribute" || intent === "ship_b2b";
  const isMovement = isReposition || isRedistribute;
  const isLifecycleReview = intent === "lifecycle_review";
  const isLifecycleCommercial = intent === "lifecycle_commercial";
  const isLifecycleExit = intent === "lifecycle_exit";

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-800">
      {/* ── Header ── */}
      <div className={`flex items-center justify-between gap-2 rounded-t-xl px-3.5 py-2.5 ${accent.headerBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <IntentIcon intent={intent} className={`h-4 w-4 shrink-0 ${accent.icon}`} />
          <span className={`text-xs font-bold ${accent.icon}`}>
            {getHeaderVerb(item, intent)}
          </span>
        </div>
        {!isSizeCurve && <RiskBadge item={item} isLifecycle={isLifecycle} viewProfile={viewProfile} />}
      </div>

      {/* ── Body ── */}
      <div className="flex-1 space-y-3 px-3.5 py-3">
        {/* Product identity */}
        <div>
          <div className="flex items-start gap-1.5">
            <p className="text-[13px] font-semibold leading-snug text-gray-900 dark:text-white">
              {item.description || "Sin descripción"}
              {!isSizeCurve && item.talle && (
                <span className="ml-1 font-medium text-gray-500 dark:text-gray-400">· {item.talle}</span>
              )}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              {item.skuComercial || item.sku}
            </span>
            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">{item.brand}</span>
            {PRODUCT_TYPE_BADGE[item.productType] && (
              <Badge
                text={PRODUCT_TYPE_BADGE[item.productType].label}
                className={PRODUCT_TYPE_BADGE[item.productType].style}
              />
            )}
            {showStore && (
              <>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{item.store}</span>
                {item.storeCluster && <Badge text={item.storeCluster} className={CLUSTER_STYLES[item.storeCluster]} />}
              </>
            )}
          </div>
        </div>

        {/* Type-specific content */}
        {isSizeCurve ? (
          <SizeCurveBody item={item} />
        ) : isReposition ? (
          <ReposicionBody item={item} />
        ) : isLifecycleReview ? (
          <LifecycleReviewBody item={item} />
        ) : isLifecycleCommercial ? (
          <LifecycleCommercialBody item={item} />
        ) : isLifecycleExit ? (
          <LifecycleExitBody item={item} />
        ) : isLifecycle ? (
          <LifecycleBody item={item} intent={intent} viewProfile={viewProfile} />
        ) : (
          <RedistribucionBody item={item} intent={intent} />
        )}
      </div>

      {/* ── Footer: only movement cards show impact. All others: no footer ── */}
      {isMovement && item.impactScore > 0 && (
        <div className="border-t border-gray-100 px-3.5 py-2 dark:border-gray-700/50">
          <span className="text-[10px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
            {formatPYGSuffix(item.impactScore)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Risk badge (top-right of header) ───────────────────────────────────────

function RiskBadge({ item, isLifecycle, viewProfile }: { item: ActionItemFull; isLifecycle: boolean; viewProfile: ViewProfile }) {
  if (isLifecycle && item.cohortAgeDays != null && item.cohortAgeDays > 0) {
    const ageColor =
      item.cohortAgeDays > 90 ? "bg-error-100 text-error-700 dark:bg-error-500/15 dark:text-error-400" :
      item.cohortAgeDays > 45 ? "bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400" :
      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${ageColor}`}>
        {item.cohortAgeDays}d
        <span className="font-normal opacity-70">{formatAgeBracket(item.cohortAgeDays, viewProfile)}</span>
      </span>
    );
  }

  const labels = isLifecycle ? LIFECYCLE_RISK_LABELS : RISK_LABELS;
  return <Badge text={labels[item.risk]} className={RISK_STYLES[item.risk]} />;
}

// ─── Reposición body (receive_transfer, receive_depot, resupply_depot) ───────

function ReposicionBody({ item }: { item: ActionItemFull }) {
  const stores = item.counterpartStores;
  const arrow = "←";

  return (
    <div className="space-y-3">
      {/* ── Instruction: from where, how many ── */}
      {stores.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30">
          {stores.map((s, i) => (
            <div
              key={s.store}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i > 0 ? "border-t border-gray-200/60 dark:border-gray-600/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">{arrow}</span>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{s.store}</span>
              </div>
              {s.units > 0 && (
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">
                  {s.units}u
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── State: what you have → what you need ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center dark:bg-gray-700/30">
          <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Stock actual</p>
          <p className={`text-base font-bold tabular-nums ${
            item.currentStock === 0 ? "text-error-600 dark:text-error-400" : "text-gray-900 dark:text-white"
          }`}>
            {item.currentStock} <span className="text-[10px] font-medium text-gray-400">u</span>
          </p>
        </div>
        <svg className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
        <div className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-center dark:bg-gray-700/30">
          <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Necesita</p>
          <p className="text-base font-bold tabular-nums text-gray-900 dark:text-white">
            {item.idealUnits > 0 ? item.idealUnits : item.suggestedUnits} <span className="text-[10px] font-medium text-gray-400">u</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Redistribución body (redistribute, ship_b2b) ──────────────────────────

function RedistribucionBody({ item, intent }: { item: ActionItemFull; intent: OperationalIntent }) {
  const stores = item.counterpartStores;
  const isLiquidation = intent === "redistribute" && stores.length === 0;

  return (
    <div className="space-y-3">
      {/* ── Context: how much stock this store has ── */}
      <div className="flex items-center justify-between rounded-lg bg-blue-50/60 px-3 py-2 dark:bg-blue-500/5">
        <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Stock en tienda</span>
        <span className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
          {item.currentStock}<span className="ml-0.5 text-[10px] font-medium text-blue-500 dark:text-blue-400">u</span>
        </span>
      </div>

      {/* ── Instruction: where to send / liquidation ── */}
      {isLiquidation ? (
        <div className="rounded-lg bg-warning-50 px-3 py-2.5 dark:bg-warning-500/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-warning-700 dark:text-warning-400">
              Markdown · liquidación
            </span>
            <span className="text-[13px] font-bold tabular-nums text-warning-700 dark:text-warning-400">
              {item.suggestedUnits}u
            </span>
          </div>
        </div>
      ) : stores.length > 0 ? (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30">
          {stores.map((s, i) => (
            <div
              key={s.store}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i > 0 ? "border-t border-gray-200/60 dark:border-gray-600/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{s.store}</span>
              </div>
              {s.units > 0 && (
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">
                  {s.units}u
                </span>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ─── Size curve body ─────────────────────────────────────────────────────────

/** Parse sourcing instructions from recommendedAction string.
 *  Format: "Completar curva (5u): M (3u) ← ESTRELLA | L (2u) ← MARTELSSL"
 *  Returns structured rows or null if unparseable. */
function parseSourcingInstructions(text: string): { size: string; units: string; source: string }[] | null {
  // Match patterns like "M (3u) ← ESTRELLA"
  const regex = /([A-Z0-9/]+)\s*\((\d+u)\)\s*←\s*([A-Z0-9]+)/g;
  const results: { size: string; units: string; source: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ size: match[1], units: match[2], source: match[3] });
  }
  return results.length > 0 ? results : null;
}

function SizeCurveBody({ item }: { item: ActionItemFull }) {
  const sizes = item.networkSizes ?? [];
  const units = item.sizeUnits ?? {};
  const maxUnits = Math.max(1, ...sizes.map(t => units[t] ?? 0));
  const presentCount = sizes.filter(t => (units[t] ?? 0) > 0).length;
  const coverage = item.sizeCurveCoverage ?? (sizes.length > 0 ? (presentCount / sizes.length) * 100 : 0);
  const sourcingRows = item.recommendedAction ? parseSourcingInstructions(item.recommendedAction) : null;

  return (
    <div className="space-y-3">
      {/* ── Diagnosis: proportional bar chart ── */}
      {sizes.length > 0 && (
        <div>
          {/* Bar chart with row labels */}
          <div className="flex gap-1">
            {/* Row labels */}
            <div className="flex w-7 shrink-0 flex-col justify-end gap-0.5 pb-0.5">
              <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 text-right">Uds.</span>
              <span className="text-[8px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 text-right">Talla</span>
            </div>
            {/* Bars + labels */}
            <div className="flex flex-1 items-end gap-1" style={{ height: 56 }}>
              {sizes.map(t => {
                const u = units[t] ?? 0;
                const present = u > 0;
                const heightPct = u > 0 ? Math.max(12, (u / maxUnits) * 100) : 0;

                return (
                  <div key={t} className="flex flex-1 flex-col items-center gap-0.5" style={{ height: "100%" }}>
                    {/* Bar */}
                    <div className="flex w-full flex-1 items-end justify-center">
                      {present ? (
                        <div
                          className="w-full max-w-[28px] rounded-t bg-success-400 dark:bg-success-500"
                          style={{ height: `${heightPct}%` }}
                        />
                      ) : (
                        <div
                          className="w-full max-w-[28px] rounded-t border border-dashed border-warning-400 dark:border-warning-500"
                          style={{ height: "40%" }}
                        />
                      )}
                    </div>
                    {/* Units */}
                    <span className={`text-[9px] font-semibold tabular-nums ${
                      present ? "text-gray-600 dark:text-gray-400" : "text-warning-500 dark:text-warning-400"
                    }`}>
                      {present ? u : "—"}
                    </span>
                    {/* Size label */}
                    <span className={`text-[9px] font-medium ${
                      present ? "text-gray-500 dark:text-gray-400" : "text-warning-600 dark:text-warning-400"
                    }`}>
                      {t}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coverage bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  coverage >= 100 ? "bg-success-500" : coverage >= 60 ? "bg-warning-500" : "bg-error-500"
                }`}
                style={{ width: `${Math.min(coverage, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-gray-600 dark:text-gray-400">
              {presentCount}/{sizes.length}
            </span>
          </div>
        </div>
      )}

      {/* ── Action: structured sourcing instructions ── */}
      {sourcingRows && sourcingRows.length > 0 ? (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/30">
          <div className="space-y-1.5">
            {sourcingRows.map((row, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-8 font-bold text-warning-700 dark:text-warning-400">{row.size}</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-400">{row.units}</span>
                <span className="text-gray-300 dark:text-gray-600">←</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">{row.source}</span>
              </div>
            ))}
          </div>
        </div>
      ) : item.recommendedAction ? (
        /* Fallback: show raw text if parsing failed */
        <div className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/30">
          <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
            {item.recommendedAction}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Lifecycle review body (revisar exhibición / asignación) ─────────────────

function LifecycleReviewBody({ item }: { item: ActionItemFull }) {
  const sth = item.sth ?? 0;
  const hasSth = item.sth != null;
  const evaluation = item.lifecycleEvaluation;
  const threshold = evaluation?.requiredSth ?? 0;
  const ageDays = item.cohortAgeDays ?? 0;
  const skuAvg = item.skuAvgSthInStore;
  const productTypeLabel =
    item.productType === "carry_over" ? "Carry Over" :
    item.productType === "temporada" ? "Temporada" :
    item.productType === "basicos" ? "Básicos" : item.productType;

  return (
    <div className="space-y-3">
      {/* ── STH bar with threshold marker ── */}
      {hasSth && (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Sell-Through talla {item.talle}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${
                sth < threshold ? "text-error-600 dark:text-error-400" : "text-success-600 dark:text-success-400"
              }`}>
                {sth.toFixed(0)}%
              </span>
              {threshold > 0 && (
                <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                  / {threshold}%
                </span>
              )}
            </div>
          </div>
          {/* Bar: threshold zone (ghost) + actual STH (solid) */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            {/* Threshold zone — subtle fill showing "you should reach here" */}
            {threshold > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gray-300/50 dark:bg-gray-500/30"
                style={{ width: `${Math.min(threshold, 100)}%` }}
              />
            )}
            {/* Actual STH — solid color on top (min 6% width so 0% is still visible as a sliver) */}
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                sth < threshold ? "bg-error-500" : "bg-success-500"
              }`}
              style={{ width: `${Math.max(sth > 0 ? 6 : 3, Math.min(sth, 100))}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-gray-400 dark:text-gray-500">
            {threshold > 0 ? (
              <span>Umbral {threshold}% para {productTypeLabel} en tramo {evaluation?.bracket ?? "—"}d</span>
            ) : <span />}
            {skuAvg != null && (
              <span className="shrink-0 tabular-nums">SKU prom. {skuAvg.toFixed(0)}%</span>
            )}
          </div>
        </div>
      )}

      {/* ── Context row ── */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Stock</p>
          <p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{item.currentStock} <span className="text-[9px] font-medium text-gray-400">u</span></p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Edad</p>
          <p className={`text-[13px] font-bold tabular-nums ${
            ageDays > 45 ? "text-warning-600 dark:text-warning-400" : "text-gray-900 dark:text-white"
          }`}>{ageDays} <span className="text-[9px] font-medium text-gray-400">d</span></p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Tipo</p>
          <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{productTypeLabel}</p>
        </div>
      </div>

    </div>
  );
}

// ─── Lifecycle commercial body (acción comercial / markdown selectivo) ───────

function LifecycleCommercialBody({ item }: { item: ActionItemFull }) {
  const sth = item.sth ?? 0;
  const hasSth = item.sth != null;
  const evaluation = item.lifecycleEvaluation;
  const threshold = evaluation?.requiredSth ?? 0;
  const ageDays = item.cohortAgeDays ?? 0;
  const daysUntilExit = Math.max(0, 90 - ageDays);
  const skuAvg = item.skuAvgSthInStore;
  const productTypeLabel =
    item.productType === "carry_over" ? "Carry Over" :
    item.productType === "temporada" ? "Temporada" :
    item.productType === "basicos" ? "Básicos" : item.productType;

  return (
    <div className="space-y-3">
      {/* ── STH bar with threshold zone ── */}
      {hasSth && (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Sell-Through talla {item.talle}
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-sm font-bold tabular-nums ${
                sth < threshold ? "text-error-600 dark:text-error-400" : "text-success-600 dark:text-success-400"
              }`}>
                {sth.toFixed(0)}%
              </span>
              {threshold > 0 && (
                <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                  / {threshold}%
                </span>
              )}
            </div>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            {threshold > 0 && (
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-gray-300/50 dark:bg-gray-500/30"
                style={{ width: `${Math.min(threshold, 100)}%` }}
              />
            )}
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-300 ${
                sth < threshold ? "bg-error-500" : "bg-success-500"
              }`}
              style={{ width: `${Math.max(sth > 0 ? 6 : 3, Math.min(sth, 100))}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-gray-400 dark:text-gray-500">
            {threshold > 0 ? (
              <span>Umbral {threshold}% para {productTypeLabel}</span>
            ) : <span />}
            {skuAvg != null && (
              <span className="shrink-0 tabular-nums">SKU prom. {skuAvg.toFixed(0)}%</span>
            )}
          </div>
        </div>
      )}

      {/* ── Context: Stock + Edad + Countdown ── */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Stock</p>
          <p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{item.currentStock} <span className="text-[9px] font-medium text-gray-400">u</span></p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Edad</p>
          <p className="text-[13px] font-bold tabular-nums text-warning-600 dark:text-warning-400">{ageDays} <span className="text-[9px] font-medium text-gray-400">d</span></p>
        </div>
        <div className={`flex-1 rounded-lg px-2.5 py-1.5 text-center ${
          daysUntilExit <= 15
            ? "bg-error-50 dark:bg-error-500/10"
            : daysUntilExit <= 30
            ? "bg-warning-50 dark:bg-warning-500/10"
            : "bg-gray-50 dark:bg-gray-700/30"
        }`}>
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Quedan</p>
          <p className={`text-[13px] font-bold tabular-nums ${
            daysUntilExit <= 15
              ? "text-error-600 dark:text-error-400"
              : daysUntilExit <= 30
              ? "text-warning-600 dark:text-warning-400"
              : "text-gray-900 dark:text-white"
          }`}>{daysUntilExit} <span className="text-[9px] font-medium text-gray-400">d</span></p>
        </div>
      </div>

      {/* ── Recommended action ── */}
      {item.recommendedAction && (
        <div className="rounded-lg bg-rose-50/60 px-3 py-2 dark:bg-rose-500/5">
          <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
            {item.recommendedAction}
          </p>
        </div>
      )}

      {/* ── Counterpart stores (if transfer suggested) ── */}
      {item.counterpartStores.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30">
          {item.counterpartStores.map((s, i) => (
            <div
              key={s.store}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i > 0 ? "border-t border-gray-200/60 dark:border-gray-600/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{s.store}</span>
              </div>
              {s.units > 0 && (
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{s.units}u</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lifecycle exit body (salida obligatoria 90d+) ──────────────────────────

function LifecycleExitBody({ item }: { item: ActionItemFull }) {
  const sth = item.sth ?? 0;
  const ageDays = item.cohortAgeDays ?? 0;
  const daysOverdue = Math.max(0, ageDays - 90);
  const stores = item.counterpartStores;
  const isMarkdown = stores.length === 0;
  const skuAvg = item.skuAvgSthInStore;

  return (
    <div className="space-y-3">
      {/* ── Overdue alert banner ── */}
      <div className="flex items-center gap-2 rounded-lg bg-error-50 px-3 py-2 dark:bg-error-500/10">
        <svg className="h-4 w-4 shrink-0 text-error-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span className="text-[11px] font-semibold text-error-700 dark:text-error-400">
          {daysOverdue > 0 ? `${daysOverdue} días pasados del límite` : "En el límite de 90 días"}
        </span>
      </div>

      {/* ── Context: Stock + STH + Edad ── */}
      <div className="flex gap-2">
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Stock talla</p>
          <p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{item.currentStock} <span className="text-[9px] font-medium text-gray-400">u</span></p>
        </div>
        <div className="flex-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-center dark:bg-gray-700/30">
          <p className="text-[8px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">STH talla</p>
          <p className="text-[13px] font-bold tabular-nums text-error-600 dark:text-error-400">{sth.toFixed(0)} <span className="text-[9px] font-medium">%</span></p>
          {skuAvg != null && (
            <p className="text-[8px] tabular-nums text-gray-400 dark:text-gray-500">SKU prom. {skuAvg.toFixed(0)}%</p>
          )}
        </div>
        <div className="flex-1 rounded-lg bg-error-50 px-2.5 py-1.5 text-center dark:bg-error-500/10">
          <p className="text-[8px] font-medium uppercase tracking-wider text-error-400 dark:text-error-500">Edad</p>
          <p className="text-[13px] font-bold tabular-nums text-error-600 dark:text-error-400">{ageDays} <span className="text-[9px] font-medium">d</span></p>
        </div>
      </div>

      {/* ── Instruction: destination or markdown ── */}
      {isMarkdown ? (
        <div className="rounded-lg bg-error-50 px-3 py-2.5 dark:bg-error-500/10">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-error-700 dark:text-error-400">
              Markdown · liquidación
            </span>
            <span className="text-[13px] font-bold tabular-nums text-error-700 dark:text-error-400">
              {item.currentStock}u
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30">
          {stores.map((s, i) => (
            <div
              key={s.store}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i > 0 ? "border-t border-gray-200/60 dark:border-gray-600/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{s.store}</span>
              </div>
              {s.units > 0 && (
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{s.units}u</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Lifecycle body (generic fallback) ───────────────────────────────────────

function LifecycleBody({ item, intent, viewProfile }: { item: ActionItemFull; intent: OperationalIntent; viewProfile: ViewProfile }) {
  const sth = item.sth ?? 0;
  const hasSth = item.sth != null;

  return (
    <div className="space-y-2">
      {/* STH bar */}
      {hasSth && (
        <div className="rounded-lg bg-gray-50 px-3 py-2.5 dark:bg-gray-700/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Sell-Through
            </span>
            <span className={`text-sm font-bold tabular-nums ${
              sth < 30 ? "text-error-600 dark:text-error-400" :
              sth < 60 ? "text-warning-600 dark:text-warning-400" :
              "text-success-600 dark:text-success-400"
            }`}>
              {sth.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                sth < 30 ? "bg-error-500" :
                sth < 60 ? "bg-warning-500" :
                "bg-success-500"
              }`}
              style={{ width: `${Math.min(sth, 100)}%` }}
            />
          </div>
          {item.cohortAgeDays != null && item.cohortAgeDays > 0 && (
            <p className="mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
              Edad: {item.cohortAgeDays}d ({formatAgeBracket(item.cohortAgeDays, viewProfile)})
            </p>
          )}
        </div>
      )}

      {/* Recommended action */}
      {item.recommendedAction && (
        <div className={`rounded-lg px-3 py-2 ${
          intent === "lifecycle_exit"
            ? "bg-error-50/50 dark:bg-error-500/5"
            : "bg-gray-50 dark:bg-gray-700/30"
        }`}>
          <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">
            {item.recommendedAction}
          </p>
        </div>
      )}

      {/* Counterpart stores for lifecycle transfers */}
      {item.counterpartStores.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/30">
          {item.counterpartStores.map((s, i) => (
            <div
              key={s.store}
              className={`flex items-center justify-between px-3 py-2.5 ${
                i > 0 ? "border-t border-gray-200/60 dark:border-gray-600/30" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 dark:text-gray-500">→</span>
                <span className="text-[12px] font-semibold text-gray-800 dark:text-gray-200">{s.store}</span>
              </div>
              {s.units > 0 && (
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-white">{s.units}u</span>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}


// ─── Intent icons (same as ActionGroupCard) ─────────────────────────────────

function IntentIcon({ intent, className }: { intent: OperationalIntent; className?: string }) {
  const cls = className ?? "h-4 w-4";
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
    case "lifecycle_reposition":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>;
    case "lifecycle_review":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
    case "lifecycle_commercial":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>;
    case "lifecycle_exit":
      return <svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>;
  }
}
