/**
 * features/sales/components/SkusCard.tsx
 *
 * Top/Bottom SKUs ranked list with brand badges, weight %, and metrics.
 * Filtro local: "Top Sellers" (mayor venta) vs "Bottom Sellers" (menor venta).
 */
import { useState, useMemo, useEffect } from "react";
import type { TopSkuRow } from "@/queries/sales.queries";
import { formatPYGShort, formatPct } from "@/utils/format";
import { Card } from "@/components/ui/card/Card";
import { brandColor } from "./salesAnalytics.constants";
import { LazyLoadPrompt, SectionLabel } from "./salesAnalytics.shared";

type SkuMode = "top" | "bottom";
const SKU_DISPLAY_LIMIT = 20;

export function SkusCard({
  data,
  isLoading,
  onRequestLoad,
  filteredStoreName,
}: {
  data: TopSkuRow[];
  isLoading: boolean;
  onRequestLoad: () => void;
  filteredStoreName?: string | null;
}) {
  const [mode, setMode] = useState<SkuMode>("top");

  const displayed = useMemo(() => {
    if (data.length === 0) return [];
    if (mode === "top") return data.slice(0, SKU_DISPLAY_LIMIT);
    // Bottom: take last N, reverse so worst is #1
    return data.slice(-SKU_DISPLAY_LIMIT).reverse();
  }, [data, mode]);

  // Lazy load prompt
  if (data.length === 0 && !isLoading) {
    return (
      <Card padding="lg" className="flex h-full flex-col">
        <SectionLabel>Top SKUs</SectionLabel>
        <div className="mt-auto">
          <LazyLoadPrompt
            label="Cargar ranking de SKUs"
            onClick={onRequestLoad}
            icon={
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
            }
          />
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="flex h-full flex-col">
      {/* Header: label + store badge left, toggle right */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {mode === "top" ? "Top Sellers" : "Bottom Sellers"}
          </p>
          {filteredStoreName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
              <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.22-.53l4.72-4.72M2.46 15l4.72-4.72a.75.75 0 00.22-.53V2.25" />
              </svg>
              {filteredStoreName}
            </span>
          )}
        </div>
        {!isLoading && data.length > 0 && (
          <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => setMode("top")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                mode === "top"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Top
            </button>
            <button
              type="button"
              onClick={() => setMode("bottom")}
              className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                mode === "bottom"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              Bottom
            </button>
          </div>
        )}
      </div>
      {isLoading ? (
        <SkuLoadingFeed />
      ) : (
        <div className="-mb-2 flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {displayed.map((sku, i) => {
            const colors = brandColor(sku.brand);
            const name = sku.description !== sku.sku ? sku.description : (sku.skuComercial || sku.sku);
            const code = sku.skuComercial || sku.sku;

            return (
              <div
                key={sku.sku}
                className="flex items-start gap-3 rounded-xl border border-gray-100 px-3.5 py-3 transition-colors hover:border-gray-200 hover:bg-gray-50/50 dark:border-gray-700/50 dark:hover:border-gray-600 dark:hover:bg-white/[0.02]"
              >
                {/* Rank */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tabular-nums ${
                  mode === "bottom"
                    ? "bg-error-50 text-error-400 dark:bg-error-500/10 dark:text-error-500"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                }`}>
                  {i + 1}
                </div>

                {/* Product info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-white" title={name}>
                    {name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${colors.bg} ${colors.text}`}>
                      {sku.brand}
                    </span>
                    <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                      {code}{sku.skuComercial ? ` · ${sku.sku}` : ""}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="shrink-0 text-right">
                  <p className="text-xs sm:text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatPYGShort(sku.neto)}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
                    {Math.round(sku.units).toLocaleString("es-PY")} uds
                  </p>
                  {sku.weightPct > 0 && (
                    <p className="mt-0.5 text-[10px] font-semibold tabular-nums text-brand-500 dark:text-brand-400">
                      {formatPct(sku.weightPct)} del total
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Transparent loading feed ────────────────────────────────────────────────

const SKU_LOADING_MESSAGES = [
  "Consultando ranking de productos\u2026",
  "Agregando ventas por SKU\u2026",
  "Calculando unidades y neto por producto\u2026",
  "Ordenando por facturaci\u00F3n descendente\u2026",
  "Resolviendo descripciones comerciales\u2026",
  "Preparando ranking de SKUs\u2026",
];

function SkuLoadingFeed() {
  const [messages, setMessages] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setElapsed(Date.now() - startTime), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    function scheduleNext() {
      if (idx >= SKU_LOADING_MESSAGES.length) return;
      timer = setTimeout(() => {
        const text = SKU_LOADING_MESSAGES[idx];
        setMessages((prev) => [...prev].concat(text).slice(-3));
        idx++;
        scheduleNext();
      }, 900 + Math.random() * 500);
    }
    scheduleNext();
    return () => clearTimeout(timer);
  }, []);

  const elapsedStr = `${Math.floor(elapsed / 1000)}s`;

  return (
    <div className="flex flex-1 flex-col items-center justify-center py-6" role="status" aria-label="Cargando SKUs">
      {/* Spinner + label */}
      <div className="flex items-center gap-2.5">
        <svg className="h-4 w-4 text-brand-400" style={{ animation: "aq-spin-slow 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Analizando productos
        </span>
        <span className="font-mono text-[10px] tabular-nums text-gray-300 dark:text-gray-600">{elapsedStr}</span>
      </div>

      {/* Activity messages */}
      <div className="mt-4 w-full max-w-[280px] space-y-1">
        {messages.map((msg, i) => {
          const isLatest = i === messages.length - 1;
          return (
            <div
              key={msg}
              className="flex items-center gap-2"
              style={{ animation: "aq-fade-in 0.3s ease-out both" }}
            >
              <span className={`font-mono text-[10px] ${isLatest ? "text-brand-500" : "text-gray-300 dark:text-gray-600"}`}>
                {isLatest ? "\u203A" : "\u2713"}
              </span>
              <span className={`font-mono text-[11px] ${
                isLatest ? "text-gray-600 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"
              }`}>
                {msg}
              </span>
            </div>
          );
        })}
      </div>

      {/* Placeholder rows hint */}
      <div className="mt-5 flex w-full flex-col gap-1.5 opacity-30">
        {[65, 53, 41].map((w, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-gray-100 px-3.5 py-2.5 dark:border-gray-700/50">
            <div className="h-5 w-5 shrink-0 rounded-md bg-gray-100 dark:bg-gray-700" />
            <div className="h-2.5 rounded bg-gray-100 dark:bg-gray-700" style={{ width: `${w}%` }} />
            <div className="h-2.5 w-12 shrink-0 rounded bg-gray-100 dark:bg-gray-700" />
          </div>
        ))}
      </div>
    </div>
  );
}
