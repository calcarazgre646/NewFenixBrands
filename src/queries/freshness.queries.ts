/**
 * queries/freshness.queries.ts
 *
 * Lee la tabla data_freshness (metadata de refresh de MVs).
 * Máximo 5 filas — sin paginación necesaria.
 */
import { dataClient } from "@/api/client";
import type { FreshnessSource, FreshnessInfo } from "@/domain/freshness/types";
import { classifyFreshness, getThresholds } from "@/domain/freshness/classify";

interface FreshnessRow {
  source_name: string;
  refreshed_at: string;
  row_count: number | null;
  status: string;
}

export async function fetchDataFreshness(): Promise<
  Map<FreshnessSource, FreshnessInfo>
> {
  const { data, error } = await dataClient
    .from("data_freshness")
    .select("source_name, refreshed_at, row_count, status");

  if (error) throw new Error(`fetchDataFreshness: ${error.message}`);

  const now = new Date();
  const map = new Map<FreshnessSource, FreshnessInfo>();

  for (const r of (data ?? []) as FreshnessRow[]) {
    const refreshedAt = new Date(r.refreshed_at);
    const source = r.source_name as FreshnessSource;
    map.set(source, {
      source,
      refreshedAt,
      rowCount: r.row_count,
      dbStatus: r.status,
      computedStatus: classifyFreshness(refreshedAt, now, getThresholds(source)),
    });
  }

  return map;
}
