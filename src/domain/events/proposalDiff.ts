/**
 * domain/events/proposalDiff.ts
 *
 * Diff entre dos versiones de AllocationProposal.
 *
 * Una "línea" se identifica por (sku_comercial, talle, fromStore, toStore).
 * Si entre v1 y v2 cambia `units` o `reason` para la misma key, va a `changed`.
 * Si la key existe solo en v1 → `removed`. Si solo en v2 → `added`.
 *
 * Pure function — sin BD ni efectos.
 */
import type { AllocationLine } from "./types";

export interface ProposalDiffEntry {
  sku: string;
  skuComercial: string;
  talle: string;
  brand: string;
  fromStore: string | null;
  toStore: string;
  prev: { units: number; reason: AllocationLine["reason"] } | null;
  next: { units: number; reason: AllocationLine["reason"] } | null;
}

export interface ProposalDiff {
  added: ProposalDiffEntry[];
  removed: ProposalDiffEntry[];
  changed: ProposalDiffEntry[];
  unchanged: number; // contador, no payload (ahorra memoria)
}

/**
 * Computa el diff entre dos sets de líneas.
 * `prev` puede ser null (significa "comparar contra vacío" → todo es `added`).
 */
export function diffProposals(
  prev: AllocationLine[] | null,
  next: AllocationLine[],
): ProposalDiff {
  const prevMap = indexLines(prev ?? []);
  const nextMap = indexLines(next);

  const added: ProposalDiffEntry[] = [];
  const removed: ProposalDiffEntry[] = [];
  const changed: ProposalDiffEntry[] = [];
  let unchanged = 0;

  // added + changed
  for (const [key, nLine] of nextMap) {
    const pLine = prevMap.get(key);
    if (!pLine) {
      added.push(toEntry(nLine, null, nLine));
      continue;
    }
    if (pLine.units !== nLine.units || pLine.reason !== nLine.reason) {
      changed.push(toEntry(nLine, pLine, nLine));
    } else {
      unchanged += 1;
    }
  }
  // removed
  for (const [key, pLine] of prevMap) {
    if (!nextMap.has(key)) {
      removed.push(toEntry(pLine, pLine, null));
    }
  }

  return { added, removed, changed, unchanged };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function lineKey(line: AllocationLine): string {
  return `${line.skuComercial}|${line.talle}|${line.fromStore ?? "_"}|${line.toStore}`;
}

function indexLines(lines: AllocationLine[]): Map<string, AllocationLine> {
  const map = new Map<string, AllocationLine>();
  for (const l of lines) {
    // Si por alguna razón hay duplicados, sumamos las units (defensivo)
    const key = lineKey(l);
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, units: existing.units + l.units });
    } else {
      map.set(key, l);
    }
  }
  return map;
}

function toEntry(
  ref: AllocationLine,
  prev: AllocationLine | null,
  next: AllocationLine | null,
): ProposalDiffEntry {
  return {
    sku: ref.sku,
    skuComercial: ref.skuComercial,
    talle: ref.talle,
    brand: ref.brand,
    fromStore: ref.fromStore,
    toStore: ref.toStore,
    prev: prev ? { units: prev.units, reason: prev.reason } : null,
    next: next ? { units: next.units, reason: next.reason } : null,
  };
}
