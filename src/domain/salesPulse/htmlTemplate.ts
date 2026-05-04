/**
 * domain/salesPulse/htmlTemplate.ts
 *
 * Render del Sales Pulse a HTML inline-styled para email.
 *
 * Voz visual: replica los tokens del dashboard NewFenixBrands
 *   - Paleta: brand #465fff, gray 50/200/600/900, success/error/warning del DS.
 *   - StatCard pattern: label uppercase tracking-widest 11px gray-400 +
 *     valor bold tabular-nums + sub-label gray-500 12px.
 *   - Cards: border 1px gray-200, rounded 16px, padding 20px, fondo blanco
 *     sobre gray-50 page.
 *   - Tipografía sistema (Inter-ish via -apple-system fallback) sin font hosting.
 *   - Layout tabular para compatibilidad Outlook + Gmail.
 *   - 100% CSS inline; sin <style> blocks; sin imágenes externas.
 *
 * Función PURA: input → string. Sin DOM, sin Resend, sin BD.
 */

import {
  classifyMomentum,
  formatDateShort,
  formatDelta,
  formatPyg,
  freshnessAge,
} from "./narrative.ts";
import type { SalesPulsePayload } from "./types.ts";

interface RenderOptions {
  /** Link a la app para el botón "Ver detalle". Default: producción Vercel. */
  appUrl?: string;
  /** Override del "now" para freshness (testing). */
  now?: Date;
}

const APP_URL_DEFAULT = "https://fenix-brands-one.vercel.app";

// ─── Design tokens (espejo de src/index.css) ────────────────────────────────
const C = {
  bgPage:        "#f9fafb",   // gray-50
  bgCard:        "#ffffff",
  bgSubtle:      "#f2f4f7",   // gray-100
  border:        "#e4e7ec",   // gray-200
  borderStrong:  "#d0d5dd",   // gray-300
  textPrimary:   "#101828",   // gray-900
  textBody:      "#344054",   // gray-700
  textMuted:     "#475467",   // gray-600
  textSubtle:    "#667085",   // gray-500
  textTiny:      "#98a2b3",   // gray-400
  brand:         "#465fff",   // brand-500
  brandHover:    "#3641f5",   // brand-600
  brand50:       "#ecf3ff",   // brand-50
  brand700:      "#2a31d8",
  successBg:     "#ecfdf3",   // success-50
  successFg:     "#027a48",   // success-700
  successBorder: "#a6f4c5",   // success-200
  errorBg:       "#fef3f2",   // error-50
  errorFg:       "#b42318",   // error-700
  errorBorder:   "#fecdca",   // error-200
  warningBg:     "#fffaeb",   // warning-50
  warningFg:     "#b54708",   // warning-700
  warningBorder: "#fedf89",   // warning-200
};

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,'Helvetica Neue',Arial,sans-serif";

// ─── Helpers presentación ───────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]!);
}
const esc = escapeHtml;

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

// ─── Atomic components ──────────────────────────────────────────────────────

/** Pequeño label uppercase tracking-widest, 11px (igual al StatCard). */
function tinyLabel(text: string, color: string = C.textTiny): string {
  return `<div style="font-family:${FONT_STACK};font-size:11px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:${color};">${esc(text)}</div>`;
}

/** Pill de delta WoW/YoY (verde/rojo/gris). */
function deltaPill(label: string, pct: number | null): string {
  if (pct === null) {
    return `<span style="display:inline-block;background:${C.bgSubtle};color:${C.textMuted};font-size:11px;font-weight:600;padding:4px 10px;border-radius:999px;margin-right:6px;">${esc(label)} —</span>`;
  }
  const positive = pct >= 0;
  const bg = positive ? C.successBg : C.errorBg;
  const fg = positive ? C.successFg : C.errorFg;
  const sign = positive ? "▲" : "▼";
  const num = positive ? `+${pct.toFixed(1)}` : pct.toFixed(1);
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;margin-right:6px;letter-spacing:0.2px;">${esc(label)} ${sign} ${num}%</span>`;
}

/** Mini-StatCard tipo dashboard: label tiny + valor grande tabular-nums + sub. */
function miniStat(label: string, value: string, sub?: string): string {
  return `<td valign="top" style="background:${C.bgCard};border:1px solid ${C.border};border-radius:14px;padding:14px 16px;width:25%;">
    ${tinyLabel(label)}
    <div style="font-family:${FONT_STACK};font-size:18px;font-weight:700;line-height:1.2;color:${C.textPrimary};margin-top:6px;font-variant-numeric:tabular-nums;">${esc(value)}</div>
    ${sub ? `<div style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};margin-top:4px;line-height:1.4;">${esc(sub)}</div>` : ""}
  </td>`;
}

/** Card section wrapper con header + slot. */
function sectionCard(headerLabel: string, headerSub: string | null, body: string): string {
  return `<tr><td style="background:${C.bgCard};border:1px solid ${C.border};border-radius:16px;padding:24px;">
    <div style="margin-bottom:18px;">
      ${tinyLabel(headerLabel)}
      ${headerSub ? `<div style="font-family:${FONT_STACK};font-size:13px;color:${C.textMuted};margin-top:4px;line-height:1.5;">${esc(headerSub)}</div>` : ""}
    </div>
    ${body}
  </td></tr>`;
}

function spacer(px: number): string {
  return `<tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr>`;
}

/** Barra de progreso (tipo Tailwind utility con tabla). */
function progressBar(pct: number): string {
  const fill = Math.max(0, Math.min(100, pct));
  const fg = fill >= 100 ? C.successFg : fill >= 70 ? C.brand : fill >= 40 ? C.warningFg : C.errorFg;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bgSubtle};border-radius:999px;height:8px;overflow:hidden;">
    <tr><td style="background:${fg};width:${fill}%;height:8px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - fill}%;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

// ─── Sub-renders ────────────────────────────────────────────────────────────

function header(p: SalesPulsePayload): string {
  return `<tr><td style="padding:0 4px 16px 4px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="vertical-align:middle;">
          <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:${C.brand};vertical-align:middle;text-align:center;line-height:28px;color:#fff;font-family:${FONT_STACK};font-weight:700;font-size:14px;">F</span>
          <span style="font-family:${FONT_STACK};font-size:15px;font-weight:700;color:${C.textPrimary};margin-left:10px;letter-spacing:-0.2px;">FenixBrands</span>
          <span style="font-family:${FONT_STACK};font-size:11px;font-weight:600;color:${C.textTiny};margin-left:8px;letter-spacing:1px;text-transform:uppercase;">· Dash IA</span>
        </td>
        <td align="right" style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};letter-spacing:0.5px;text-transform:uppercase;font-weight:600;">
          Sales Pulse · Sem ${p.isoWeek}
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function heroCard(p: SalesPulsePayload): string {
  const moment = classifyMomentum(p.sales.wowPct);
  const dateRange = `${formatDateShort(p.weekStart)} – ${formatDateShort(p.weekEnd)}`;
  return `<tr><td style="background:${C.bgCard};border:1px solid ${C.border};border-radius:16px;padding:28px 28px 24px 28px;">
    ${tinyLabel(`Semana ${p.isoWeek} · ${dateRange}`, C.brand700)}
    <div style="font-family:${FONT_STACK};font-size:34px;font-weight:800;line-height:1.1;color:${C.textPrimary};margin-top:12px;letter-spacing:-0.8px;font-variant-numeric:tabular-nums;">
      ${esc(formatPyg(p.sales.netoWeek))}
    </div>
    <div style="margin-top:14px;">
      ${deltaPill("WoW", p.sales.wowPct)}${deltaPill("YoY", p.sales.yoyPct)}
    </div>
    <div style="font-family:${FONT_STACK};font-size:13px;color:${C.textMuted};margin-top:16px;line-height:1.5;">
      La actividad <strong style="color:${C.textPrimary};">${esc(moment)}</strong> respecto a la semana anterior${
        p.sales.unitsWeek > 0
          ? ` · <strong style="color:${C.textPrimary};font-variant-numeric:tabular-nums;">${p.sales.unitsWeek.toLocaleString("es-PY")}</strong> unidades movidas`
          : ""
      }.
    </div>
  </td></tr>`;
}

function monthlyCard(p: SalesPulsePayload): string {
  const m = p.monthly;
  const pct = m.monthProgressPct ?? 0;
  const hasTarget = m.monthTarget > 0;

  const subtitle = hasTarget
    ? `${pct.toFixed(0)}% del target — proyectamos cerrar en ${formatPyg(m.runRateProjection)}${m.gapToTarget > 0 ? `, faltan ${formatPyg(m.gapToTarget)}` : ", superamos la meta"}`
    : `${formatPyg(m.monthActual)} acumulado · meta sin cargar`;

  const bar = hasTarget ? `
    <div style="margin-top:18px;">
      ${progressBar(pct)}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;">
        <tr>
          <td style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};">0</td>
          <td align="center" style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};">${pct.toFixed(0)}%</td>
          <td align="right" style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};">100%</td>
        </tr>
      </table>
    </div>` : "";

  const stats = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:separate;border-spacing:8px 0;">
      <tr>
        ${miniStat("Acumulado", formatPyg(m.monthActual), `Día ${m.daysElapsed} de ${m.daysInMonth}`)}
        ${miniStat("Meta del mes", hasTarget ? formatPyg(m.monthTarget) : "Sin cargar", hasTarget ? "Budget mensual" : "")}
        ${miniStat("Proyección", formatPyg(m.runRateProjection), "Run-rate al cierre")}
        ${miniStat("Gap a meta", hasTarget ? formatPyg(Math.max(0, m.gapToTarget)) : "—", hasTarget ? (m.gapToTarget > 0 ? "Faltan" : "Superada") : "")}
      </tr>
    </table>`;

  return sectionCard(
    `Cumplimiento de ${m.monthLabel}`,
    subtitle,
    `${bar}${stats}`,
  );
}

function moversCard(p: SalesPulsePayload): string {
  const { brands, skus, stores } = p.movers;

  const moverList = (
    items: Array<{ title: string; sub: string; tail?: string; tone?: "good" | "bad" | "neutral" }>,
  ): string => {
    if (items.length === 0) {
      return `<div style="font-family:${FONT_STACK};font-size:12px;color:${C.textTiny};padding:8px 0;">Sin movimiento</div>`;
    }
    return items.map((it, i) => {
      const tailColor = it.tone === "good" ? C.successFg : it.tone === "bad" ? C.errorFg : C.textMuted;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:${i < items.length - 1 ? 10 : 0}px;">
        <tr>
          <td valign="top" style="width:24px;font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${C.textTiny};font-variant-numeric:tabular-nums;">${i + 1}</td>
          <td valign="top">
            <div style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${C.textPrimary};line-height:1.4;">${esc(it.title)}</div>
            <div style="font-family:${FONT_STACK};font-size:11px;color:${C.textSubtle};margin-top:2px;line-height:1.4;">${esc(it.sub)}</div>
          </td>
          ${it.tail ? `<td valign="top" align="right" style="font-family:${FONT_STACK};font-size:11px;font-weight:700;color:${tailColor};white-space:nowrap;font-variant-numeric:tabular-nums;">${esc(it.tail)}</td>` : ""}
        </tr>
      </table>`;
    }).join("");
  };

  const brandItems = brands.map(b => ({
    title: b.name,
    sub: formatPyg(b.neto),
    tail: b.wowPct !== null ? formatDelta(b.wowPct) : undefined,
    tone: (b.wowPct !== null ? (b.wowPct >= 0 ? "good" : "bad") : "neutral") as "good" | "bad" | "neutral",
  }));

  const skuItems = skus.map(s => ({
    title: truncate(s.description, 40),
    sub: `${esc(s.brand)} · ${s.units.toLocaleString("es-PY")} u.`,
    tail: formatPyg(s.neto),
    tone: "neutral" as const,
  }));

  const storeItems = stores.map(st => ({
    title: st.store,
    sub: `${st.channel} · ${formatPyg(st.neto)}`,
    tail: st.wowPct !== null ? formatDelta(st.wowPct) : undefined,
    tone: (st.wowPct !== null ? (st.wowPct >= 0 ? "good" : "bad") : "neutral") as "good" | "bad" | "neutral",
  }));

  const body = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:12px 0;">
      <tr>
        <td valign="top" width="33%" style="background:${C.bgPage};border-radius:12px;padding:14px;">
          ${tinyLabel("Marcas", C.brand700)}
          <div style="margin-top:10px;">${moverList(brandItems)}</div>
        </td>
        <td valign="top" width="34%" style="background:${C.bgPage};border-radius:12px;padding:14px;">
          ${tinyLabel("SKUs", C.brand700)}
          <div style="margin-top:10px;">${moverList(skuItems)}</div>
        </td>
        <td valign="top" width="33%" style="background:${C.bgPage};border-radius:12px;padding:14px;">
          ${tinyLabel("Tiendas", C.brand700)}
          <div style="margin-top:10px;">${moverList(storeItems)}</div>
        </td>
      </tr>
    </table>`;

  return sectionCard("Top movers", "Variación semana contra semana anterior", body);
}

function alertsCard(p: SalesPulsePayload): string {
  const a = p.alerts;
  const blocks: string[] = [];

  // Novedades
  if (a.noveltyUndistributed.count > 0) {
    blocks.push(alertBlock(
      "warning",
      "Novedades sin distribuir",
      `${a.noveltyUndistributed.count} SKUs viven en depósito sin presencia en tienda`,
      a.noveltyUndistributed.examples.map(e =>
        `<strong style="color:${C.textPrimary};">${esc(truncate(e.description, 40))}</strong> · ${esc(e.brand)} · ${e.units.toLocaleString("es-PY")} u.`,
      ),
    ));
  }

  // STH bajo
  if (a.lowSellThrough30d.count > 0) {
    blocks.push(alertBlock(
      "error",
      "Sell-through bajo 30-90d",
      `${a.lowSellThrough30d.count} SKUs cohorte joven con STH < 30%`,
      a.lowSellThrough30d.examples.map(e =>
        `<strong style="color:${C.textPrimary};">${esc(truncate(e.description, 40))}</strong> · ${esc(e.brand)} · STH ${e.sthPct.toFixed(0)}% (${e.unitsReceived.toLocaleString("es-PY")} u.)`,
      ),
    ));
  }

  // DSO
  const dso = a.dso;
  if (dso.currentDays !== null) {
    const delta = dso.fourWeeksAgoDays !== null ? dso.currentDays - dso.fourWeeksAgoDays : null;
    const tone = delta === null ? "info" : delta > 5 ? "error" : delta < -5 ? "success" : "info";
    const trendCopy = delta === null
      ? "(sin base 4 semanas atrás)"
      : delta > 5
        ? `▲ +${delta} días vs hace 4 semanas`
        : delta < -5
          ? `▼ ${delta} días vs hace 4 semanas`
          : "≈ estable vs hace 4 semanas";
    blocks.push(alertBlock(
      tone,
      "Días de cobranza (DSO)",
      `${dso.currentDays} días · ${trendCopy}`,
      [`Saldo abierto al cierre: <strong style="color:${C.textPrimary};">${esc(formatPyg(dso.cxcCurrent))}</strong>`],
    ));
  }

  if (blocks.length === 0) {
    return sectionCard(
      "Alertas accionables",
      null,
      `<div style="background:${C.successBg};border:1px solid ${C.successBorder};border-radius:12px;padding:14px 16px;">
        <div style="font-family:${FONT_STACK};font-size:13px;font-weight:600;color:${C.successFg};">Sin alertas activas esta semana</div>
        <div style="font-family:${FONT_STACK};font-size:12px;color:${C.textMuted};margin-top:4px;line-height:1.5;">No hay novedades sin distribuir, sell-through bajo ni cambios bruscos de DSO detectados.</div>
      </div>`,
    );
  }

  return sectionCard("Alertas accionables", null, blocks.join(""));
}

type AlertTone = "info" | "warning" | "error" | "success";

function alertBlock(tone: AlertTone, title: string, subtitle: string, lines: string[]): string {
  const palette = {
    info:    { bg: C.brand50,    border: "#c2d6ff", fg: C.brand700 },
    warning: { bg: C.warningBg,  border: C.warningBorder, fg: C.warningFg },
    error:   { bg: C.errorBg,    border: C.errorBorder,   fg: C.errorFg },
    success: { bg: C.successBg,  border: C.successBorder, fg: C.successFg },
  }[tone];

  const list = lines.length === 0
    ? ""
    : `<ul style="margin:10px 0 0 0;padding:0 0 0 18px;list-style:disc;">${lines.map(l =>
        `<li style="font-family:${FONT_STACK};font-size:12px;color:${C.textBody};line-height:1.55;margin:3px 0;">${l}</li>`,
      ).join("")}</ul>`;

  return `<div style="background:${palette.bg};border:1px solid ${palette.border};border-radius:12px;padding:14px 16px;margin-bottom:10px;">
    <div style="font-family:${FONT_STACK};font-size:13px;font-weight:700;color:${palette.fg};letter-spacing:0.1px;">${esc(title)}</div>
    <div style="font-family:${FONT_STACK};font-size:12px;color:${C.textMuted};margin-top:3px;line-height:1.5;">${esc(subtitle)}</div>
    ${list}
  </div>`;
}

function freshnessFooter(p: SalesPulsePayload, now: Date): string {
  const fa = freshnessAge(p.freshness, now);
  const dataDate = p.freshness.maxDataDate ? formatDateShort(p.freshness.maxDataDate) : "—";
  const ageStr = !Number.isFinite(fa.hoursAgo) ? "—"
                : fa.hoursAgo < 1 ? "hace minutos"
                : fa.hoursAgo < 24 ? `hace ${Math.round(fa.hoursAgo)}h`
                : `hace ${Math.round(fa.hoursAgo / 24)}d`;
  const dotColor = fa.stale ? C.warningFg : C.successFg;
  const dotBg    = fa.stale ? C.warningBg : C.successBg;
  return `<tr><td align="center" style="padding:14px 8px 0 8px;">
    <span style="display:inline-block;background:${dotBg};border:1px solid ${dotColor};border-radius:999px;padding:5px 12px;font-family:${FONT_STACK};font-size:11px;color:${C.textMuted};font-weight:500;">
      <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${dotColor};vertical-align:middle;margin-right:6px;"></span>
      Datos hasta ${esc(dataDate)} · refrescados ${esc(ageStr)}${fa.stale ? " (stale)" : ""}
    </span>
  </td></tr>`;
}

function ctaBlock(url: string): string {
  return `<tr><td align="center" style="padding:24px 0 8px 0;">
    <a href="${esc(url)}" style="display:inline-block;background:${C.brand};color:#ffffff;text-decoration:none;font-family:${FONT_STACK};font-size:13px;font-weight:600;padding:12px 28px;border-radius:10px;letter-spacing:0.1px;">
      Ver detalle en el dashboard →
    </a>
  </td></tr>`;
}

function footer(): string {
  return `<tr><td style="padding:18px 8px 0 8px;text-align:center;">
    <div style="font-family:${FONT_STACK};font-size:11px;color:${C.textTiny};line-height:1.6;">
      Este correo lo envía Dash IA automáticamente cada lunes desde
      <span style="color:${C.textMuted};">dash@fenixbrands.com.py</span>.<br>
      Para sumar o quitar destinatarios contactá a tu administrador interno.
    </div>
  </td></tr>`;
}

// ─── Render principal ───────────────────────────────────────────────────────

export function renderSalesPulseHtml(p: SalesPulsePayload, opts: RenderOptions = {}): string {
  const appUrl = opts.appUrl ?? APP_URL_DEFAULT;
  const now    = opts.now ?? new Date();

  return [
    `<!DOCTYPE html>`,
    `<html lang="es">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<title>Sales Pulse · Semana ${p.isoWeek}</title>`,
    `</head>`,
    `<body style="margin:0;padding:0;background:${C.bgPage};font-family:${FONT_STACK};color:${C.textPrimary};-webkit-font-smoothing:antialiased;">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bgPage};">`,
    `<tr><td align="center" style="padding:32px 16px;">`,
    `<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;">`,

    header(p),
    heroCard(p),
    spacer(14),
    monthlyCard(p),
    spacer(14),
    moversCard(p),
    spacer(14),
    alertsCard(p),
    freshnessFooter(p, now),
    ctaBlock(appUrl),
    footer(),

    `</table></td></tr></table>`,
    `</body></html>`,
  ].join("");
}

// Function kept intentionally — tests + EF imports it
export { buildSubject };

function buildSubject(p: SalesPulsePayload): string {
  const wow = p.sales.wowPct;
  const tag = wow === null ? ""
            : wow >= 5    ? " · ▲"
            : wow <= -5   ? " · ▼"
            : "";
  return `Sales Pulse · Semana ${p.isoWeek} (${formatDateShort(p.weekStart)} – ${formatDateShort(p.weekEnd)})${tag}`;
}
