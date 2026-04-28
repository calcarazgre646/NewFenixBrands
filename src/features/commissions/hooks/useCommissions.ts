/**
 * features/commissions/hooks/useCommissions.ts
 *
 * Hook que orquesta datos reales de comisiones por VENDEDOR.
 *
 * DOS lógicas separadas:
 *
 *   RETAIL: cumplimiento = venta total TIENDA / meta TIENDA.
 *     El tramo se determina a nivel tienda, la comisión de cada vendedor
 *     = su venta individual × % del tramo.
 *
 *   MAYORISTA/UTP: cumplimiento = venta del VENDEDOR / meta del VENDEDOR.
 *     Cada vendedor tiene su propia meta (comisiones_metas_vendedor).
 *     Comisión = ventas × % tramo + cobranza × % tramo.
 *     Cobranza: pendiente (c_cobrar vacía).
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchSellerSales, fetchSellerGoals } from "@/queries/commissions.queries";
import { fetchStoreGoals } from "@/queries/stores.queries";
import { commissionKeys, storeKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { findTier, calcPercentageCommission, calcFixedCommission, buildCommissionSummary } from "@/domain/commissions/calculations";
import { classifySellerRole } from "@/domain/commissions/classify";
import { useCommissionScales } from "@/hooks/useConfig";
import type {
  CommissionResult,
  CommissionSummary,
} from "@/domain/commissions/types";

export interface UseCommissionsResult {
  summary:   CommissionSummary | null;
  results:   CommissionResult[];
  isLoading: boolean;
  error:     Error | null;
}

export function useCommissions(year: number, month: number): UseCommissionsResult {
  const [salesQ, goalsQ, sellerGoalsQ] = useQueries({
    queries: [
      {
        queryKey: commissionKeys.storeLevel(year * 100 + month),
        queryFn: () => fetchSellerSales(year, month),
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
    ],
  });

  const scales = useCommissionScales();

  const { results, summary } = useMemo(() => {
    if (!salesQ.data || !goalsQ.data || !sellerGoalsQ.data) {
      return { results: [], summary: null };
    }

    const sellerSales = salesQ.data;
    const storeGoals = goalsQ.data;
    const sellerGoals = sellerGoalsQ.data;

    // ── 1. Meta por tienda (uppercase) para el mes ──
    const goalByStore = new Map<string, number>();
    for (const g of storeGoals) {
      if (g.month === month) {
        goalByStore.set(g.storeName.toUpperCase(), g.goal);
      }
    }

    // ── 2. Metas individuales por vendedor (B2B) ──
    const sellerGoalMap = new Map<number, typeof sellerGoals[number]>();
    for (const sg of sellerGoals) {
      sellerGoalMap.set(sg.vendedorCodigo, sg);
    }

    // ── 3. Agrupar vendedores por código ──
    interface SellerAgg {
      nombre: string;
      canal: string;
      tipoVenta: string;
      stores: Set<string>;
      ventaNeta: number;
    }

    const sellerMap = new Map<number, SellerAgg>();
    const storeTotalSales = new Map<string, number>();

    for (const s of sellerSales) {
      const existing = sellerMap.get(s.vendedorCodigo);
      if (existing) {
        existing.ventaNeta += s.ventaNeta;
        existing.stores.add(s.sucursal.toUpperCase());
      } else {
        sellerMap.set(s.vendedorCodigo, {
          nombre: s.vendedorNombre,
          canal: s.canal,
          tipoVenta: s.tipoVenta,
          stores: new Set([s.sucursal.toUpperCase()]),
          ventaNeta: s.ventaNeta,
        });
      }

      // Venta total por tienda (solo para Retail)
      const storeKey = s.sucursal.toUpperCase();
      storeTotalSales.set(storeKey, (storeTotalSales.get(storeKey) ?? 0) + s.ventaNeta);
    }

    // ── 4. Calcular comisiones ──
    const commResults: CommissionResult[] = [];
    const processedCodigos = new Set<number>();

    for (const [codigo, seller] of sellerMap) {
      if (codigo === 999) continue;
      if (seller.ventaNeta <= 0) continue;

      processedCodigos.add(codigo);
      const { role, channel } = classifySellerRole(seller.canal, seller.tipoVenta);
      const primaryStore = Array.from(seller.stores)[0] ?? "";

      if (channel === "retail") {
        // ═══ RETAIL: cumplimiento a nivel TIENDA ═══
        const scale = scales[role];
        const storeMeta = goalByStore.get(primaryStore) ?? 0;
        const storeTotal = storeTotalSales.get(primaryStore) ?? 0;
        const cumplimientoPct = storeMeta > 0 ? (storeTotal / storeMeta) * 100 : 0;
        const tier = findTier(scale.tiers, cumplimientoPct);

        let comisionGs: number;
        if (scale.type === "percentage") {
          comisionGs = calcPercentageCommission(seller.ventaNeta, tier.value);
        } else {
          comisionGs = calcFixedCommission(tier.value);
        }

        commResults.push({
          vendedorCodigo: codigo,
          vendedorNombre: seller.nombre,
          rolComision: role,
          canal: channel,
          año: year,
          mes: month,
          metaVentas: storeMeta,
          ventaReal: seller.ventaNeta,
          cumplimientoVentasPct: Math.round(cumplimientoPct * 100) / 100,
          comisionVentasPct: scale.type === "percentage" ? tier.value : 0,
          comisionVentasGs: comisionGs,
          metaCobranza: 0,
          cobranzaReal: 0,
          cumplimientoCobranzaPct: 0,
          comisionCobranzaPct: 0,
          comisionCobranzaGs: 0,
          comisionTotalGs: comisionGs,
          tipoComision: scale.type,
          sucursal: primaryStore,
        });
      } else {
        // ═══ MAYORISTA / UTP: cumplimiento a nivel VENDEDOR ═══
        const sellerGoal = sellerGoalMap.get(codigo);
        const actualRole = sellerGoal?.rolComision ?? role;
        const scale = scales[actualRole];

        const metaVendedor = sellerGoal?.metaVentas ?? 0;
        const cumplimientoPct = metaVendedor > 0 ? (seller.ventaNeta / metaVendedor) * 100 : 0;
        const tier = findTier(scale.tiers, cumplimientoPct);
        const comisionVentasGs = metaVendedor > 0
          ? calcPercentageCommission(seller.ventaNeta, tier.value)
          : 0;

        // Cobranza: pendiente (c_cobrar vacía)
        const metaCobranza = sellerGoal?.metaCobranza ?? 0;
        const cobranzaReal = 0;  // TODO: leer de c_cobrar cuando tenga datos
        const cumplimientoCobranzaPct = 0;
        const comisionCobranzaPct = 0;
        const comisionCobranzaGs = 0;

        commResults.push({
          vendedorCodigo: codigo,
          vendedorNombre: seller.nombre,
          rolComision: actualRole,
          canal: channel,
          año: year,
          mes: month,
          metaVentas: metaVendedor,
          ventaReal: seller.ventaNeta,
          cumplimientoVentasPct: Math.round(cumplimientoPct * 100) / 100,
          comisionVentasPct: metaVendedor > 0 ? tier.value : 0,
          comisionVentasGs,
          metaCobranza,
          cobranzaReal,
          cumplimientoCobranzaPct,
          comisionCobranzaPct,
          comisionCobranzaGs,
          comisionTotalGs: comisionVentasGs + comisionCobranzaGs,
          tipoComision: scale.type,
          sucursal: primaryStore,
        });
      }
    }

    // ── 5. Vendedores con meta pero sin ventas (ej: mes futuro o nuevo ingreso) ──
    for (const sg of sellerGoals) {
      if (processedCodigos.has(sg.vendedorCodigo)) continue;

      const scale = scales[sg.rolComision];
      commResults.push({
        vendedorCodigo: sg.vendedorCodigo,
        vendedorNombre: sg.vendedorNombre,
        rolComision: sg.rolComision,
        canal: sg.canal,
        año: year,
        mes: month,
        metaVentas: sg.metaVentas,
        ventaReal: 0,
        cumplimientoVentasPct: 0,
        comisionVentasPct: 0,
        comisionVentasGs: 0,
        metaCobranza: sg.metaCobranza,
        cobranzaReal: 0,
        cumplimientoCobranzaPct: 0,
        comisionCobranzaPct: 0,
        comisionCobranzaGs: 0,
        comisionTotalGs: 0,
        tipoComision: scale.type,
        sucursal: sg.zona,
      });
    }

    commResults.sort((a, b) => b.comisionTotalGs - a.comisionTotalGs);

    return {
      results: commResults,
      summary: buildCommissionSummary(commResults, year, month),
    };
  }, [salesQ.data, goalsQ.data, sellerGoalsQ.data, year, month, scales]);

  return {
    summary,
    results,
    isLoading: salesQ.isLoading || goalsQ.isLoading || sellerGoalsQ.isLoading,
    error: (salesQ.error ?? goalsQ.error ?? sellerGoalsQ.error) as Error | null,
  };
}

