/**
 * ArrivalsWidget — ETAs pendientes de las marcas vinculadas al evento.
 *
 * NOTE Fase A: matching es por brand (productos_importacion no expone
 * sku_comercial). Es informativo, no readiness-driving.
 */
import type { EventArrival } from "@/domain/events/types";

interface Props {
  arrivals: EventArrival[];
}

function formatEta(eta: string | null): string {
  if (!eta) return "—";
  const d = new Date(`${eta}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return eta;
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" });
}

export function ArrivalsWidget({ arrivals }: Props) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Llegadas pendientes
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Importaciones de las marcas del evento (no en stock).
        </p>
      </div>
      {arrivals.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          Sin llegadas pendientes.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Marca</th>
                <th className="px-3 py-2 text-left">ETA</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-right">Unidades</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {arrivals.slice(0, 50).map((a, i) => (
                <tr key={`${a.brand}-${a.description}-${i}`}>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{a.description}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{a.brand}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{formatEta(a.eta)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                      {a.status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {a.units.toLocaleString("es-PY")}
                  </td>
                </tr>
              ))}
              {arrivals.length > 50 && (
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-center text-xs text-gray-400">
                    Mostrando 50 de {arrivals.length}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
