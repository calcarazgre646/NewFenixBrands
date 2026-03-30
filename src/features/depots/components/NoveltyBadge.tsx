/**
 * features/depots/components/NoveltyBadge.tsx
 *
 * Badge inline para marcar productos de lanzamiento en tablas de SKU.
 */

export default function NoveltyBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">
      Nuevo
    </span>
  );
}
