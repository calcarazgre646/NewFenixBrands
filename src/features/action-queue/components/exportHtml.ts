/**
 * features/action-queue/components/exportHtml.ts
 *
 * Generates a styled HTML file for a single group (store, brand or priority).
 * Structured by operational sections — mirrors the dashboard UI and tokens.
 * Designed for sharing via email/WhatsApp — self-contained, inline CSS only.
 *
 * Layouts (per section intent):
 *   - movement     → receive_transfer, receive_depot, resupply_depot, redistribute, ship_b2b
 *   - lifecycle    → lifecycle_review, lifecycle_commercial, lifecycle_exit
 *   - sizeCurve    → lifecycle_reposition
 *
 * Design tokens: TailAdmin palette (mirrors src/index.css CSS variables).
 * Security: all dynamic text is HTML-escaped via esc().
 */
import type { ActionItemFull } from "@/domain/actionQueue/waterfall";
import type { RiskLevel, StoreCluster } from "@/domain/actionQueue/types";
import type { ActionSection, OperationalIntent } from "@/domain/actionQueue/grouping";
import { WEEKS_PER_MONTH } from "@/domain/config/defaults";

// ─── Design tokens (matches TailAdmin palette in src/index.css) ──────────────

const T = {
  // Grayscale
  gray900: "#101828",
  gray800: "#1d2939",
  gray700: "#344054",
  gray600: "#475467",
  gray500: "#667085",
  gray400: "#98a2b3",
  gray300: "#d0d5dd",
  gray200: "#e4e7ec",
  gray100: "#f2f4f7",
  gray50:  "#f9fafb",
  white:   "#ffffff",
  // Semantic
  error50:   "#fef3f2",
  error100:  "#fee4e2",
  error600:  "#d92d20",
  error700:  "#b42318",
  warning50: "#fffaeb",
  warning100:"#fef0c7",
  warning600:"#dc6803",
  warning700:"#b54708",
  success50: "#ecfdf3",
  success100:"#d1fadf",
  success600:"#039855",
  success700:"#027a48",
  blue50:    "#f0f9ff",
  blue100:   "#e0f2fe",
  blue600:   "#0086c9",
  blue700:   "#026aa2",
  // Brand
  brand50:   "#ecf3ff",
  brand500:  "#465fff",
  brand600:  "#3641f5",
  brand700:  "#2a31d8",
  // Purple (roles)
  purple50:  "#f4f3ff",
  purple100: "#ebe9fe",
  purple700: "#5925dc",
};

// ─── Role labels ──────────────────────────────────────────────────────────────

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

// ─── Risk / Cluster / Intent palette ──────────────────────────────────────────

const RISK_BG: Record<RiskLevel, string> = {
  critical:  T.error100,
  low:       T.warning100,
  overstock: T.blue100,
  balanced:  T.gray100,
};
const RISK_COLOR: Record<RiskLevel, string> = {
  critical:  T.error700,
  low:       T.warning700,
  overstock: T.blue700,
  balanced:  T.gray600,
};
const RISK_LABEL: Record<RiskLevel, string> = {
  critical:  "Sin Stock",
  low:       "Stock Bajo",
  overstock: "Sobrestock",
  balanced:  "OK",
};

const CLUSTER_BG: Record<StoreCluster, string> = {
  A:   T.success100,
  B:   T.gray200,
  OUT: T.error100,
};
const CLUSTER_FG: Record<StoreCluster, string> = {
  A:   T.success700,
  B:   T.gray700,
  OUT: T.error700,
};

const INTENT_COLORS: Record<OperationalIntent, { accent: string; bg: string; text: string }> = {
  receive_transfer:    { accent: "#9E77ED", bg: "#f4ebff", text: "#6941c6" },
  receive_depot:       { accent: "#06aed4", bg: T.blue50,   text: T.blue700 },
  resupply_depot:      { accent: "#f79009", bg: T.warning50, text: T.warning700 },
  redistribute:        { accent: T.brand500, bg: T.brand50,  text: T.brand700 },
  ship_b2b:            { accent: T.success600, bg: T.success50, text: T.success700 },
  lifecycle_review:    { accent: T.warning600, bg: T.warning50, text: T.warning700 },
  lifecycle_commercial:{ accent: "#f43f5e", bg: "#fff1f2",  text: "#be123c" },
  lifecycle_exit:      { accent: T.error600, bg: T.error50,  text: T.error700 },
  lifecycle_reposition:{ accent: T.brand600, bg: T.brand50,  text: T.brand700 },
};

type SectionGroup = "movement" | "lifecycle" | "sizeCurve";

const INTENT_GROUP: Record<OperationalIntent, SectionGroup> = {
  receive_transfer: "movement",
  receive_depot:    "movement",
  resupply_depot:   "movement",
  redistribute:     "movement",
  ship_b2b:         "movement",
  lifecycle_review: "lifecycle",
  lifecycle_commercial: "lifecycle",
  lifecycle_exit:   "lifecycle",
  lifecycle_reposition: "sizeCurve",
};

// ─── Contextual cell coloring ─────────────────────────────────────────────────

function mosStyle(item: ActionItemFull): string {
  const coverValue = item.currentMOS * WEEKS_PER_MONTH;
  const lowThreshold = item.coverWeeks;
  const midThreshold = item.coverWeeks * 2;
  if (coverValue === 0 && item.historicalAvg === 0) return `color:${T.gray400};`;
  if (coverValue < lowThreshold) return `color:${T.error700};font-weight:700;`;
  if (coverValue < midThreshold) return `color:${T.warning700};font-weight:600;`;
  if (coverValue > item.coverWeeks * 4) return `color:${T.blue700};`;
  return `color:${T.gray600};`;
}

function doiStyle(doi: number): string {
  if (doi <= 0) return `color:${T.gray400};`;
  if (doi > 180) return `color:${T.error700};font-weight:700;`;
  if (doi > 90) return `color:${T.warning700};font-weight:600;`;
  return `color:${T.gray600};`;
}

function sthStyle(sth: number | undefined): string {
  if (sth == null) return `color:${T.gray400};`;
  if (sth >= 70) return `color:${T.success700};font-weight:600;`;
  if (sth < 30) return `color:${T.error700};font-weight:700;`;
  return `color:${T.gray600};`;
}

function ageStyle(days: number | undefined): string {
  if (days == null) return `color:${T.gray400};`;
  if (days >= 90) return `color:${T.error700};font-weight:700;`;
  if (days >= 45) return `color:${T.warning700};font-weight:600;`;
  return `color:${T.success700};`;
}

function coverageStyle(pct: number | undefined): string {
  if (pct == null) return `color:${T.gray400};`;
  if (pct >= 100) return `color:${T.success700};font-weight:600;`;
  if (pct < 70) return `color:${T.error700};font-weight:700;`;
  return `color:${T.warning700};`;
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function td(content: string, extra = ""): string {
  return `<td style="padding:10px 14px;border-bottom:1px solid ${T.gray100};font-size:12px;color:${T.gray600};${extra}">${content}</td>`;
}

function tdCenter(content: string, extra = ""): string {
  return td(content, `text-align:center;${extra}`);
}

function productCell(item: ActionItemFull, showTalle: boolean): string {
  const maca = esc(item.skuComercial || item.sku);
  const erp = item.skuComercial && item.sku && item.skuComercial !== item.sku
    ? `<span style="font-size:10px;color:${T.gray400};margin-left:6px;font-variant-numeric:tabular-nums;">${esc(item.sku)}</span>`
    : "";
  const talle = showTalle && item.talle
    ? `<span style="font-size:11px;color:${T.gray500};margin-left:6px;">· ${esc(item.talle)}</span>`
    : "";
  return `<td style="padding:10px 14px;border-bottom:1px solid ${T.gray100};">
    <span style="font-size:13px;font-weight:600;color:${T.gray900};">${maca}</span>${erp}${talle}
    <br><span style="font-size:11px;color:${T.gray500};">${esc(item.description)}</span>
    <span style="font-size:10px;color:${T.gray400};margin-left:4px;">· ${esc(item.brand)}</span>
  </td>`;
}

function storeCell(item: ActionItemFull): string {
  const clusterBadge = item.storeCluster
    ? `<span style="display:inline-block;background:${CLUSTER_BG[item.storeCluster]};color:${CLUSTER_FG[item.storeCluster]};padding:2px 6px;border-radius:9999px;font-size:9px;font-weight:700;margin-left:6px;letter-spacing:0.3px;">${item.storeCluster}</span>`
    : "";
  const target = item.targetStore
    ? `<br><span style="font-size:10px;color:${T.gray400};">→ ${esc(item.targetStore)}</span>`
    : "";
  return `<td style="padding:10px 14px;border-bottom:1px solid ${T.gray100};font-size:12px;font-weight:500;color:${T.gray700};">${esc(item.store)}${clusterBadge}${target}</td>`;
}

function riskCell(risk: RiskLevel): string {
  return `<td style="padding:10px 14px;border-bottom:1px solid ${T.gray100};">
    <span style="display:inline-block;background:${RISK_BG[risk]};color:${RISK_COLOR[risk]};padding:3px 10px;border-radius:9999px;font-size:10px;font-weight:600;">${RISK_LABEL[risk]}</span>
  </td>`;
}

function actionCell(item: ActionItemFull): string {
  const counterparts = item.counterpartStores.length > 1
    ? item.counterpartStores.slice(1).map(c =>
        `<br><span style="color:${T.gray400};font-size:10px;">+ ${esc(c.store)} (${c.units} u.)</span>`
      ).join("")
    : "";
  const roles = item.responsibleRoles.length > 0
    ? `<br>${item.responsibleRoles.map(r => `<span style="display:inline-block;background:${T.purple100};color:${T.purple700};padding:2px 8px;border-radius:9999px;font-size:9px;font-weight:500;margin-right:4px;margin-top:4px;">${esc(ROLE_LABEL_MAP[r] ?? r)}</span>`).join("")}`
    : "";
  return `<td style="padding:10px 14px;border-bottom:1px solid ${T.gray100};font-size:11px;color:${T.gray700};">${esc(item.recommendedAction)}${counterparts}${roles}</td>`;
}

// ─── Row renderers per section group ─────────────────────────────────────────

function movementRow(item: ActionItemFull, idx: number, showStore: boolean): string {
  const stripe = idx % 2 === 0 ? "" : `background:${T.gray50};`;
  const coverValue = item.currentMOS * WEEKS_PER_MONTH;
  return `<tr style="${stripe}">
    ${td(String(idx + 1), `color:${T.gray400};`)}
    ${productCell(item, true)}
    ${showStore ? storeCell(item) : ""}
    ${riskCell(item.risk)}
    ${tdCenter(String(item.currentStock), `font-size:13px;font-weight:600;color:${T.gray900};`)}
    ${tdCenter(String(item.suggestedUnits), `font-size:14px;font-weight:700;color:${T.gray900};`)}
    ${tdCenter(item.idealUnits > 0 ? String(item.idealUnits) : "—")}
    ${tdCenter(item.gapUnits > 0 ? String(item.gapUnits) : "0", item.gapUnits > 0 ? `font-weight:700;color:${T.error700};` : `color:${T.gray400};`)}
    ${tdCenter(item.daysOfInventory > 0 ? `${item.daysOfInventory.toFixed(0)}d` : "—", doiStyle(item.daysOfInventory))}
    ${tdCenter(item.historicalAvg > 0 ? item.historicalAvg.toFixed(1) : "—")}
    ${tdCenter(coverValue > 0 ? `${coverValue.toFixed(1)}` : item.historicalAvg > 0 ? "0.0" : "—", mosStyle(item))}
    ${actionCell(item)}
  </tr>`;
}

function lifecycleRow(item: ActionItemFull, idx: number, showStore: boolean): string {
  const stripe = idx % 2 === 0 ? "" : `background:${T.gray50};`;
  return `<tr style="${stripe}">
    ${td(String(idx + 1), `color:${T.gray400};`)}
    ${productCell(item, true)}
    ${showStore ? storeCell(item) : ""}
    ${riskCell(item.risk)}
    ${tdCenter(String(item.currentStock), `font-size:13px;font-weight:600;color:${T.gray900};`)}
    ${tdCenter(item.sth != null ? `${item.sth.toFixed(0)}%` : "—", sthStyle(item.sth))}
    ${tdCenter(item.skuAvgSthInStore != null ? `${item.skuAvgSthInStore.toFixed(0)}%` : "—", `color:${T.gray500};`)}
    ${tdCenter(item.cohortAgeDays != null ? `${item.cohortAgeDays}d` : "—", ageStyle(item.cohortAgeDays))}
    ${tdCenter(item.historicalAvg > 0 ? item.historicalAvg.toFixed(1) : "—")}
    ${actionCell(item)}
  </tr>`;
}

function sizeCurveRow(item: ActionItemFull, idx: number, showStore: boolean): string {
  const stripe = idx % 2 === 0 ? "" : `background:${T.gray50};`;
  const coveragePct = item.sizeCurveCoverage;
  const present = item.presentSizes && item.presentSizes.length > 0
    ? item.presentSizes.map(s => esc(s)).join(" · ")
    : "—";
  const missing = item.sourcableSizes && item.sourcableSizes.length > 0
    ? item.sourcableSizes.map(s => `<span style="color:${T.error700};font-weight:600;">${esc(s)}</span>`).join(" · ")
    : "—";
  return `<tr style="${stripe}">
    ${td(String(idx + 1), `color:${T.gray400};`)}
    ${productCell(item, false)}
    ${showStore ? storeCell(item) : ""}
    ${riskCell(item.risk)}
    ${tdCenter(String(item.currentStock), `font-size:13px;font-weight:600;color:${T.gray900};`)}
    ${tdCenter(coveragePct != null ? `${coveragePct.toFixed(0)}%` : "—", coverageStyle(coveragePct))}
    ${td(present, `font-size:11px;color:${T.success700};`)}
    ${td(missing, "font-size:11px;")}
    ${actionCell(item)}
  </tr>`;
}

// ─── Column definitions per group ─────────────────────────────────────────────

function columnsForGroup(group: SectionGroup, showStore: boolean): string[] {
  const base = ["#", "Producto"];
  const storeCol = showStore ? ["Tienda"] : [];
  if (group === "movement") {
    return [...base, ...storeCol, "Estado", "Stock", "Sugerido", "Ideal", "Gap", "DOI", "Prom 6m", "WOI", "Acción"];
  }
  if (group === "lifecycle") {
    return [...base, ...storeCol, "Estado", "Stock", "STH talle", "SKU prom.", "Edad", "Prom 6m", "Acción"];
  }
  // sizeCurve
  return [...base, ...storeCol, "Estado", "Stock", "Cobertura", "Presentes", "Faltantes (red)", "Acción"];
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function sectionBlock(section: ActionSection, showStore: boolean): string {
  const colors = INTENT_COLORS[section.intent];
  const group = INTENT_GROUP[section.intent];
  const cols = columnsForGroup(group, showStore);

  const headerCells = cols.map(c =>
    `<th style="padding:10px 14px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${T.gray500};border-bottom:1px solid ${T.gray200};white-space:nowrap;background:${T.gray50};">${c}</th>`
  ).join("");

  const renderRow = group === "movement" ? movementRow
    : group === "lifecycle" ? lifecycleRow
    : sizeCurveRow;

  const criticalBadge = section.criticalCount > 0
    ? `<span style="display:inline-block;background:${T.error100};color:${T.error700};padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;margin-left:8px;">${section.criticalCount} sin stock</span>`
    : "";

  const gapBadge = section.totalGapUnits > 0
    ? `<span style="display:inline-block;background:${T.error50};color:${T.error700};padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600;margin-left:6px;">gap ${section.totalGapUnits.toLocaleString("es-PY")} u.</span>`
    : "";

  return `
  <!-- Section: ${esc(section.label)} -->
  <div style="margin:16px 24px 0;">
    <details open style="background:${T.white};border:1px solid ${T.gray200};border-left:4px solid ${colors.accent};border-radius:16px;overflow:hidden;">
      <summary style="padding:16px 20px;cursor:pointer;list-style:none;display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:${colors.bg};">
        <span style="font-size:10px;color:${colors.text};transition:transform 0.2s;">&#9654;</span>
        <span style="font-size:14px;font-weight:700;color:${colors.text};">${esc(section.label)}</span>
        <span style="font-size:11px;color:${T.gray500};">${section.items.length} ${section.items.length === 1 ? "accion" : "acciones"} · ${section.totalUnits.toLocaleString("es-PY")} u.</span>
        ${criticalBadge}
        ${gapBadge}
      </summary>
      <div style="overflow-x:auto;">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${T.white};min-width:640px;">
          <thead><tr>${headerCells}</tr></thead>
          <tbody>${section.items.map((item, idx) => renderRow(item, idx, showStore)).join("")}</tbody>
        </table>
      </div>
    </details>
  </div>`;
}

// ─── Stats card renderer ─────────────────────────────────────────────────────

function statCell(value: string, label: string, color: string, borderRight: boolean): string {
  const border = borderRight ? `border-right:1px solid ${T.gray100};` : "";
  return `<td style="padding:18px 20px;text-align:center;${border}">
    <p style="margin:0;font-size:22px;font-weight:700;color:${color};line-height:1.1;letter-spacing:-0.5px;">${value}</p>
    <p style="margin:6px 0 0;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:${color};">${label}</p>
  </td>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ExportGroupOptions {
  groupLabel: string;
  channel: string;
  mode: "store" | "brand" | "priority";
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

  const modeLabel = mode === "store" ? "Tienda" : mode === "brand" ? "Marca" : "Prioridad";
  const safeName = groupLabel.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  // showStore: items in a group belong to multiple stores (brand + priority modes)
  const showStore = mode !== "store";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(groupLabel)} — Acciones ${channel.toUpperCase()}</title>
  <style>
    * { box-sizing: border-box; }
    details summary::-webkit-details-marker { display: none; }
    details summary::marker { display: none; content: ""; }
    details[open] > summary > span:first-child { display:inline-block; transform: rotate(90deg); }
    @media print {
      body { background: ${T.white} !important; }
      details { page-break-inside: avoid; break-inside: avoid; }
      details > summary { background: ${T.gray100} !important; }
    }
  </style>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;margin:0;padding:0;background:${T.gray50};color:${T.gray900};-webkit-font-smoothing:antialiased;">

<!-- Header -->
<div style="background:${T.gray900};padding:28px 32px;">
  <table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td>
      <p style="margin:0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;color:${T.gray400};">${esc(modeLabel)} · ${esc(channel.toUpperCase())}</p>
      <h1 style="margin:8px 0 0;font-size:26px;font-weight:700;color:${T.white};letter-spacing:-0.5px;">${esc(groupLabel)}</h1>
    </td>
    <td style="text-align:right;vertical-align:bottom;">
      <p style="margin:0;font-size:11px;color:${T.gray400};">${dateStr} · ${timeStr}</p>
      <p style="margin:6px 0 0;font-size:13px;font-weight:600;color:${T.gray300};">${items.length} acciones · ${totalUnits.toLocaleString("es-PY")} unidades</p>
    </td>
  </tr>
  </table>
</div>

<!-- Stats card -->
<div style="padding:20px 24px 0;">
  <div style="background:${T.white};border:1px solid ${T.gray200};border-radius:16px;overflow:hidden;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      ${statCell(String(sections.length), "Tareas", T.gray900, true)}
      ${statCell(String(critical), "Sin Stock", T.error700, true)}
      ${statCell(String(low), "Stock Bajo", T.warning700, true)}
      ${statCell(String(overstock), "Sobrestock", T.blue700, true)}
      ${statCell(totalGap.toLocaleString("es-PY"), "Gap Total", totalGap > 0 ? T.error700 : T.gray500, false)}
    </tr>
    </table>
  </div>
</div>

<!-- Sections -->
${sections.map(s => sectionBlock(s, showStore)).join("")}

<!-- Legend -->
<div style="margin:24px 24px 0;">
  <div style="background:${T.white};border:1px solid ${T.gray200};border-radius:16px;padding:18px 22px;">
    <p style="margin:0 0 12px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${T.gray500};">Leyenda</p>
    <div style="display:flex;flex-wrap:wrap;gap:18px 22px;font-size:11px;color:${T.gray600};line-height:1.6;">
      <div>
        <span style="font-weight:600;color:${T.gray700};">Cluster:</span>
        <span style="display:inline-block;background:${CLUSTER_BG.A};color:${CLUSTER_FG.A};padding:2px 6px;border-radius:9999px;font-size:9px;font-weight:700;margin:0 4px;">A</span>Premium ·
        <span style="display:inline-block;background:${CLUSTER_BG.B};color:${CLUSTER_FG.B};padding:2px 6px;border-radius:9999px;font-size:9px;font-weight:700;margin:0 4px;">B</span>Standard ·
        <span style="display:inline-block;background:${CLUSTER_BG.OUT};color:${CLUSTER_FG.OUT};padding:2px 6px;border-radius:9999px;font-size:9px;font-weight:700;margin:0 4px;">OUT</span>Outlet
      </div>
      <div>
        <span style="font-weight:600;color:${T.gray700};">Código:</span>
        <span style="font-weight:600;color:${T.gray900};">Comercial</span>
        <span style="color:${T.gray400};font-variant-numeric:tabular-nums;margin-left:4px;">ERP</span>
      </div>
      <div>
        <span style="font-weight:600;color:${T.gray700};">STH talle:</span>
        <span style="color:${T.success700};font-weight:600;">≥70%</span> · 30-69% ·
        <span style="color:${T.error700};font-weight:700;">&lt;30%</span>
      </div>
      <div>
        <span style="font-weight:600;color:${T.gray700};">Edad cohorte:</span>
        <span style="color:${T.success700};">0-44d</span> ·
        <span style="color:${T.warning700};font-weight:600;">45-89d</span> ·
        <span style="color:${T.error700};font-weight:700;">90d+</span>
      </div>
      <div>
        <span style="font-weight:600;color:${T.gray700};">DOI:</span>
        ≤90d ·
        <span style="color:${T.warning700};font-weight:600;">91-180d</span> ·
        <span style="color:${T.error700};font-weight:700;">&gt;180d</span>
      </div>
      <div>
        <span style="font-weight:600;color:${T.gray700};">WOI:</span>
        semanas cobertura ·
        <span style="color:${T.error700};font-weight:700;">&lt;objetivo</span> ·
        <span style="color:${T.blue700};">&gt;4× objetivo</span>
      </div>
    </div>
  </div>
</div>

<!-- Footer -->
<div style="padding:24px 32px 28px;text-align:center;">
  <p style="margin:0;font-size:10px;color:${T.gray400};">
    Generado automáticamente · Fenix Brands · Priorizado por urgencia operativa
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
