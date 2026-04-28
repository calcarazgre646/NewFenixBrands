/**
 * CommissionsLoader — skeleton específico de la sección Comisiones.
 *
 * Replica el layout real del contenido para evitar saltos visuales cuando
 * los datos terminan de cargar. Es rol-aware: muestra el esqueleto del
 * scope correcto (self vs team) porque `useCompensationScope()` resuelve
 * sincrónicamente desde el AuthContext y ya está disponible en isLoading.
 */
import { Skeleton } from "@/components/ui/skeleton/Skeleton";
import type { CompensationScope } from "../hooks/useCompensationScope";

interface Props {
  scope: CompensationScope;
}

export default function CommissionsLoader({ scope }: Props) {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <HeaderSkeleton scope={scope} />
      <TabStripSkeleton scope={scope} />
      {scope === "self" ? <SelfBodySkeleton /> : <TeamBodySkeleton />}
    </div>
  );
}

// ─── Header ────────────────────────────────────────────────────────────────

function HeaderSkeleton({ scope }: { scope: CompensationScope }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="text" width="120px" height="22px" />
        <Skeleton variant="text" width="140px" height="22px" className="!rounded-full" />
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Skeleton variant="text" width="110px" height="32px" className="!rounded-lg" />
        {scope === "team" && (
          <Skeleton variant="text" width="220px" height="32px" className="!rounded-lg" />
        )}
      </div>
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────

function TabStripSkeleton({ scope }: { scope: CompensationScope }) {
  const tabsCount = scope === "team" ? 3 : 2;
  return (
    <div className="flex gap-3 border-b border-gray-200 pb-2 dark:border-gray-700">
      {Array.from({ length: tabsCount }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width="110px"
          height="20px"
          className={i === 0 ? "!bg-brand-200 dark:!bg-brand-500/30" : ""}
        />
      ))}
    </div>
  );
}

// ─── Body — Self (vendedor) ────────────────────────────────────────────────

function SelfBodySkeleton() {
  return (
    <>
      {/* Hero trinity card — 3 columnas + barra de progreso */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-700">
          <Skeleton variant="text" width="180px" height="18px" />
          <Skeleton variant="text" width="120px" height="14px" />
          <span className="ml-auto"><Skeleton variant="text" width="90px" height="22px" className="!rounded-full" /></span>
        </div>
        <div className="grid grid-cols-1 gap-px bg-gray-100 dark:bg-gray-700/50 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 bg-white p-5 dark:bg-gray-800">
              <Skeleton variant="text" width="60%" height="10px" />
              <Skeleton variant="text" width="80%" height="28px" />
              <Skeleton variant="text" width="55%" height="11px" />
            </div>
          ))}
        </div>
        <div className="px-5 py-3">
          <Skeleton variant="text" height="10px" className="!rounded-full" />
        </div>
      </div>

      {/* Curva + Chart día×día (2 cols) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCardSkeleton title="160px" />
        <ChartCardSkeleton title="120px" />
      </div>

      {/* WhatIf simulator */}
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <Skeleton variant="text" width="180px" height="11px" />
        <Skeleton variant="text" width="60%" height="14px" />
        <Skeleton variant="text" height="36px" className="!rounded-lg" />
        <Skeleton variant="text" height="6px" className="!rounded-full" />
        <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
          <Skeleton variant="card" height="64px" />
          <Skeleton variant="card" height="64px" />
          <Skeleton variant="card" height="64px" />
        </div>
      </div>
    </>
  );
}

// ─── Body — Team (gerencia) ────────────────────────────────────────────────

function TeamBodySkeleton() {
  return (
    <>
      {/* 4 StatCards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton variant="card" count={4} />
      </div>

      {/* Tooltips de fórmula */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 px-1">
        <Skeleton variant="text" width="160px" height="10px" />
        <Skeleton variant="text" width="220px" height="10px" />
      </div>

      {/* Curva — fila completa */}
      <ChartCardSkeleton title="180px" />

      {/* Top + Bottom mini lists */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MiniListSkeleton />
        <MiniListSkeleton />
      </div>
    </>
  );
}

// ─── Sub-componentes compartidos ───────────────────────────────────────────

function ChartCardSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 space-y-1.5">
        <Skeleton variant="text" width={title} height="11px" />
        <Skeleton variant="text" width="65%" height="10px" />
      </div>
      <Skeleton variant="text" height="240px" className="!rounded-xl" />
    </div>
  );
}

function MiniListSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <Skeleton variant="text" width="140px" height="11px" className="mb-3" />
      <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 space-y-1">
              <Skeleton variant="text" width="70%" height="12px" />
              <Skeleton variant="text" width="40%" height="10px" />
            </div>
            <Skeleton variant="text" width="100px" height="12px" />
            <Skeleton variant="text" width="36px" height="12px" />
          </div>
        ))}
      </div>
    </div>
  );
}
