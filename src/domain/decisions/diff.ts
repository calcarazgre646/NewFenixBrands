/**
 * domain/decisions/diff.ts
 *
 * Función pura para computar el diff entre 2 snapshots de configuración.
 * Sin side effects, sin React, sin imports de API.
 */
import type { ConfigChange } from "./types";

interface ConfigSnapshot {
  appParams: Record<string, unknown>[];
  storeConfig: Record<string, unknown>[];
  commissionConfig: Record<string, unknown>[];
}

/**
 * Computes the diff between two config snapshots.
 * Returns an array of per-field changes across the 3 config tables.
 */
export function computeConfigDiff(
  previous: ConfigSnapshot,
  current: ConfigSnapshot,
): ConfigChange[] {
  const changes: ConfigChange[] = [];

  diffTable(changes, "app_params", previous.appParams, current.appParams, "key");
  diffTable(changes, "config_store", previous.storeConfig, current.storeConfig, "store_code");
  diffTable(changes, "config_commission_scale", previous.commissionConfig, current.commissionConfig, "role");

  return changes;
}

function diffTable(
  changes: ConfigChange[],
  table: ConfigChange["table"],
  prevRows: Record<string, unknown>[],
  currRows: Record<string, unknown>[],
  keyField: string,
): void {
  const prevMap = indexBy(prevRows, keyField);
  const currMap = indexBy(currRows, keyField);

  const allKeys = new Set([...prevMap.keys(), ...currMap.keys()]);

  for (const key of allKeys) {
    const prev = prevMap.get(key);
    const curr = currMap.get(key);

    if (!prev && curr) {
      // Row added
      for (const field of Object.keys(curr)) {
        if (field === keyField) continue;
        changes.push({ table, key, field, old: undefined, new: curr[field] });
      }
    } else if (prev && !curr) {
      // Row removed
      for (const field of Object.keys(prev)) {
        if (field === keyField) continue;
        changes.push({ table, key, field, old: prev[field], new: undefined });
      }
    } else if (prev && curr) {
      // Row exists in both — check per-field
      const fields = new Set([...Object.keys(prev), ...Object.keys(curr)]);
      for (const field of fields) {
        if (field === keyField) continue;
        const oldVal = prev[field];
        const newVal = curr[field];
        if (!deepEqual(oldVal, newVal)) {
          changes.push({ table, key, field, old: oldVal, new: newVal });
        }
      }
    }
  }
}

function indexBy(rows: Record<string, unknown>[], keyField: string): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = String(row[keyField] ?? "");
    map.set(key, row);
  }
  return map;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
