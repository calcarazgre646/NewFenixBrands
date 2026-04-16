/**
 * features/action-queue/components/exportHtml.ts
 *
 * Generates a styled HTML file for a single group (store or brand).
 * Structured by operational sections — mirrors the dashboard UI.
 * Designed for sharing via email/WhatsApp — self-contained, inline CSS only.
 *
 * Security: all dynamic text is HTML-escaped via esc().
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { RiskLevel } from "@/domain/actionQueue/types";
import type { ActionSection, OperationalIntent } from "@/domain/actionQueue/grouping";
import { WEEKS_PER_MONTH } from "@/domain/config/defaults";

const ROLE_LABEL_MAP: Record<string, string> = {
  marketing_b2c: "Marketing B2C",
  brand_manager: "Brand Manager",
  gerencia_retail: "Gerencia Retail",
  operaciones_retail: "Operaciones",
  logistica: "Logística",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RISK_BG: Record<RiskLevel, string> = {
  critical:  "#FEE2E2",
  low:       "#FEF3C7",
  overstock: "#DBEAFE",
  balanced:  "#F3F4F6",
};

const RISK_COLOR: Record<RiskLevel, string> = {
  critical:  "#DC2626",
  low:       "#D97706",
  overstock: "#2563EB",
  balanced:  "#6B7280",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  critical:  "Sin Stock",
  low:       "Stock Bajo",
  overstock: "Sobrestock",
  balanced:  "OK",
};

const INTENT_COLORS: Record<OperationalIntent, { border: string; bg: string; text: string }> = {
  receive_transfer: { border: "#A855F7", bg: "#FAF5FF", text: "#7E22CE" },
  receive_depot:    { border: "#06B6D4", bg: "#ECFEFF", text: "#0E7490" },
  resupply_depot:   { border: "#F97316", bg: "#FFF7ED", text: "#C2410C" },
  redistribute:     { border: "#3B82F6", bg: "#EFF6FF", text: "#1D4ED8" },
  ship_b2b:         { border: "#10B981", bg: "#ECFDF5", text: "#047857" },
  lifecycle_review:  { border: "#F59E0B", bg: "#FFFBEB", text: "#B45309" },
  lifecycle_commercial: { border: "#F43F5E", bg: "#FFF1F2", text: "#BE123C" },
  lifecycle_exit:    { border: "#EF4444", bg: "#FEF2F2", text: "#B91C1C" },
  lifecycle_reposition: { border: "#6366F1", bg: "#EEF2FF", text: "#4338CA" },
};

// ─── Row renderer ─────────────────────────────────────────────────────────────

function actionRow(item: ActionItemFull, idx: number, showStore: boolean): string {
  const stripe = idx % 2 === 0 ? "" : "background:#FAFAFA;";
  const riskBg = RISK_BG[item.risk];
  const riskColor = RISK_COLOR[item.risk];

  const coverValue = item.currentMOS * WEEKS_PER_MONTH;
  const coverLabel = "WOI";
  // Thresholds in weeks from item's coverWeeks (13 for B2C stores, 12/24 for depots/B2B)
  const lowThreshold = item.coverWeeks;           // 1× target
  const midThreshold = item.coverWeeks * 2;       // 2× target
  const mosStyle = coverValue < lowThreshold
    ? "color:#DC2626;font-weight:700;"
    : coverValue < midThreshold
    ? "color:#D97706;font-weight:600;"
    : coverValue > item.coverWeeks * 4
    ? "color:#2563EB;"
    : "";

  const counterparts = item.counterpartStores.length > 1
    ? item.counterpartStores.slice(1).map(c =>
        `<br><span style="color:#9CA3AF;font-size:10px;">+ ${esc(c.store)} (${c.units} u.)</span>`
      ).join("")
    : "";

  return `<tr style="${stripe}">
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#9CA3AF;">${idx + 1}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;">
      <span style="font-size:12px;font-weight:600;color:#111827;">${esc(item.skuComercial || item.sku)}</span>
      ${item.skuComercial ? `<span style="font-size:10px;color:#9CA3AF;margin-left:4px;">${esc(item.sku)}</span>` : ""}
      <br><span style="font-size:11px;color:#6B7280;">${esc(item.description)}</span>
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;color:#374151;">${esc(item.talle)}</td>
    ${showStore ? `<td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:12px;font-weight:500;color:#374151;">${esc(item.store)}</td>` : ""}
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;">
      <span style="display:inline-block;background:${riskBg};color:${riskColor};padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;">${RISK_LABEL[item.risk]}</span>
    </td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:14px;font-weight:700;color:#111827;text-align:center;">${item.suggestedUnits}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280;text-align:center;">${item.idealUnits > 0 ? item.idealUnits : "—"}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;${item.gapUnits > 0 ? "font-weight:700;color:#DC2626;" : "color:#9CA3AF;"}text-align:center;">${item.gapUnits > 0 ? item.gapUnits : "0"}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;${item.daysOfInventory > 180 ? "color:#DC2626;font-weight:600;" : item.daysOfInventory > 90 ? "color:#D97706;" : "color:#6B7280;"}text-align:center;">${item.daysOfInventory > 0 ? `${item.daysOfInventory.toFixed(0)}d` : "—"}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#6B7280;">${item.historicalAvg > 0 ? item.historicalAvg.toFixed(1) : "—"}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;${mosStyle}">${coverValue > 0 ? `${coverValue.toFixed(1)} ${coverLabel}` : item.historicalAvg > 0 ? `0.0 ${coverLabel}` : "—"}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #F3F4F6;font-size:11px;color:#374151;">${esc(item.recommendedAction)}${counterparts}${
      item.responsibleRoles.length > 0
        ? `<br>${item.responsibleRoles.map(r => `<span style="display:inline-block;background:#EDE9FE;color:#6D28D9;padding:1px 6px;border-radius:4px;font-size:9px;font-weight:500;margin-right:3px;">${esc(ROLE_LABEL_MAP[r] ?? r)}</span>`).join("")}`
        : ""
    }</td>
  </tr>`;
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function sectionBlock(section: ActionSection, showStore: boolean): string {
  const colors = INTENT_COLORS[section.intent];
  const cols = ["#", "Producto", "Talle"];
  if (showStore) cols.push("Tienda");
  cols.push("Estado", "Uds.", "Ideal", "Gap", "DOI", "Prom 6m", "Cobertura", "Accion");

  const headerCells = cols.map(c =>
    `<th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;border-bottom:1px solid #E5E7EB;white-space:nowrap;">${c}</th>`
  ).join("");

  const criticalBadge = section.criticalCount > 0
    ? `<span style="display:inline-block;background:#FEE2E2;color:#DC2626;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600;margin-left:8px;">${section.criticalCount} sin stock</span>`
    : "";

  return `
  <!-- Section: ${esc(section.label)} -->
  <details style="margin:16px 28px 0;">
    <summary style="border-left:4px solid ${colors.border};background:${colors.bg};padding:12px 16px;border-radius:0 8px 8px 0;cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;">
      <span style="font-size:10px;color:${colors.text};transition:transform 0.2s;">&#9654;</span>
      <span style="font-size:13px;font-weight:700;color:${colors.text};">${esc(section.label)}</span>
      <span style="font-size:11px;color:#6B7280;">${section.items.length} ${section.items.length === 1 ? "accion" : "acciones"} · ${section.totalUnits.toLocaleString("es-PY")} u.</span>
      ${criticalBadge}
    </summary>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#FFFFFF;">
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${section.items.map((item, idx) => actionRow(item, idx, showStore)).join("")}</tbody>
    </table>
  </details>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExportGroupOptions {
  groupLabel: string;
  channel: string;
  mode: "store" | "brand";
  items: ActionItemFull[];
  sections: ActionSection[];
}

export function downloadGroupHtml({ groupLabel, channel, mode, items, sections }: ExportGroupOptions): void {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });

  const critical  = items.filter(i => i.risk === "critical").length;
  const low       = items.filter(i => i.risk === "low").length;
  const overstock = items.filter(i => i.risk === "overstock").length;
  const totalUnits = items.reduce((sum, i) => sum + i.suggestedUnits, 0);
  const totalGap   = items.reduce((sum, i) => sum + i.gapUnits, 0);

  const modeLabel = mode === "store" ? "Tienda" : "Marca";
  const safeName = groupLabel.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  const showStore = mode === "brand";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(groupLabel)} — Acciones ${channel.toUpperCase()}</title>
  <style>
    details summary::-webkit-details-marker { display: none; }
    details summary::marker { display: none; content: ""; }
    details[open] summary span:first-child { display:inline-block; transform: rotate(90deg); }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#F9FAFB;color:#111827;">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#111827;">
<tr><td style="padding:24px 28px;">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">${esc(modeLabel)} · ${esc(channel.toUpperCase())}</p>
      <h1 style="margin:6px 0 0;font-size:22px;font-weight:700;color:#FFFFFF;">${esc(groupLabel)}</h1>
    </td>
    <td style="text-align:right;vertical-align:bottom;">
      <p style="margin:0;font-size:11px;color:#6B7280;">${dateStr} · ${timeStr}</p>
      <p style="margin:4px 0 0;font-size:13px;font-weight:600;color:#D1D5DB;">${items.length} acciones · ${totalUnits.toLocaleString("es-PY")} unidades</p>
    </td>
  </tr>
  </table>
</td></tr>
</table>

<!-- Stats -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-bottom:1px solid #E5E7EB;">
<tr>
  <td style="padding:14px 20px;text-align:center;border-right:1px solid #F3F4F6;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#111827;">${sections.length}</p>
    <p style="margin:2px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#6B7280;">Tareas</p>
  </td>
  <td style="padding:14px 20px;text-align:center;border-right:1px solid #F3F4F6;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#DC2626;">${critical}</p>
    <p style="margin:2px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#DC2626;">Sin Stock</p>
  </td>
  <td style="padding:14px 20px;text-align:center;border-right:1px solid #F3F4F6;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#D97706;">${low}</p>
    <p style="margin:2px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#D97706;">Stock Bajo</p>
  </td>
  <td style="padding:14px 20px;text-align:center;border-right:1px solid #F3F4F6;">
    <p style="margin:0;font-size:20px;font-weight:700;color:#2563EB;">${overstock}</p>
    <p style="margin:2px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:#2563EB;">Sobrestock</p>
  </td>
  <td style="padding:14px 20px;text-align:center;">
    <p style="margin:0;font-size:20px;font-weight:700;color:${totalGap > 0 ? "#DC2626" : "#6B7280"};">${totalGap.toLocaleString("es-PY")}</p>
    <p style="margin:2px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${totalGap > 0 ? "#DC2626" : "#6B7280"};">Gap Total</p>
  </td>
</tr>
</table>

<!-- Sections -->
${sections.map(s => sectionBlock(s, showStore)).join("")}

<!-- Footer -->
<div style="padding:20px 28px 24px;text-align:center;">
  <p style="margin:0;font-size:10px;color:#9CA3AF;">
    Generado automaticamente · Fenix Brands · Pareto 20/80 · Umbral Gs. 500K
  </p>
</div>

</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `acciones-${safeName}-${channel}-${dateStr}.html`;
  a.click();
  // Defer revoke to ensure download completes before releasing the blob URL
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
