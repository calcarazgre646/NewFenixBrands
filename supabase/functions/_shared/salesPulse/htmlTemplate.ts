/**
 * domain/salesPulse/htmlTemplate.ts
 *
 * Render del Sales Pulse a HTML inline-styled para email.
 *
 * Decisiones de diseño:
 *   - Layout tabular (compatibilidad con Outlook + Gmail).
 *   - CSS 100% inline; no dependemos de <style>.
 *   - Tipografía sistema (no font hosting).
 *   - Ancho 640px máximo, mobile-friendly por colapso natural de tablas.
 *   - Sin imágenes externas — el "logo" es texto compuesto.
 *
 * Función PURA: input → string. Sin DOM, sin Resend, sin BD.
 */

import {
  buildHeadline,
  buildMonthlyLine,
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

const COLORS = {
  bg:        "#f4f5f7",
  card:      "#ffffff",
  border:    "#e5e7eb",
  text:      "#111827",
  muted:     "#6b7280",
  brand:     "#1d4ed8",
  good:      "#15803d",
  bad:       "#b91c1c",
  warn:      "#b45309",
  goodBg:    "#ecfdf5",
  badBg:     "#fef2f2",
  warnBg:    "#fffbeb",
};

export function renderSalesPulseHtml(p: SalesPulsePayload, opts: RenderOptions = {}): string {
  const appUrl = opts.appUrl ?? APP_URL_DEFAULT;
  const now    = opts.now ?? new Date();

  return [
    `<!DOCTYPE html>`,
    `<html lang="es">`,
    `<head><meta charset="utf-8"><title>Sales Pulse · Semana ${p.isoWeek}</title></head>`,
    `<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:${COLORS.text};">`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};">`,
    `<tr><td align="center" style="padding:24px 12px;">`,
    `<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;">`,

    headerSection(p),
    headlineCard(p),
    monthlyCard(p),
    moversCard(p),
    alertsCard(p),
    freshnessCard(p, now),
    ctaSection(appUrl, p),
    footerSection(),

    `</table></td></tr></table>`,
    `</body></html>`,
  ].join("");

  // ── Sub-rendering helpers (closure-friendly, también testeables) ─────────
  function headerSection(payload: SalesPulsePayload): string {
    return [
      `<tr><td style="padding:0 0 16px 0;">`,
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">`,
      `<tr>`,
      `<td style="font-size:14px;color:${COLORS.muted};letter-spacing:0.06em;text-transform:uppercase;">Dash IA · FenixBrands</td>`,
      `<td align="right" style="font-size:13px;color:${COLORS.muted};">Sales Pulse · Sem ${payload.isoWeek}</td>`,
      `</tr></table></td></tr>`,
    ].join("");
  }

  function headlineCard(payload: SalesPulsePayload): string {
    const headline = buildHeadline(payload);
    const moment   = classifyMomentum(payload.sales.wowPct);
    return [
      `<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;">`,
      `<div style="font-size:13px;color:${COLORS.muted};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">Pulso de la semana</div>`,
      `<div style="font-size:22px;font-weight:600;line-height:1.3;color:${COLORS.text};">${escapeHtml(headline)}</div>`,
      `<div style="font-size:14px;color:${COLORS.muted};margin-top:12px;">La actividad ${escapeHtml(moment)} respecto a la semana anterior. ${escapeHtml(unitsLine(payload))}</div>`,
      `</td></tr>`,
      spacer(12),
    ].join("");
  }

  function monthlyCard(payload: SalesPulsePayload): string {
    const m = payload.monthly;
    const pct = m.monthProgressPct ?? 0;
    const barPct = Math.max(0, Math.min(100, pct));
    return [
      `<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;">`,
      `<div style="font-size:13px;color:${COLORS.muted};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">Cumplimiento mensual</div>`,
      `<div style="font-size:16px;color:${COLORS.text};margin-bottom:12px;">${escapeHtml(buildMonthlyLine(m))}</div>`,
      m.monthTarget > 0 ? progressBar(barPct) : "",
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;font-size:13px;color:${COLORS.muted};">`,
      `<tr>`,
      `<td>Acumulado: <strong style="color:${COLORS.text};">${escapeHtml(formatPyg(m.monthActual))}</strong></td>`,
      `<td align="right">Meta: <strong style="color:${COLORS.text};">${escapeHtml(m.monthTarget > 0 ? formatPyg(m.monthTarget) : "sin cargar")}</strong></td>`,
      `</tr>`,
      `<tr><td colspan="2" style="padding-top:6px;">Día ${m.daysElapsed} de ${m.daysInMonth}</td></tr>`,
      `</table>`,
      `</td></tr>`,
      spacer(12),
    ].join("");
  }

  function moversCard(payload: SalesPulsePayload): string {
    const { brands, skus, stores } = payload.movers;
    return [
      `<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;">`,
      `<div style="font-size:13px;color:${COLORS.muted};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:12px;">Top movers</div>`,
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">`,
      `<tr>`,
      moverColumn("Marcas", brands.length === 0 ? `<div style="color:${COLORS.muted};font-size:13px;">Sin movimiento</div>` :
        brands.map((b, i) =>
          `<div style="font-size:14px;line-height:1.5;margin-bottom:6px;">
            <span style="color:${COLORS.muted};">${i + 1}.</span>
            <strong style="color:${COLORS.text};">${escapeHtml(b.name)}</strong> ·
            <span style="color:${COLORS.text};">${escapeHtml(formatPyg(b.neto))}</span>
            ${b.wowPct === null ? "" : `<span style="color:${b.wowPct >= 0 ? COLORS.good : COLORS.bad};font-size:12px;"> ${escapeHtml(formatDelta(b.wowPct))}</span>`}
          </div>`).join("")),
      moverColumn("SKUs", skus.length === 0 ? `<div style="color:${COLORS.muted};font-size:13px;">Sin movimiento</div>` :
        skus.map((s, i) =>
          `<div style="font-size:14px;line-height:1.4;margin-bottom:8px;">
            <span style="color:${COLORS.muted};">${i + 1}.</span>
            <strong style="color:${COLORS.text};">${escapeHtml(truncate(s.description, 36))}</strong>
            <span style="color:${COLORS.muted};font-size:12px;"> · ${escapeHtml(s.brand)}</span><br>
            <span style="color:${COLORS.text};font-size:13px;padding-left:14px;">${escapeHtml(formatPyg(s.neto))} · ${s.units} u.</span>
          </div>`).join("")),
      moverColumn("Tiendas", stores.length === 0 ? `<div style="color:${COLORS.muted};font-size:13px;">Sin movimiento</div>` :
        stores.map((st, i) =>
          `<div style="font-size:14px;line-height:1.5;margin-bottom:6px;">
            <span style="color:${COLORS.muted};">${i + 1}.</span>
            <strong style="color:${COLORS.text};">${escapeHtml(st.store)}</strong>
            <span style="color:${COLORS.muted};font-size:12px;"> · ${st.channel}</span><br>
            <span style="color:${COLORS.text};font-size:13px;padding-left:14px;">${escapeHtml(formatPyg(st.neto))}${st.wowPct === null ? "" : ` · <span style="color:${st.wowPct >= 0 ? COLORS.good : COLORS.bad};">${escapeHtml(formatDelta(st.wowPct))}</span>`}</span>
          </div>`).join("")),
      `</tr></table>`,
      `</td></tr>`,
      spacer(12),
    ].join("");
  }

  function alertsCard(payload: SalesPulsePayload): string {
    const a = payload.alerts;
    const blocks: string[] = [];

    // Novedades sin distribuir
    if (a.noveltyUndistributed.count > 0) {
      blocks.push(alertBlock(
        "Novedades sin distribuir",
        `${a.noveltyUndistributed.count} SKUs en depósito sin presencia en tienda`,
        COLORS.warn, COLORS.warnBg,
        a.noveltyUndistributed.examples.map(e =>
          `<li style="margin:2px 0;"><strong>${escapeHtml(truncate(e.description, 40))}</strong> · ${escapeHtml(e.brand)} · ${e.units} u. en depósito</li>`).join(""),
      ));
    }

    // STH bajo
    if (a.lowSellThrough30d.count > 0) {
      blocks.push(alertBlock(
        "Sell-through bajo (30-90 días)",
        `${a.lowSellThrough30d.count} SKUs cohorte joven con STH < 30%`,
        COLORS.bad, COLORS.badBg,
        a.lowSellThrough30d.examples.map(e =>
          `<li style="margin:2px 0;"><strong>${escapeHtml(truncate(e.description, 40))}</strong> · ${escapeHtml(e.brand)} · STH ${e.sthPct.toFixed(0)}% (${e.unitsReceived} u. recibidas)</li>`).join(""),
      ));
    }

    // DSO
    const dso = a.dso;
    if (dso.currentDays !== null) {
      const delta = dso.fourWeeksAgoDays !== null ? dso.currentDays - dso.fourWeeksAgoDays : null;
      const tone = delta !== null && delta > 5 ? "bad" : delta !== null && delta < -5 ? "good" : "neutral";
      const fg = tone === "bad" ? COLORS.bad : tone === "good" ? COLORS.good : COLORS.muted;
      const bg = tone === "bad" ? COLORS.badBg : tone === "good" ? COLORS.goodBg : COLORS.bg;
      const trendCopy = delta === null ? "(sin base 4 semanas atrás)"
                       : delta > 5 ? `▲ +${delta} días vs hace 4 semanas`
                       : delta < -5 ? `▼ ${delta} días vs hace 4 semanas`
                       : `≈ estable vs hace 4 semanas`;
      blocks.push(alertBlock(
        "Días de cobranza (DSO)",
        `${dso.currentDays} días · ${trendCopy}`,
        fg, bg,
        `<li style="margin:2px 0;color:${COLORS.muted};">Saldo abierto: ${escapeHtml(formatPyg(dso.cxcCurrent))}</li>`,
      ));
    }

    if (blocks.length === 0) {
      blocks.push(`<div style="color:${COLORS.muted};font-size:14px;">Sin alertas activas esta semana.</div>`);
    }

    return [
      `<tr><td style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;">`,
      `<div style="font-size:13px;color:${COLORS.muted};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:12px;">Alertas accionables</div>`,
      blocks.join(""),
      `</td></tr>`,
      spacer(12),
    ].join("");
  }

  function freshnessCard(payload: SalesPulsePayload, nowDate: Date): string {
    const fa = freshnessAge(payload.freshness, nowDate);
    const ageStr = !Number.isFinite(fa.hoursAgo) ? "—"
                  : fa.hoursAgo < 1 ? "hace minutos"
                  : fa.hoursAgo < 24 ? `hace ${Math.round(fa.hoursAgo)}h`
                  : `hace ${Math.round(fa.hoursAgo / 24)}d`;
    const dataDate = payload.freshness.maxDataDate ? formatDateShort(payload.freshness.maxDataDate) : "—";
    return [
      `<tr><td style="font-size:12px;color:${COLORS.muted};padding:8px 8px 0 8px;text-align:center;">`,
      `Data al ${escapeHtml(dataDate)} · refrescada ${escapeHtml(ageStr)}${fa.stale ? ` <span style="color:${COLORS.warn};">(stale)</span>` : ""}`,
      `</td></tr>`,
    ].join("");
  }

  function ctaSection(url: string, payload: SalesPulsePayload): string {
    return [
      `<tr><td align="center" style="padding:20px 0 12px 0;">`,
      `<a href="${escapeAttr(url)}" style="display:inline-block;background:${COLORS.brand};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">Ver detalle en la app →</a>`,
      `<div style="font-size:11px;color:${COLORS.muted};margin-top:8px;">Semana cerrada: ${escapeHtml(formatDateShort(payload.weekStart))} – ${escapeHtml(formatDateShort(payload.weekEnd))}</div>`,
      `</td></tr>`,
    ].join("");
  }

  function footerSection(): string {
    return [
      `<tr><td style="font-size:11px;color:${COLORS.muted};text-align:center;padding:16px 8px 0 8px;line-height:1.5;">`,
      `Este correo lo envía Dash IA automáticamente cada lunes desde dash@fenixbrands.com.py.<br>`,
      `Para sumar o quitar destinatarios contactá a tu administrador interno.`,
      `</td></tr>`,
    ].join("");
  }
}

// ─── Helpers de presentación reutilizables ──────────────────────────────────

function unitsLine(p: SalesPulsePayload): string {
  if (p.sales.unitsWeek <= 0) return "";
  return `${p.sales.unitsWeek} unidades movidas en total.`;
}

function moverColumn(title: string, body: string): string {
  return `<td valign="top" width="33%" style="padding:0 6px;">
    <div style="font-size:12px;color:${COLORS.muted};font-weight:600;letter-spacing:0.04em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(title)}</div>
    <div>${body}</div>
  </td>`;
}

function alertBlock(title: string, subtitle: string, fg: string, bg: string, listItems: string): string {
  return `<div style="background:${bg};border-left:3px solid ${fg};border-radius:6px;padding:12px 14px;margin-bottom:10px;">
    <div style="font-size:14px;font-weight:600;color:${fg};">${escapeHtml(title)}</div>
    <div style="font-size:13px;color:${COLORS.text};margin:2px 0 6px 0;">${escapeHtml(subtitle)}</div>
    ${listItems ? `<ul style="margin:4px 0 0 16px;padding:0;font-size:12px;color:${COLORS.text};">${listItems}</ul>` : ""}
  </div>`;
}

function progressBar(pct: number): string {
  const fill = Math.max(0, Math.min(100, pct));
  const fg = fill >= 90 ? COLORS.good : fill >= 60 ? COLORS.brand : COLORS.warn;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${COLORS.bg};border-radius:6px;height:10px;overflow:hidden;">
    <tr><td style="background:${fg};width:${fill}%;height:10px;font-size:0;line-height:0;">&nbsp;</td><td style="width:${100 - fill}%;font-size:0;line-height:0;">&nbsp;</td></tr>
  </table>`;
}

function spacer(px: number): string {
  return `<tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]!);
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * Subject usado por la EF al enviar. Pure así puede testearse junto con el HTML.
 */
export function buildSubject(p: SalesPulsePayload): string {
  const wow = p.sales.wowPct;
  const tag = wow === null ? ""
            : wow >= 5    ? " · ▲"
            : wow <= -5   ? " · ▼"
            : "";
  return `Sales Pulse · Semana ${p.isoWeek} (${formatDateShort(p.weekStart)} – ${formatDateShort(p.weekEnd)})${tag}`;
}
