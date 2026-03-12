/**
 * features/sales/components/salesAnalytics.shared.tsx
 *
 * Shared React components used across the SalesAnalytics card components.
 * Only exports React components (no constants/functions) to avoid react-refresh warnings.
 *
 * For constants and pure functions, see salesAnalytics.constants.ts
 */

// ─── Section header (consistent with StatCard label style) ───────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
      {children}
    </p>
  );
}

// ─── Lazy load prompt ────────────────────────────────────────────────────────

export function LazyLoadPrompt({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-10 text-sm font-medium text-gray-400 transition-all duration-200 hover:border-brand-300 hover:bg-brand-50/30 hover:text-brand-500 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-500 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5 dark:hover:text-brand-400"
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Mini sparkline (pure SVG, no ApexCharts overhead) ──────────────────────

export function MiniSparkline({ data, color = "#465FFF" }: { data: number[]; color?: string }) {
  if (data.length < 2 || data.every((v) => v === 0)) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pad = 4;

  const pts = data.map((v, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: pad + (1 - (v - min) / range) * (h - pad * 2),
  }));

  // Smooth cubic bezier through points (Catmull-Rom → cubic)
  const tension = 0.3;
  let curvePath = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    curvePath += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  const lastX = pts[pts.length - 1].x;
  const firstX = pts[0].x;
  const areaPath = `${curvePath} L${lastX},${h} L${firstX},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-24 shrink-0" preserveAspectRatio="none">
      <path d={areaPath} fill={color} opacity={0.08} />
      <path d={curvePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
