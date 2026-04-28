/**
 * CommissionsLoader — skeleton de carga de la sección Comisiones.
 *
 * Replica el layout real de cada componente (StatCard, Tabs,
 * StaircaseCommissionCurve, MiniSellerList, HeroTrinityCard, etc.) para
 * evitar el "salto" visual cuando los datos terminan de cargar. Es
 * rol-aware: muestra el esqueleto del scope correcto (self vs team)
 * porque `useCompensationScope()` resuelve sincrónicamente desde el
 * AuthContext y `data.scope` ya está disponible durante isLoading.
 */
import type { CompensationScope } from "../hooks/useCompensationScope";

interface Props {
  scope: CompensationScope;
}

const PULSE = "animate-pulse rounded-md bg-gray-200 dark:bg-gray-700";

function Bar({ w, h, className = "" }: { w: string; h: string; className?: string }) {
  return <div className={`${PULSE} ${className}`} style={{ width: w, height: h }} aria-hidden="true" />;
}

function Pill({ w, h = "28px", className = "" }: { w: string; h?: string; className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-full bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ width: w, height: h }}
      aria-hidden="true"
    />
  );
}

export default function CommissionsLoader({ scope }: Props) {
  return (
    <div className="space-y-5 p-4 sm:p-6" role="status" aria-label="Cargando comisiones…">
      <Header scope={scope} />
      <TabStrip scope={scope} />
      {scope === "self" ? <SelfBody /> : <TeamBody />}
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function Header({ scope }: { scope: CompensationScope }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Bar w="120px" h="22px" />
        <Pill w="160px" h="22px" />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="rounded-lg border border-gray-200 dark:border-gray-600">
          <Bar w="110px" h="32px" className="!rounded-lg !bg-gray-100 dark:!bg-gray-800" />
        </div>
        {scope === "team" && (
          <div className="flex overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600">
            {["56px", "60px", "78px", "44px"].map((w, i) => (
              <Bar key={i} w={w} h="32px" className="!rounded-none !bg-gray-100 dark:!bg-gray-800" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function TabStrip({ scope }: { scope: CompensationScope }) {
  const tabs = scope === "team"
    ? [{ w: "78px", active: true }, { w: "98px", active: false }, { w: "82px", active: false }]
    : [{ w: "78px", active: true }, { w: "82px", active: false }];

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
      {tabs.map((t, i) => (
        <div key={i} className="relative px-4 py-2">
          <Bar w={t.w} h="14px" className={t.active ? "!bg-brand-200 dark:!bg-brand-500/30" : ""} />
          {t.active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-brand-500/40" />}
        </div>
      ))}
    </div>
  );
}

// ─── StatCard skeleton (matches src/components/ui/stat-card/StatCard.tsx) ──

function StatCardSk() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 sm:p-5 dark:border-gray-700 dark:bg-gray-800">
      <Bar w="55%" h="11px" />
      <Bar w="70%" h="22px" className="mt-2" />
      <Bar w="48%" h="10px" className="mt-2" />
    </div>
  );
}

// ─── Body — Team ──────────────────────────────────────────────────────────

function TeamBody() {
  return (
    <>
      {/* 4 StatCards reales en grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCardSk />
        <StatCardSk />
        <StatCardSk />
        <StatCardSk />
      </div>

      {/* Banda de tooltips de fórmula */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
        <div className="flex items-center gap-1.5">
          <Bar w="120px" h="10px" />
          <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="flex items-center gap-1.5">
          <Bar w="180px" h="10px" />
          <span className="inline-block h-3.5 w-3.5 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>

      {/* Curva staircase — fila completa, mismo card que la real */}
      <CurveCard />

      {/* Top + Bottom mini-listas — 2 cols */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MiniListCard variant="ahead" />
        <MiniListCard variant="behind" />
      </div>
    </>
  );
}

// ─── Body — Self ──────────────────────────────────────────────────────────

function SelfBody() {
  return (
    <>
      <HeroCardSk />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <CurveCard />
        <DailyChartCard />
      </div>
      <WhatIfCard />
    </>
  );
}

// ─── Tarjetas individuales ────────────────────────────────────────────────

function CurveCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 space-y-1.5">
        <Bar w="160px" h="11px" />
        <Bar w="320px" h="10px" />
      </div>
      {/* Área del chart con bands sutiles para sugerir el step */}
      <div className="relative h-[260px] overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-900/40">
        <div className="absolute inset-x-4 inset-y-4 flex items-end gap-1.5">
          {[18, 18, 28, 38, 50, 64, 80, 96].map((h, i) => (
            <div
              key={i}
              className={`${PULSE} flex-1 !rounded-t`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DailyChartCard() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3">
        <Bar w="140px" h="11px" />
      </div>
      <div className="relative h-[260px] overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-900/40">
        {/* línea quebrada que sube */}
        <div className="absolute inset-x-4 inset-y-4 flex items-end gap-[2px]">
          {Array.from({ length: 30 }).map((_, i) => (
            <div
              key={i}
              className={`${PULSE} flex-1 !rounded-t`}
              style={{ height: `${20 + Math.min(60, i * 2.5)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCardSk() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      {/* Header de la card */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div className="space-y-1.5">
          <Bar w="200px" h="14px" />
          <Bar w="160px" h="10px" />
        </div>
        <span className="ml-auto"><Pill w="90px" h="22px" /></span>
      </div>

      {/* 3 columnas */}
      <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-gray-700/40 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 bg-white p-5 dark:bg-gray-800">
            <Bar w="55%" h="10px" />
            <Bar w="75%" h="26px" className="mt-2" />
            <Bar w="60%" h="11px" className="mt-2" />
            <Bar w="45%" h="10px" />
          </div>
        ))}
      </div>

      {/* Barra de progreso */}
      <div className="px-5 py-4">
        <div className={`${PULSE} h-2.5 !rounded-full`} />
        <div className="mt-2 flex justify-between">
          <Bar w="20px" h="9px" />
          <Bar w="120px" h="9px" />
        </div>
      </div>
    </div>
  );
}

function WhatIfCard() {
  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <Bar w="180px" h="11px" />
      <Bar w="65%" h="11px" />
      <div className="flex items-center gap-2">
        <Bar w="160px" h="36px" className="!rounded-lg" />
        <Bar w="220px" h="11px" />
      </div>
      <Bar w="100%" h="6px" className="!rounded-full" />
      <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-700/40">
            <Bar w="60%" h="9px" />
            <Bar w="70%" h="20px" className="mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniListCard({ variant }: { variant: "ahead" | "behind" }) {
  const accent = variant === "ahead"
    ? "border-success-200 dark:border-success-500/20"
    : "border-error-200 dark:border-error-500/20";

  return (
    <div className={`rounded-2xl border bg-white p-4 dark:bg-gray-800 ${accent}`}>
      <Bar w="170px" h="11px" className="mb-3" />
      <ul className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 space-y-1">
              <Bar w="65%" h="12px" />
              <Bar w="40%" h="10px" />
            </div>
            <Bar w="100px" h="12px" className="!rounded-full" />
            <Bar w="36px" h="11px" />
          </li>
        ))}
      </ul>
    </div>
  );
}
