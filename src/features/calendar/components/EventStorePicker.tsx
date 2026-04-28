/**
 * features/calendar/components/EventStorePicker.tsx
 *
 * Modal de selección de tiendas que participan del evento.
 * Multi-select por cluster, con asignación de role.
 */
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useStoreConfig } from "@/hooks/useConfig";
import { useEventStores } from "../hooks/useEventStores";
import type { EventStoreRole } from "@/domain/events/types";

interface Props {
  eventId: string;
  alreadyLinked: string[];
  onClose: () => void;
}

const ROLES: { value: EventStoreRole; label: string }[] = [
  { value: "activation", label: "Activación" },
  { value: "warehouse", label: "Depósito" },
  { value: "support", label: "Apoyo" },
];

const CLUSTER_LABEL: Record<string, string> = {
  A: "Cluster A (Premium)",
  B: "Cluster B (Standard)",
  OUT: "Cluster OUT (Outlet)",
};

const INPUT_CLS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

export function EventStorePicker({ eventId, alreadyLinked, onClose }: Props) {
  const storeConfig = useStoreConfig();
  const { addStores, isMutating } = useEventStores(eventId);
  const linkedSet = useMemo(() => new Set(alreadyLinked), [alreadyLinked]);

  const [search, setSearch] = useState("");
  const [clusterFilter, setClusterFilter] = useState<string>("all");
  const [role, setRole] = useState<EventStoreRole>("activation");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [excludeOut, setExcludeOut] = useState(true);

  const allStores = useMemo(() => {
    return Object.entries(storeConfig.clusters)
      .map(([storeCode, cluster]) => ({ storeCode, cluster }))
      .filter((s) => !storeConfig.excludedStores.has(s.storeCode))
      .sort((a, b) => a.storeCode.localeCompare(b.storeCode));
  }, [storeConfig]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allStores.filter((s) => {
      if (linkedSet.has(s.storeCode)) return false;
      if (clusterFilter !== "all" && s.cluster !== clusterFilter) return false;
      if (excludeOut && s.cluster === "OUT") return false;
      if (q && !s.storeCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allStores, search, clusterFilter, linkedSet, excludeOut]);

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleAllVisible() {
    if (selected.size >= filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((s) => s.storeCode)));
    }
  }

  async function handleAdd() {
    if (selected.size === 0) return;
    const inputs = Array.from(selected).map((storeCode) => ({
      eventId,
      storeCode,
      role,
    }));
    await addStores(inputs);
    onClose();
  }

  return (
    <Modal isOpen onClose={onClose} className="max-w-2xl p-6 sm:p-8">
      <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
        Agregar tiendas al evento
      </h2>
      <p className="mb-4 text-xs text-gray-400 dark:text-gray-500">
        Tiendas donde el evento se ejecuta. El rol "Depósito" indica que la tienda actúa como warehouse.
      </p>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <input
          type="text"
          placeholder="Buscar por código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={INPUT_CLS}
        />
        <select
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
          className={INPUT_CLS}
          aria-label="Filtrar por cluster"
        >
          <option value="all">Todos los clusters</option>
          <option value="A">Cluster A</option>
          <option value="B">Cluster B</option>
          <option value="OUT">Cluster OUT</option>
        </select>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as EventStoreRole)}
          className={INPUT_CLS}
          aria-label="Rol de la tienda"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{`Rol: ${r.label}`}</option>
          ))}
        </select>
      </div>

      <label className="mb-3 inline-flex items-center gap-2 text-xs text-gray-500">
        <input
          type="checkbox"
          checked={excludeOut}
          onChange={(e) => setExcludeOut(e.target.checked)}
        />
        Excluir cluster OUT por defecto
      </label>

      <div className="mb-3 max-h-[420px] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
          <span>{filtered.length} tienda{filtered.length === 1 ? "" : "s"} disponibles</span>
          <button
            type="button"
            onClick={toggleAllVisible}
            className="text-brand-600 hover:underline"
          >
            {selected.size >= filtered.length ? "Desmarcar todas" : "Marcar todas"}
          </button>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Sin tiendas disponibles con esos filtros.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {filtered.map((s) => (
              <li key={s.storeCode}>
                <button
                  type="button"
                  onClick={() => toggle(s.storeCode)}
                  className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-brand-50/40 dark:hover:bg-brand-500/5"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(s.storeCode)}
                    onChange={() => toggle(s.storeCode)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Seleccionar ${s.storeCode}`}
                  />
                  <span className="flex-1 font-mono text-sm text-gray-900 dark:text-white">
                    {s.storeCode}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {CLUSTER_LABEL[s.cluster] ?? s.cluster}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-3">
        <span className="mr-auto text-sm text-gray-500">
          {selected.size} seleccionada{selected.size === 1 ? "" : "s"}
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
