/**
 * features/action-queue/components/ActionFilters.tsx
 *
 * Chips de tipo para filtrar acciones por categoría operativa.
 * Estado controlado — lifted a ActionsTab.
 */
import { FILTER_META, FILTER_COLORS, type ActionFilterType } from "./ActionFilters.utils";

interface Props {
  filterType: ActionFilterType;
  onFilterTypeChange: (value: ActionFilterType) => void;
  counts: Record<ActionFilterType, number>;
}

export function ActionFilters({ filterType, onFilterTypeChange, counts }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {FILTER_META.map(({ type, label }) => {
        const isActive = filterType === type;
        const count = counts[type];
        if (type !== "all" && count === 0) return null;

        return (
          <button
            key={type}
            onClick={() => onFilterTypeChange(type)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-150 ${
              isActive
                ? FILTER_COLORS[type]
                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600"
            }`}
          >
            {label}
            <span className={`tabular-nums ${isActive ? "opacity-80" : "opacity-60"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
