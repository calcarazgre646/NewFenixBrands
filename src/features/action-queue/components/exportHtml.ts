/**
 * features/action-queue/components/exportHtml.ts
 *
 * Generates an HTML file from the action queue for Outlook/Office 365.
 * Table-based layout with inline CSS only.
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { RiskLevel, WaterfallLevel } from "@/domain/actionQueue/types";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const RISK_COLORS: Record<RiskLevel, string> = {
  critical:  "#FEE2E2",
  low:       "#FEF3C7",
  overstock: "#DBEAFE",
  balanced:  "#F3F4F6",
};

const RISK_TEXT: Record<RiskLevel, string> = {
  critical:  "Sin Stock",
  low:       "Stock Bajo",
  overstock: "Sobrestock",
  balanced:  "Balanceado",
};

const LEVEL_TEXT: Record<WaterfallLevel, string> = {
  store_to_store:   "Tienda↔Tienda",
  depot_to_store:   "Deposito→Tienda",
  central_to_depot: "Central→Deposito",
  central_to_b2b:   "Central→B2B",
};

function row(item: ActionItemFull): string {
  const bg = item.paretoFlag ? "background:#FFFBEB;" : "";
  return `<tr style="${bg}">
    <td style="padding:6px 8px;border:1px solid #E5E7EB;">${item.rank}${item.paretoFlag ? " ★" : ""}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;font-weight:bold;">${esc(item.store)}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;">${esc(item.sku)}<br><span style="font-size:10px;color:#6B7280;">${esc(item.description)}</span></td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;">${esc(item.brand)}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;"><span style="background:${RISK_COLORS[item.risk]};padding:2px 6px;border-radius:4px;font-size:10px;">${RISK_TEXT[item.risk]}</span></td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;font-size:10px;">${LEVEL_TEXT[item.waterfallLevel]}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;font-weight:bold;">${item.suggestedUnits}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;">${item.historicalAvg > 0 ? item.historicalAvg.toFixed(1) : "—"}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;font-size:10px;">${esc(item.timeRestriction)}</td>
    <td style="padding:6px 8px;border:1px solid #E5E7EB;font-size:11px;">${esc(item.recommendedAction)}</td>
  </tr>`;
}

function tableHeader(): string {
  const cols = ["#", "Tienda", "SKU / Descripcion", "Marca", "Riesgo", "Nivel", "Unidades", "Prom/Mes", "Horario", "Accion Recomendada"];
  const ths = cols.map(c => `<th style="padding:8px;border:1px solid #D1D5DB;background:#F9FAFB;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;">${c}</th>`).join("");
  return `<tr>${ths}</tr>`;
}

export function downloadActionQueueHtml(items: ActionItemFull[], mode: "b2c" | "b2b"): void {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toLocaleTimeString("es-PY");
  const paretoItems = items.filter(i => i.paretoFlag);
  const otherItems  = items.filter(i => !i.paretoFlag);
  const criticalCount  = items.filter(i => i.risk === "critical").length;
  const lowCount       = items.filter(i => i.risk === "low").length;
  const overstockCount = items.filter(i => i.risk === "overstock").length;
  const storeToStore   = items.filter(i => i.waterfallLevel === "store_to_store").length;

  const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Cola de Acciones ${mode.toUpperCase()} — ${dateStr}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;margin:0;padding:0;background:#fff;">

<!-- Header -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E8400A;color:white;">
<tr><td style="padding:20px 24px;">
  <h1 style="margin:0;font-size:20px;">Cola de Acciones — ${mode.toUpperCase()}</h1>
  <p style="margin:4px 0 0;font-size:12px;opacity:0.85;">${items.length} acciones · Generado ${dateStr} ${timeStr}</p>
</td></tr>
</table>

<!-- Summary -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBEB;border-bottom:2px solid #F59E0B;">
<tr>
  <td style="padding:12px 24px;text-align:center;"><span style="font-size:20px;font-weight:bold;color:#92400E;">${paretoItems.length}</span><br><span style="font-size:10px;color:#92400E;">Pareto 80%</span></td>
  <td style="padding:12px 24px;text-align:center;"><span style="font-size:20px;font-weight:bold;color:#DC2626;">${criticalCount}</span><br><span style="font-size:10px;color:#DC2626;">Sin Stock</span></td>
  <td style="padding:12px 24px;text-align:center;"><span style="font-size:20px;font-weight:bold;color:#D97706;">${lowCount}</span><br><span style="font-size:10px;color:#D97706;">Stock Bajo</span></td>
  <td style="padding:12px 24px;text-align:center;"><span style="font-size:20px;font-weight:bold;color:#2563EB;">${overstockCount}</span><br><span style="font-size:10px;color:#2563EB;">Sobrestock</span></td>
  <td style="padding:12px 24px;text-align:center;"><span style="font-size:20px;font-weight:bold;color:#7C3AED;">${storeToStore}</span><br><span style="font-size:10px;color:#7C3AED;">Tienda↔Tienda</span></td>
</tr>
</table>

<!-- Pareto Section -->
${paretoItems.length > 0 ? `
<div style="padding:16px 24px 8px;">
  <h2 style="font-size:14px;color:#92400E;margin:0;">&#128293; PRIORIDAD PARETO — Top ${paretoItems.length} acciones (80% del impacto)</h2>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 24px;width:calc(100% - 48px);">
  ${tableHeader()}
  ${paretoItems.map(row).join("")}
</table>` : ""}

<!-- Other Section -->
${otherItems.length > 0 ? `
<div style="padding:16px 24px 8px;">
  <h2 style="font-size:14px;color:#374151;margin:0;">Acciones Complementarias (${otherItems.length})</h2>
</div>
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 24px;width:calc(100% - 48px);">
  ${tableHeader()}
  ${otherItems.map(row).join("")}
</table>` : ""}

<!-- Footer -->
<div style="padding:20px 24px;border-top:1px solid #E5E7EB;margin-top:16px;font-size:10px;color:#9CA3AF;">
  Generado automaticamente · ${dateStr} ${timeStr}<br>
  Waterfall: Tienda↔Tienda → RETAILS→Tienda → STOCK→RETAILS · Pareto 20/80
</div>

</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cola-acciones-${mode}-${dateStr}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
