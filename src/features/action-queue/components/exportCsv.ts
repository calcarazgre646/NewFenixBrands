/**
 * features/action-queue/components/exportCsv.ts
 *
 * CSV flat del grupo (una fila por ActionItem).
 * Separador ";" (Excel es-PY), BOM UTF-8, decimales con ".".
 * Columnas comunes — celdas vacías cuando no aplica al intent.
 */
import type { OperationalIntent } from "@/domain/actionQueue/grouping";
import type { RiskLevel } from "@/domain/actionQueue/types";
import { WEEKS_PER_MONTH } from "@/domain/config/defaults";
import type { ExportGroupOptions } from "./exportHtml";

const SEP = ";";

const RISK_LABELS: Record<RiskLevel, string> = {
  critical:  "Sin stock",
  low:       "Stock bajo",
  overstock: "Sobrestock",
  balanced:  "OK",
};

const INTENT_LABELS: Record<OperationalIntent, string> = {
  receive_transfer:     "Recibir de otra tienda",
  receive_depot:        "Recibir de depósito",
  resupply_depot:       "Abastecer depósito",
  redistribute:         "Redistribuir excedente",
  ship_b2b:             "Enviar a B2B",
  lifecycle_review:     "Revisar lifecycle",
  lifecycle_commercial: "Acción comercial",
  lifecycle_exit:       "Salida lifecycle",
  lifecycle_reposition: "Completar curva de talles",
};

const ROLE_LABELS: Record<string, string> = {
  marketing_b2c:      "Marketing B2C",
  brand_manager:      "Brand Manager",
  gerencia_retail:    "Gerencia Retail",
  operaciones_retail: "Operaciones",
  logistica:          "Logística",
};

function esc(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return digits === 0 ? String(Math.round(n)) : n.toFixed(digits);
}

export function downloadGroupCsv(options: ExportGroupOptions): void {
  const { groupLabel, channel, items, sections } = options;

  const itemSection = new Map<string, { intent: OperationalIntent; label: string }>();
  for (const section of sections) {
    for (const item of section.items) {
      itemSection.set(item.id, { intent: section.intent, label: section.label });
    }
  }

  const headers = [
    "Tienda", "Tienda Destino", "Cluster", "Sección", "Intent",
    "SKU Comercial", "SKU ERP", "Talle", "Descripción", "Marca", "Línea", "Categoría",
    "Riesgo", "Nivel Waterfall", "Tipo Acción",
    "Stock", "Prom 6m", "WOI (sem)",
    "Sugerido", "Ideal", "Gap", "DOI (días)",
    "STH (%)", "STH Prom SKU (%)", "Edad Cohorte (días)",
    "Cobertura Curva (%)", "Tallas Presentes", "Tallas Faltantes",
    "Acción Recomendada", "Roles", "Impacto (Gs.)",
  ];

  const lines: string[] = [headers.map(esc).join(SEP)];

  for (const item of items) {
    const section = itemSection.get(item.id);
    const woi = item.currentMOS * WEEKS_PER_MONTH;
    const roles = item.responsibleRoles.map(r => ROLE_LABELS[r] ?? r).join(", ");

    lines.push([
      esc(item.store),
      esc(item.targetStore ?? ""),
      esc(item.storeCluster ?? ""),
      esc(section?.label ?? ""),
      esc(section ? INTENT_LABELS[section.intent] : ""),
      esc(item.skuComercial || item.sku),
      esc(item.sku),
      esc(item.talle),
      esc(item.description),
      esc(item.brand),
      esc(item.linea),
      esc(item.categoria),
      esc(RISK_LABELS[item.risk]),
      esc(item.waterfallLevel),
      esc(item.actionType),
      esc(fmt(item.currentStock)),
      esc(fmt(item.historicalAvg, 1)),
      esc(woi > 0 ? fmt(woi, 1) : item.historicalAvg > 0 ? "0.0" : ""),
      esc(fmt(item.suggestedUnits)),
      esc(item.idealUnits > 0 ? fmt(item.idealUnits) : ""),
      esc(item.gapUnits > 0 ? fmt(item.gapUnits) : ""),
      esc(item.daysOfInventory > 0 ? fmt(item.daysOfInventory) : ""),
      esc(item.sth != null ? fmt(item.sth) : ""),
      esc(item.skuAvgSthInStore != null ? fmt(item.skuAvgSthInStore) : ""),
      esc(item.cohortAgeDays != null ? fmt(item.cohortAgeDays) : ""),
      esc(item.sizeCurveCoverage != null ? fmt(item.sizeCurveCoverage) : ""),
      esc((item.presentSizes ?? []).join("|")),
      esc((item.sourcableSizes ?? []).join("|")),
      esc(item.recommendedAction),
      esc(roles),
      esc(fmt(item.impactScore)),
    ].join(SEP));
  }

  const csv = "\ufeff" + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  const safeName = groupLabel.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  a.href = url;
  a.download = `acciones-${safeName}-${channel}-${dateStr}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
