/**
 * OriginBreakdownCard.tsx
 *
 * Distribucion por origen con barras CSS proporcionales.
 */
import { Card } from "@/components/ui/card/Card";

interface Props {
  byOrigin: Record<string, number>;
}

export function OriginBreakdownCard({ byOrigin }: Props) {
  const entries = Object.entries(byOrigin).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const maxUnits = entries[0][1];

  return (
    <Card padding="md">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Por Origen
      </p>
      <div className="space-y-2">
        {entries.map(([origin, units]) => (
          <div key={origin}>
            <div className="flex items-center justify-between text-xs">
              <span className="truncate text-gray-600 dark:text-gray-400">{origin}</span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                {units.toLocaleString("es-PY")}
              </span>
            </div>
            <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className="h-full rounded-full bg-brand-400 dark:bg-brand-500 transition-all duration-500"
                style={{ width: `${maxUnits > 0 ? (units / maxUnits) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
