/**
 * StockHealthWidget — Stock por SKU vinculado al evento, agregado por tienda activation.
 */
import { useMemo } from "react";
import type { EventSku, EventStore, EventInventoryRow } from "@/domain/events/types";

interface Props {
  skus: EventSku[];
  stores: EventStore[];
  inventory: EventInventoryRow[]; // ya filtrado a SKUs del evento
}

interface Cell {
  sku: string;
  description: string;
  perStore: Map<string, number>;
  totalUnits: number;
}

export function StockHealthWidget({ skus, stores, inventory }: Props) {
  const activationStores = useMemo(
    () => stores.filter((s) => s.role !== "warehouse").map((s) => s.storeCode),
    [stores],
  );

  const skuMeta = useMemo(() => new Map(skus.map((s) => [s.skuComercial, s])), [skus]);

  const cells = useMemo<Cell[]>(() => {
    const map = new Map<string, Cell>();
    for (const sku of skus) {
      map.set(sku.skuComercial, {
        sku: sku.skuComercial,
        description: "",
        perStore: new Map(activationStores.map((st) => [st, 0])),
        totalUnits: 0,
      });
    }
    for (const row of inventory) {
      const cell = map.get(row.skuComercial);
      if (!cell) continue;
      if (!cell.description) cell.description = row.skuComercial;
      const current = cell.perStore.get(row.store) ?? 0;
      if (activationStores.includes(row.store)) {
        cell.perStore.set(row.store, current + row.units);
      }
      cell.totalUnits += row.units;
    }
    return Array.from(map.values());
  }, [skus, inventory, activationStores]);

  if (skus.length === 0) {
    return (
      <Empty title="Stock por tienda" message="Agregá SKUs al evento para ver el stock." />
    );
  }
  if (activationStores.length === 0) {
    return <Empty title="Stock por tienda" message="Agregá tiendas de activación." />;
  }

  return (
    <Card title="Stock por tienda" subtitle={`${skus.length} SKU${skus.length === 1 ? "" : "s"} × ${activationStores.length} tienda${activationStores.length === 1 ? "" : "s"}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-3 py-2 text-left">SKU</th>
              <th className="px-3 py-2 text-left">Marca</th>
              {activationStores.map((st) => (
                <th key={st} className="px-3 py-2 text-right font-mono">{st}</th>
              ))}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {cells.map((c) => (
              <tr key={c.sku}>
                <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                  {c.sku}
                </td>
                <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                  {skuMeta.get(c.sku)?.brand ?? "—"}
                </td>
                {activationStores.map((st) => {
                  const v = c.perStore.get(st) ?? 0;
                  return (
                    <td
                      key={st}
                      className={`px-3 py-2 text-right tabular-nums ${
                        v === 0
                          ? "text-error-600 dark:text-error-400"
                          : "text-gray-900 dark:text-white"
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-white">
                  {c.totalUnits}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ title, message }: { title: string; message: string }) {
  return (
    <Card title={title}>
      <div className="px-4 py-6 text-center text-sm text-gray-400">{message}</div>
    </Card>
  );
}
