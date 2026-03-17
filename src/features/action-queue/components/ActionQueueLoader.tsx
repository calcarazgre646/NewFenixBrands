/**
 * features/action-queue/components/ActionQueueLoader.tsx
 *
 * "Transparent Loading" — shows the user exactly what the system is doing
 * instead of hiding behind a generic skeleton.
 *
 * Patterns: Process Transparency, Staggered Reveal, Ambient Motion.
 */
import type { LoadingProgress } from "../hooks/useActionQueue";

// ─── Phase config ───────────────────────────────────────────────────────────

interface PhaseStep {
  key: string;
  label: string;
  detail: (p: LoadingProgress) => string;
  icon: string;
}

const PHASES: PhaseStep[] = [
  {
    key: "fetching-inventory",
    label: "Inventario",
    detail: (p) => p.inventoryRows > 0
      ? `${p.inventoryRows.toLocaleString("es-PY")} registros cargados`
      : "Consultando stock de todas las tiendas…",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    key: "fetching-history",
    label: "Historial de Ventas",
    detail: (p) => `Analizando 6 meses de ventas para ${p.uniqueSkus.toLocaleString("es-PY")} SKUs…`,
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    key: "computing-waterfall",
    label: "Algoritmo Waterfall",
    detail: () => "Priorizando acciones por impacto económico…",
    icon: "M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12",
  },
];

function phaseIndex(phase: string): number {
  const idx = PHASES.findIndex((p) => p.key === phase);
  return idx === -1 ? PHASES.length : idx;
}

// ─── Floating cards (ambient depth) ─────────────────────────────────────────

const FLOAT_CARDS = [
  { w: 180, h: 56, x: "4%",  y: "8%",  delay: 0,   color: "#10B981" },
  { w: 160, h: 48, x: "75%", y: "6%",  delay: 0.8, color: "#F97316" },
  { w: 140, h: 44, x: "78%", y: "82%", delay: 1.6, color: "#3B82F6" },
  { w: 170, h: 52, x: "2%",  y: "80%", delay: 2.4, color: "#8B5CF6" },
  { w: 150, h: 46, x: "82%", y: "44%", delay: 3.2, color: "#EC4899" },
];

function FloatingCards() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block" aria-hidden="true">
      {FLOAT_CARDS.map((card, i) => (
        <div
          key={i}
          className="absolute rounded-xl border border-gray-200/40 bg-white/60 backdrop-blur-sm dark:border-gray-700/30 dark:bg-gray-800/40"
          style={{
            width: card.w,
            height: card.h,
            left: card.x,
            top: card.y,
            animation: `aq-float ${6 + i * 0.7}s ease-in-out ${card.delay}s infinite alternate`,
          }}
        >
          <div className="flex h-full items-center gap-3 px-4">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: card.color, opacity: 0.7 }}
            />
            <div className="flex-1 space-y-1.5">
              <div
                className="h-2 rounded-full"
                style={{ width: "60%", backgroundColor: card.color, opacity: 0.15 }}
              />
              <div className="h-1.5 w-4/5 rounded-full bg-gray-200/60 dark:bg-gray-700/40" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ActionQueueLoader({ progress }: { progress: LoadingProgress }) {
  const currentIdx = phaseIndex(progress.phase);

  return (
    <div className="relative flex h-[calc(100dvh-12rem)] flex-col items-center justify-center" role="status" aria-label="Cargando Cola de Acciones">

      {/* ── Ambient floating cards ── */}
      <FloatingCards />

      {/* ── Central content ── */}
      <div className="relative z-10 w-full max-w-lg">

        {/* ── Header ── */}
        <div className="mb-5 flex items-center gap-3.5" style={{ animation: "aq-fade-in 0.6s ease-out both" }}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10">
            <svg className="h-5 w-5 text-brand-500" style={{ animation: "aq-spin-slow 3s linear infinite" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Definiendo Acciones
            </h2>
            <p className="mt-0.5 text-sm text-gray-400 dark:text-gray-500">
              Analizando inventario y ventas para priorizar acciones
            </p>
          </div>
        </div>

        {/* ── Phase steps ── */}
        <div className="mb-4 space-y-1.5">
          {PHASES.map((step, idx) => {
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            const isPending = idx > currentIdx;

            return (
              <div
                key={step.key}
                className={`
                  overflow-hidden rounded-xl border px-4 transition-all duration-500
                  ${isActive
                    ? "border-brand-200 bg-brand-50/80 shadow-sm dark:border-brand-500/30 dark:bg-brand-500/[0.08]"
                    : isDone
                      ? "border-success-200/60 bg-success-50/50 dark:border-success-500/20 dark:bg-success-500/[0.04]"
                      : "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30"
                  }
                `}
                style={{
                  animation: `aq-fade-in 0.4s ease-out ${idx * 100 + 200}ms both`,
                }}
              >
                <div className="flex items-center gap-3 py-2">

                  {/* Status indicator */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    {isDone ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-success-500">
                        <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isActive ? (
                      <div className="relative flex h-6 w-6 items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-brand-500/20" style={{ animation: "aq-ping 1.5s ease-out infinite" }} />
                        <div className="h-3 w-3 rounded-full bg-brand-500" style={{ animation: "aq-pulse 1.5s ease-in-out infinite" }} />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-200 dark:border-gray-700">
                        <span className="text-[10px] font-bold tabular-nums text-gray-300 dark:text-gray-600">{idx + 1}</span>
                      </div>
                    )}
                  </div>

                  {/* Icon */}
                  <svg
                    className={`h-4 w-4 shrink-0 transition-colors duration-300 ${
                      isDone ? "text-success-500" : isActive ? "text-brand-500" : "text-gray-300 dark:text-gray-600"
                    }`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d={step.icon} />
                  </svg>

                  {/* Label + detail */}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold transition-colors duration-300 ${
                      isPending ? "text-gray-300 dark:text-gray-600" : "text-gray-900 dark:text-white"
                    }`}>
                      {step.label}
                    </p>
                    {isActive && (
                      <p className="mt-0.5 truncate text-xs text-brand-600/80 dark:text-brand-400/70" style={{ animation: "aq-fade-in 0.3s ease-out both" }}>
                        {step.detail(progress)}
                      </p>
                    )}
                    {isDone && progress.inventoryRows > 0 && (
                      <p className="mt-0.5 truncate text-xs text-success-600/60 dark:text-success-400/50">
                        {step.detail(progress)}
                      </p>
                    )}
                  </div>

                  {/* Spinner for active */}
                  {isActive && (
                    <div className="shrink-0">
                      <svg className="h-4 w-4 text-brand-400" style={{ animation: "aq-spin-slow 1s linear infinite" }} fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Data counters (appear as data becomes available) ── */}
        <div className="grid grid-cols-2 gap-3">
          <CounterPill
            label="Registros"
            value={progress.inventoryRows}
            visible={progress.inventoryRows > 0}
            delay={0}
          />
          <CounterPill
            label="SKUs"
            value={progress.uniqueSkus}
            visible={progress.uniqueSkus > 0}
            delay={100}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Counter pill ───────────────────────────────────────────────────────────

function CounterPill({ label, value, visible, delay }: {
  label: string;
  value: number;
  visible: boolean;
  delay: number;
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-2 text-center transition-all duration-500 ${
        visible
          ? "border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
          : "border-gray-100 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/20"
      }`}
      style={{
        animation: `aq-fade-in 0.4s ease-out ${delay + 800}ms both`,
      }}
    >
      <p className={`text-base font-bold tabular-nums transition-colors duration-300 ${
        visible ? "text-gray-900 dark:text-white" : "text-gray-200 dark:text-gray-700"
      }`}>
        {visible ? value.toLocaleString("es-PY") : "—"}
      </p>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </p>
    </div>
  );
}
