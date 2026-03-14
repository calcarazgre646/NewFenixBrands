/**
 * features/depots/components/MiniTable.tsx
 *
 * Mini-tabla reutilizable para desglose de marcas/categorias dentro de nodos.
 * Patrón de diseño: MonthlyPerformanceTable (ExecutivePage).
 */

interface Props {
  title: string;
  subtitle?: string;
  headers: string[];
  rows: string[][];
}

export default function MiniTable({ title, subtitle, headers, rows }: Props) {
  const thCls = "px-2 py-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 whitespace-nowrap";

  return (
    <div className="overflow-hidden bg-white dark:bg-gray-800">
      <div className="border-b border-gray-100 px-2 py-2 dark:border-gray-700">
        <h3 className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-[9px] text-gray-400 dark:text-gray-500">{subtitle}</p>
        )}
      </div>
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-600">
            {headers.map((h, i) => (
              <th key={h} className={`${thCls} ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
          {rows.map((row, i) => (
            <tr key={i} className="transition-colors hover:bg-gray-50/70 dark:hover:bg-white/[0.02]">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`whitespace-nowrap px-2 py-1.5 text-[11px] ${
                    j === 0
                      ? "font-medium text-gray-800 dark:text-white"
                      : "text-right tabular-nums text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
