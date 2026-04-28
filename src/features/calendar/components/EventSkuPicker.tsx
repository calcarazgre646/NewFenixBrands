/**
 * features/calendar/components/EventSkuPicker.tsx
 *
 * Modal de selección masiva de SKUs comerciales (style-color) para vincular
 * a un evento del calendario.
 *
 * Reutiliza fetchPrices (ya dedupea por sku_comercial).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { fetchPrices } from "@/queries/pricing.queries";
import { pricingKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { useEventSkus } from "../hooks/useEventSkus";
import type { EventSkuIntent } from "@/domain/events/types";

interface Props {
  eventId: string;
  /** SKUs ya vinculados (para excluirlos del picker) */
  alreadyLinked: string[];
  onClose: () => void;
}

const INTENTS: { value: EventSkuIntent; label: string }[] = [
  { value: "sale", label: "Venta" },
  { value: "display", label: "Exhibición" },
  { value: "launch", label: "Lanzamiento" },
];

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

export function EventSkuPicker({ eventId, alreadyLinked, onClose }: Props) {
  const { addSkus, isMutating } = useEventSkus(eventId);
  const linkedSet = useMemo(() => new Set(alreadyLinked), [alreadyLinked]);

  const pricesQ = useQuery({
    queryKey: pricingKeys.list(null),
    queryFn: () => fetchPrices(null),
    staleTime: STALE_30MIN,
    gcTime: GC_60MIN,
  });

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [intent, setIntent] = useState<EventSkuIntent>("sale");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSkus = useMemo(() => pricesQ.data ?? [], [pricesQ.data]);
  const brands = useMemo(() => {
    const set = new Set(allSkus.map((s) => s.brand));
    return Array.from(set).sort();
  }, [allSkus]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSkus.filter((row) => {
      if (linkedSet.has(row.skuComercial)) return false;
      if (brandFilter !== "all" && row.brand !== brandFilter) return false;
      if (!q) return true;
      return (
        row.skuComercial.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  }, [allSkus, search, brandFilter, linkedSet]);

  function toggle(sku: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    const skuMeta = new Map(allSkus.map((s) => [s.skuComercial, s]));
    const inputs = Array.from(selected).map((sku) => {
      const meta = skuMeta.get(sku)!;
      return {
        eventId,
        skuComercial: sku,
        brand: meta.brand,
        intent,
      };
    });
    await addSkus(inputs);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} className="max-w-3xl p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
        Agregar SKUs al evento
      </h2>
      <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
        Seleccioná productos comerciales (style-color). La curva de talles se deriva del stock.
      </p>

      {/* Filtros */}
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Buscar por código o descripción"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={INPUT_CLS}
        />
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className={INPUT_CLS}
          aria-label="Filtrar por marca"
        >
          <option value="all">Todas las marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={intent}
          onChange={(e) => setIntent(e.target.value as EventSkuIntent)}
          className={INPUT_CLS}
          aria-label="Intent del SKU"
        >
          {INTENTS.map((i) => (
            <option key={i.value} value={i.value}>{`Intent: ${i.label}`}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      <div className="mb-3 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        {pricesQ.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Cargando productos...</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            {linkedSet.size > 0 && search === "" && brandFilter === "all"
              ? "Todos los productos disponibles ya están vinculados."
              : "Sin resultados con esos filtros."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Marca</th>
                <th className="px-3 py-2 text-right">PVP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.slice(0, 200).map((row) => (
                <tr
                  key={row.skuComercial}
                  onClick={() => toggle(row.skuComercial)}
                  className="cursor-pointer hover:bg-brand-50/40 dark:hover:bg-brand-500/5"
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.skuComercial)}
                      onChange={() => toggle(row.skuComercial)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Seleccionar ${row.skuComercial}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {row.skuComercial}
                  </td>
                  <td className="px-3 py-2 text-gray-900 dark:text-white">{row.description}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.brand}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    ₲ {row.pvp.toLocaleString("es-PY")}
                  </td>
                </tr>
              ))}
              {filtered.length > 200 && (
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-center text-xs text-gray-400">
                    Mostrando primeros 200 de {filtered.length}. Filtrá para ver el resto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto text-sm text-gray-500">
          {selected.size} seleccionado{selected.size === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          onClick={onClose}
          disabled={isMutating}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={selected.size === 0 || isMutating}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {isMutating ? "Agregando..." : `Agregar ${selected.size}`}
        </button>
      </div>
    </Modal>
  );
}
