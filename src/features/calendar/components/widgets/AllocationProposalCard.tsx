/**
 * AllocationProposalCard — Lista de propuestas + botón generar + diff vs previa.
 */
import { useMemo, useState } from "react";
import type { AllocationProposal } from "@/domain/events/types";
import { diffProposals } from "@/domain/events/proposalDiff";

interface Props {
  proposals: AllocationProposal[];
  isGenerating: boolean;
  isApproving: boolean;
  canGenerate: boolean;          // hay SKUs y tiendas activation
  onGenerate: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

const STATUS_LABEL: Record<AllocationProposal["status"], string> = {
  draft: "Borrador",
  approved: "Aprobada",
  superseded: "Reemplazada",
  rejected: "Rechazada",
};

const STATUS_CLS: Record<AllocationProposal["status"], string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  approved: "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300",
  superseded: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400",
  rejected: "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-400",
};

const REASON_LABEL: Record<string, string> = {
  transfer_from_store: "Transferencia entre tiendas",
  restock_from_depot: "Reposición desde depósito",
  missing_size: "Talle faltante en tienda",
  out_of_stock: "Sin stock (señal de compra)",
};

export function AllocationProposalCard({
  proposals,
  isGenerating,
  isApproving,
  canGenerate,
  onGenerate,
  onApprove,
  onReject,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);

  // Map proposalId → previous version's payload (versions desc, so prev = next index)
  const prevPayloadById = useMemo(() => {
    const sorted = [...proposals].sort((a, b) => b.version - a.version);
    const map = new Map<string, AllocationProposal["payload"] | null>();
    for (let i = 0; i < sorted.length; i++) {
      const prev = sorted[i + 1] ?? null;
      map.set(sorted[i].id, prev ? prev.payload : null);
    }
    return map;
  }, [proposals]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Propuestas de allocation
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Cada generación crea una versión nueva. Solo aprobada cuenta como decisión.
          </p>
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {isGenerating ? "Generando..." : "Generar propuesta"}
        </button>
      </div>

      {proposals.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-gray-400">
          {canGenerate
            ? "Sin propuestas todavía. Generá la primera versión."
            : "Agregá SKUs y tiendas de activación para habilitar el generador."}
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {proposals.map((p) => {
            const isExpanded = expandedId === p.id;
            return (
              <li key={p.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    v{p.version}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <span className="text-xs text-gray-500">
                    {p.totalLines} líneas · {p.totalUnits} uds
                  </span>
                  {p.readinessPct !== null && (
                    <span className="text-xs text-gray-500">
                      Readiness al generar: {p.readinessPct.toFixed(1)}%
                    </span>
                  )}
                  <span className="ml-auto text-xs text-gray-400">
                    {new Date(p.generatedAt).toLocaleString("es-PY")}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {isExpanded ? "Ocultar líneas" : "Ver líneas"}
                  </button>
                  {p.version > 1 && (
                    <button
                      type="button"
                      onClick={() => setDiffId(diffId === p.id ? null : p.id)}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {diffId === p.id ? "Ocultar diff" : `Comparar vs v${p.version - 1}`}
                    </button>
                  )}
                  {p.status === "draft" && (
                    <>
                      <button
                        type="button"
                        onClick={() => onApprove(p.id)}
                        disabled={isApproving}
                        className="rounded-md bg-success-500 px-2 py-1 text-xs font-medium text-white hover:bg-success-600 disabled:opacity-50"
                      >
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(p.id)}
                        className="rounded-md border border-error-300 px-2 py-1 text-xs font-medium text-error-700 hover:bg-error-50 dark:border-error-700 dark:text-error-400 dark:hover:bg-error-500/10"
                      >
                        Rechazar
                      </button>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-700">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        <tr>
                          <th className="px-2 py-1 text-left">SKU</th>
                          <th className="px-2 py-1 text-left">Talle</th>
                          <th className="px-2 py-1 text-left">Origen → Destino</th>
                          <th className="px-2 py-1 text-right">Uds</th>
                          <th className="px-2 py-1 text-left">Razón</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {p.payload.map((l, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1 font-mono text-gray-700 dark:text-gray-300">
                              {l.skuComercial}
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{l.talle}</td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                              {l.fromStore ?? "—"} → {l.toStore}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">
                              {l.units}
                            </td>
                            <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
                              {REASON_LABEL[l.reason] ?? l.reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {diffId === p.id && p.version > 1 && (
                  <DiffView
                    prev={prevPayloadById.get(p.id) ?? null}
                    next={p.payload}
                    prevVersion={p.version - 1}
                    nextVersion={p.version}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Diff view ───────────────────────────────────────────────────────────────

function DiffView({
  prev,
  next,
  prevVersion,
  nextVersion,
}: {
  prev: AllocationProposal["payload"] | null;
  next: AllocationProposal["payload"];
  prevVersion: number;
  nextVersion: number;
}) {
  const diff = useMemo(() => diffProposals(prev, next), [prev, next]);
  const total = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <div className="mt-3 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800">
        <span className="font-medium text-gray-700 dark:text-gray-300">
          v{prevVersion} → v{nextVersion}
        </span>
        <span className="text-success-700 dark:text-success-400">+{diff.added.length} añadidas</span>
        <span className="text-error-700 dark:text-error-400">−{diff.removed.length} quitadas</span>
        <span className="text-warning-700 dark:text-warning-400">~{diff.changed.length} cambiadas</span>
        <span className="text-gray-500">= {diff.unchanged} iguales</span>
      </div>
      {total === 0 ? (
        <div className="px-3 py-4 text-center text-xs text-gray-400">
          Las dos versiones tienen las mismas líneas.
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-2 py-1 text-left w-[60px]">Δ</th>
                <th className="px-2 py-1 text-left">SKU · Talle</th>
                <th className="px-2 py-1 text-left">Ruta</th>
                <th className="px-2 py-1 text-right">Antes</th>
                <th className="px-2 py-1 text-right">Después</th>
                <th className="px-2 py-1 text-left">Razón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {diff.added.map((e, i) => (
                <DiffRow key={`a${i}`} entry={e} kind="added" />
              ))}
              {diff.changed.map((e, i) => (
                <DiffRow key={`c${i}`} entry={e} kind="changed" />
              ))}
              {diff.removed.map((e, i) => (
                <DiffRow key={`r${i}`} entry={e} kind="removed" />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DiffRow({
  entry,
  kind,
}: {
  entry: import("@/domain/events/proposalDiff").ProposalDiffEntry;
  kind: "added" | "removed" | "changed";
}) {
  const badgeCls = {
    added:   "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300",
    removed: "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300",
    changed: "bg-warning-100 text-warning-700 dark:bg-warning-500/20 dark:text-warning-300",
  }[kind];
  const label = { added: "+", removed: "−", changed: "~" }[kind];
  const reason = entry.next?.reason ?? entry.prev?.reason ?? "";
  return (
    <tr>
      <td className="px-2 py-1">
        <span className={`inline-flex h-5 w-6 items-center justify-center rounded font-mono text-xs ${badgeCls}`}>
          {label}
        </span>
      </td>
      <td className="px-2 py-1 font-mono text-gray-700 dark:text-gray-300">
        {entry.skuComercial} · {entry.talle}
      </td>
      <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
        {entry.fromStore ?? "—"} → {entry.toStore}
      </td>
      <td className="px-2 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">
        {entry.prev ? entry.prev.units : "—"}
      </td>
      <td className="px-2 py-1 text-right tabular-nums text-gray-700 dark:text-gray-300">
        {entry.next ? entry.next.units : "—"}
      </td>
      <td className="px-2 py-1 text-gray-600 dark:text-gray-400">
        {REASON_LABEL[reason] ?? reason}
      </td>
    </tr>
  );
}
