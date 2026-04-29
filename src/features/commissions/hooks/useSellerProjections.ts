/**
 * features/commissions/hooks/useSellerProjections.ts
 *
 * Hook interno de orquestación, consumido por useCompensation. No tocar
 * directamente desde la UI — la UI consume useCompensation.
 *
 * Orquesta la proyección de ventas + comisiones por vendedor para un mes.
 *
 * Asimetría retail vs mayorista/utp:
 *
 *   RETAIL: el cumplimiento es a nivel TIENDA. Proyectamos la venta total de la
 *     tienda con run-rate lineal y derivamos el tramo desde ahí. La comisión
 *     proyectada del vendedor = ventaProyectadaVendedor × tramoTienda.
 *     Todos los vendedores de la misma tienda comparten cumplimiento %.
 *
 *   MAYORISTA / UTP: el cumplimiento es a nivel VENDEDOR contra su meta de
 *     `comisiones_metas_vendedor`. Si no hay meta cargada → cumplimiento y
 *     comisión quedan en null (UI muestra "Pendiente meta").
 *
 * Cobranza: 0 (c_cobrar vacía). Cuando llegue, basta con proyectarla aparte.
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import {
  fetchSellerSales,
  fetchSellerDailySales,
  fetchSellerGoals,
  type SellerGoalRow,
} from "@/queries/commissions.queries";
import { fetchStoreGoals } from "@/queries/stores.queries";
import { fetchSellerCobranza } from "@/queries/cobranza.queries";
import {
  commissionKeys,
  storeKeys,
  STALE_30MIN,
  GC_60MIN,
} from "@/queries/keys";
import {
  buildSellerProjection,
  calcDailyRunRate,
  projectMonthEnd,
  resolveMonthTime,
} from "@/domain/projections/calculations";
import {
  findTier,
  calcCumplimiento,
  calcPercentageCommission,
} from "@/domain/commissions/calculations";
import {
  aggregateCobranzaByVendedor,
  calcOverallDSO,
  canonicalSellerName,
} from "@/domain/cobranza/calculations";
import { classifySellerRole } from "@/domain/commissions/classify";
import { useCommissionScales } from "@/hooks/useConfig";
import {
  getCalendarDay,
  getCalendarMonth,
  getCalendarYear,
} from "@/domain/period/helpers";
import type {
  CommissionChannel,
  CommissionRole,
} from "@/domain/commissions/types";
import type {
  DailySalePoint,
  SellerIdentity,
  SellerProjection,
} from "@/domain/projections/types";
import type { CobranzaUnattributed } from "@/domain/cobranza/types";

export interface ProjectionSummary {
  totalVendedores: number;
  totalVentaActual: number;
  totalVentaProyectada: number;
  totalComisionActualGs: number;
  totalComisionProyectadaGs: number;
  totalCobranzaActualGs: number;
  totalComisionCobranzaActualGs: number;
  /** Días promedio de pago del scope (B2B). null si no hay cuotas válidas. */
  overallDSODias: number | null;
  /** Cobranza no atribuida a ningún vendedor con código (UNIFORMES, sin mapeo). */
  cobranzaUnattributed: CobranzaUnattributed[];
  byChannel: Record<CommissionChannel, {
    count: number;
    ventaActual: number;
    ventaProyectada: number;
    comisionProyectadaGs: number;
  }>;
}

export interface UseSellerProjectionsResult {
  projections: SellerProjection[];
  summary:     ProjectionSummary | null;
  isLoading:   boolean;
  error:       Error | null;
}

export function useSellerProjections(
  year: number,
  month: number,
): UseSellerProjectionsResult {
  const [salesQ, dailyQ, storeGoalsQ, sellerGoalsQ, cobranzaQ] = useQueries({
    queries: [
      {
        queryKey: commissionKeys.storeLevel(year * 100 + month),
        queryFn: () => fetchSellerSales(year, month),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: commissionKeys.sellerDaily(year, month),
        queryFn: () => fetchSellerDailySales(year, month),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: storeKeys.goals(year),
        queryFn: () => fetchStoreGoals(year),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: commissionKeys.sellerGoals(year, month),
        queryFn: () => fetchSellerGoals(year, month),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
      {
        queryKey: commissionKeys.cobranza(year, month),
        queryFn: () => fetchSellerCobranza(year, month),
        staleTime: STALE_30MIN,
        gcTime: GC_60MIN,
      },
    ],
  });

  const scales = useCommissionScales();

  const { projections, summary } = useMemo(() => {
    if (!salesQ.data || !dailyQ.data || !storeGoalsQ.data || !sellerGoalsQ.data) {
      return { projections: [] as SellerProjection[], summary: null };
    }
    // cobranzaQ.data puede no estar listo → seguimos sin bloquear, la cobranza
    // se incorpora cuando llegue. Eso evita que la tabla se quede vacía si
    // c_cobrar está degradada.
    const cobranzaRows = cobranzaQ.data ?? [];

    const calendarDay = getCalendarDay();
    const calendarMonth = getCalendarMonth();
    const calendarYear = getCalendarYear();

    // ── Daily por vendedor ──
    const dailyByVendor = new Map<number, DailySalePoint[]>();
    for (const r of dailyQ.data) {
      const arr = dailyByVendor.get(r.vendedorCodigo);
      const point = { day: r.día, ventaNeta: r.ventaNeta };
      if (arr) arr.push(point);
      else dailyByVendor.set(r.vendedorCodigo, [point]);
    }

    // ── Meta por tienda (uppercase, mes solicitado) ──
    const goalByStore = new Map<string, number>();
    for (const g of storeGoalsQ.data) {
      if (g.month === month) goalByStore.set(g.storeName.toUpperCase(), g.goal);
    }

    // ── Metas individuales (Mayorista/UTP) ──
    const sellerGoalMap = new Map<number, SellerGoalRow>();
    for (const sg of sellerGoalsQ.data) sellerGoalMap.set(sg.vendedorCodigo, sg);

    // ── Lookup nombre canónico → código numérico de vendedor ──
    // Construido desde sales (v_dsvende canónico) + metas (códigos sin venta).
    const nameToCodigo = new Map<string, { codigo: number; nombre: string }>();
    for (const s of salesQ.data) {
      const canonical = canonicalSellerName(s.vendedorNombre);
      if (!canonical || s.vendedorCodigo === 999 || s.vendedorCodigo === 99) continue;
      if (!nameToCodigo.has(canonical)) {
        nameToCodigo.set(canonical, { codigo: s.vendedorCodigo, nombre: s.vendedorNombre.trim() });
      }
    }
    for (const sg of sellerGoalsQ.data) {
      const canonical = canonicalSellerName(sg.vendedorNombre);
      if (!canonical) continue;
      if (!nameToCodigo.has(canonical)) {
        nameToCodigo.set(canonical, { codigo: sg.vendedorCodigo, nombre: sg.vendedorNombre.trim() });
      }
    }

    // ── Cobranza agregada por vendedor ──
    const cobranzaResult = aggregateCobranzaByVendedor(cobranzaRows, year, month, nameToCodigo);
    const cobranzaCargada = cobranzaQ.data != null;

    // ── Identidad mensual y total tienda actual + daily tienda agregado ──
    interface SellerAgg {
      identity: SellerIdentity;
      role: CommissionRole;
      channel: CommissionChannel;
      primaryStore: string;
      ventaNetaMes: number;
    }

    const sellerAggs = new Map<number, SellerAgg>();
    /** Daily acumulado por tienda (sólo retail) — para proyectar la venta tienda y derivar tramo */
    const dailyByStore = new Map<string, DailySalePoint[]>();

    for (const s of salesQ.data) {
      if (s.vendedorCodigo === 999) continue;
      const { role, channel } = classifySellerRole(s.canal, s.tipoVenta);
      const sellerGoal = sellerGoalMap.get(s.vendedorCodigo);
      const actualRole = sellerGoal?.rolComision ?? role;

      const existing = sellerAggs.get(s.vendedorCodigo);
      const primaryStore = existing?.primaryStore ?? s.sucursal.toUpperCase();

      if (existing) {
        existing.ventaNetaMes += s.ventaNeta;
      } else {
        // Para retail mostramos el código de tienda; para mayorista/UTP la
        // pseudo-sucursal del ERP ("MAYORISTA"/"UTP") no aporta — preferimos
        // la zona del vendedor cuando está cargada en metas.
        const displayLabel =
          channel === "retail"
            ? (primaryStore || null)
            : (sellerGoal?.zona ?? primaryStore ?? null);
        sellerAggs.set(s.vendedorCodigo, {
          identity: {
            vendedorCodigo: s.vendedorCodigo,
            vendedorNombre: s.vendedorNombre,
            rolComision: actualRole,
            canal: channel,
            sucursalCodigo: displayLabel,
          },
          role: actualRole,
          channel,
          primaryStore,
          ventaNetaMes: s.ventaNeta,
        });
      }
    }

    // Construir daily por tienda sumando los daily de sus vendedores retail
    for (const agg of sellerAggs.values()) {
      if (agg.channel !== "retail") continue;
      const daily = dailyByVendor.get(agg.identity.vendedorCodigo) ?? [];
      const arr = dailyByStore.get(agg.primaryStore) ?? [];
      for (const p of daily) arr.push(p);
      dailyByStore.set(agg.primaryStore, arr);
    }

    // ── Proyección por tienda (retail): cumplimiento + tramo ──
    interface StoreProjection {
      ventaActual: number;
      ventaProyectada: number;
      metaVentas: number;
      cumplimientoActualPct: number;
      cumplimientoProyectadoPct: number;
      tramoActualPct: number;       // % aplicable al cumplimiento ACTUAL
      tramoProyectadoPct: number;   // % aplicable al cumplimiento PROYECTADO
      hasMeta: boolean;
    }

    const time = resolveMonthTime(year, month, calendarDay, calendarMonth, calendarYear);
    const scaleVendedorTienda = scales["vendedor_tienda"];
    const storeProjections = new Map<string, StoreProjection>();

    for (const [store, daily] of dailyByStore) {
      let ventaActual = 0;
      for (const p of daily) {
        if (p.day >= 1 && p.day <= time.diasTranscurridos) ventaActual += p.ventaNeta;
      }
      const ritmo = calcDailyRunRate(ventaActual, time.diasTranscurridos);
      const ventaProyectada = projectMonthEnd(ventaActual, ritmo, time.diasRestantes);
      const meta = goalByStore.get(store) ?? 0;
      const hasMeta = meta > 0;
      const cumplActualPct = hasMeta ? calcCumplimiento(ventaActual, meta) : 0;
      const cumplProyPct = hasMeta ? calcCumplimiento(ventaProyectada, meta) : 0;
      const tramoActual = hasMeta ? findTier(scaleVendedorTienda.tiers, cumplActualPct).value : 0;
      const tramoProy = hasMeta ? findTier(scaleVendedorTienda.tiers, cumplProyPct).value : 0;
      storeProjections.set(store, {
        ventaActual,
        ventaProyectada,
        metaVentas: meta,
        cumplimientoActualPct: round2(cumplActualPct),
        cumplimientoProyectadoPct: round2(cumplProyPct),
        tramoActualPct: tramoActual,
        tramoProyectadoPct: tramoProy,
        hasMeta,
      });
    }

    // ── Proyecciones por vendedor ──
    const out: SellerProjection[] = [];
    const processedCodigos = new Set<number>();

    for (const agg of sellerAggs.values()) {
      const codigo = agg.identity.vendedorCodigo;
      const daily = dailyByVendor.get(codigo) ?? [];

      if (agg.channel === "retail") {
        const storeProj = storeProjections.get(agg.primaryStore);

        // Build vendedor projection sin meta (no usamos su meta individual en retail)
        const base = buildSellerProjection(
          {
            seller: agg.identity,
            daily,
            año: year,
            mes: month,
            metaVentas: null,
            // Retail no usa cobranza
            calendarDay,
            calendarMonth,
            calendarYear,
          },
          scales,
        );

        if (!storeProj || !storeProj.hasMeta) {
          out.push(base);
        } else {
          // Sobrescribir comisión y cumplimiento desde la tienda
          const comisionActualGs = calcPercentageCommission(base.ventaActual, storeProj.tramoActualPct);
          const comisionProyectadaGs = calcPercentageCommission(base.ventaProyectada, storeProj.tramoProyectadoPct);
          out.push({
            ...base,
            metaVentas: storeProj.metaVentas, // muestra meta tienda para contexto
            cumplimientoActualPct: storeProj.cumplimientoActualPct,
            cumplimientoProyectadoPct: storeProj.cumplimientoProyectadoPct,
            comisionActualGs,
            comisionProyectadaGs,
            comisionProyectadaPct: storeProj.tramoProyectadoPct,
            hasMeta: true,
          });
        }
      } else {
        // Mayorista / UTP: meta individual del vendedor
        const goal = sellerGoalMap.get(codigo);
        const cob = cobranzaResult.byCodigo.get(codigo);
        const projection = buildSellerProjection(
          {
            seller: agg.identity,
            daily,
            año: year,
            mes: month,
            metaVentas: goal?.metaVentas ?? null,
            metaCobranza: goal?.metaCobranza ?? 0,
            cobranzaActual: cobranzaCargada ? (cob?.cobranzaGs ?? 0) : undefined,
            dsoDias: cob?.dsoDias ?? null,
            calendarDay,
            calendarMonth,
            calendarYear,
          },
          scales,
        );
        out.push(projection);
      }

      processedCodigos.add(codigo);
    }

    // ── Vendedores con meta pero sin venta en el mes (alta nueva, etc.) ──
    for (const sg of sellerGoalsQ.data) {
      if (processedCodigos.has(sg.vendedorCodigo)) continue;
      const identity: SellerIdentity = {
        vendedorCodigo: sg.vendedorCodigo,
        vendedorNombre: sg.vendedorNombre,
        rolComision: sg.rolComision,
        canal: sg.canal,
        sucursalCodigo: sg.zona,
      };
      const cob = cobranzaResult.byCodigo.get(sg.vendedorCodigo);
      const projection = buildSellerProjection(
        {
          seller: identity,
          daily: [],
          año: year,
          mes: month,
          metaVentas: sg.metaVentas,
          metaCobranza: sg.metaCobranza ?? 0,
          cobranzaActual: cobranzaCargada ? (cob?.cobranzaGs ?? 0) : undefined,
          dsoDias: cob?.dsoDias ?? null,
          calendarDay,
          calendarMonth,
          calendarYear,
        },
        scales,
      );
      out.push(projection);
    }

    // Orden: comisión proyectada desc, luego venta proyectada desc
    out.sort((a, b) =>
      (b.comisionProyectadaGs ?? -1) - (a.comisionProyectadaGs ?? -1)
      || b.ventaProyectada - a.ventaProyectada
    );

    return {
      projections: out,
      summary: buildSummary(out, cobranzaResult.unattributed, calcOverallDSO(cobranzaResult)),
    };
  }, [salesQ.data, dailyQ.data, storeGoalsQ.data, sellerGoalsQ.data, cobranzaQ.data, year, month, scales]);

  return {
    projections,
    summary,
    isLoading:
      salesQ.isLoading ||
      dailyQ.isLoading ||
      storeGoalsQ.isLoading ||
      sellerGoalsQ.isLoading ||
      cobranzaQ.isLoading,
    error: (salesQ.error ??
      dailyQ.error ??
      storeGoalsQ.error ??
      sellerGoalsQ.error ??
      cobranzaQ.error) as Error | null,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildSummary(
  rows: SellerProjection[],
  cobranzaUnattributed: CobranzaUnattributed[],
  overallDSODias: number | null,
): ProjectionSummary {
  const byChannel: ProjectionSummary["byChannel"] = {
    mayorista: { count: 0, ventaActual: 0, ventaProyectada: 0, comisionProyectadaGs: 0 },
    utp:       { count: 0, ventaActual: 0, ventaProyectada: 0, comisionProyectadaGs: 0 },
    retail:    { count: 0, ventaActual: 0, ventaProyectada: 0, comisionProyectadaGs: 0 },
  };

  let totalVentaActual = 0;
  let totalVentaProyectada = 0;
  let totalComisionActual = 0;
  let totalComisionProyectada = 0;
  let totalCobranzaActual = 0;
  let totalComisionCobranzaActual = 0;

  for (const r of rows) {
    totalVentaActual += r.ventaActual;
    totalVentaProyectada += r.ventaProyectada;
    totalComisionActual += r.comisionActualGs ?? 0;
    totalComisionProyectada += r.comisionProyectadaGs ?? 0;
    totalCobranzaActual += r.cobranzaActual ?? 0;
    totalComisionCobranzaActual += r.comisionCobranzaActualGs ?? 0;
    const bc = byChannel[r.canal];
    bc.count++;
    bc.ventaActual += r.ventaActual;
    bc.ventaProyectada += r.ventaProyectada;
    bc.comisionProyectadaGs += r.comisionProyectadaGs ?? 0;
  }

  return {
    totalVendedores: rows.length,
    totalVentaActual,
    totalVentaProyectada,
    totalComisionActualGs: totalComisionActual,
    totalComisionProyectadaGs: totalComisionProyectada,
    totalCobranzaActualGs: totalCobranzaActual,
    totalComisionCobranzaActualGs: totalComisionCobranzaActual,
    overallDSODias,
    cobranzaUnattributed,
    byChannel,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
