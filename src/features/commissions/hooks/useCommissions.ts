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
 *     Cada vendedor tiene su propia meta y su propio cumplimiento.
 *     Comisión = ventas × % tramo + cobranza × % tramo.
 *     PENDIENTE: metas individuales por vendedor (hoy no existen en BD).
 *     PENDIENTE: datos de cobranza (c_cobrar vacía).
 */
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchSellerSales } from "@/queries/commissions.queries";
import { fetchStoreGoals } from "@/queries/stores.queries";
import { commissionKeys, storeKeys, STALE_30MIN, GC_60MIN } from "@/queries/keys";
import { findTier, calcPercentageCommission, calcFixedCommission, buildCommissionSummary } from "@/domain/commissions/calculations";
import { useCommissionScales } from "@/hooks/useConfig";
import type {
  CommissionResult,
  CommissionSummary,
  CommissionRole,
  CommissionChannel,
} from "@/domain/commissions/types";

export interface UseCommissionsResult {
  summary:   CommissionSummary | null;
  results:   CommissionResult[];
  isLoading: boolean;
  error:     Error | null;
}

export function useCommissions(year: number, month: number): UseCommissionsResult {
  const [salesQ, goalsQ] = useQueries({
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
    ],
  });

  const scales = useCommissionScales();

  const { results, summary } = useMemo(() => {
    if (!salesQ.data || !goalsQ.data) {
      return { results: [], summary: null };
    }

    const sellerSales = salesQ.data;
    const storeGoals = goalsQ.data;

    // ── 1. Meta por tienda (uppercase) para el mes ──
    const goalByStore = new Map<string, number>();
    for (const g of storeGoals) {
      if (g.month === month) {
        goalByStore.set(g.storeName.toUpperCase(), g.goal);
      }
    }

    // ── 2. Agrupar vendedores por código ──
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

    // ── 3. Calcular comisiones ──
    const commResults: CommissionResult[] = [];

    for (const [codigo, seller] of sellerMap) {
      if (codigo === 999) continue;
      if (seller.ventaNeta <= 0) continue;

      const { role, channel } = classifySellerRole(seller.canal, seller.tipoVenta);
      const scale = scales[role];
      const primaryStore = Array.from(seller.stores)[0] ?? "";

      if (channel === "retail") {
        // ═══ RETAIL: cumplimiento a nivel TIENDA ═══
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
        // Meta individual del vendedor: PENDIENTE (no existe en BD)
        // Por ahora: meta = 0 → cumplimiento = 0 → comisión = 0
        // Cuando exista comisiones_metas_vendedor, se conecta aquí
        const metaVendedor = 0; // TODO: leer de comisiones_metas_vendedor
        const cumplimientoPct = metaVendedor > 0 ? (seller.ventaNeta / metaVendedor) * 100 : 0;
        const tier = findTier(scale.tiers, cumplimientoPct);
        const comisionVentasGs = calcPercentageCommission(seller.ventaNeta, tier.value);

        // Cobranza: PENDIENTE (c_cobrar vacía)
        const metaCobranza = 0;  // TODO: leer de comisiones_metas_vendedor
        const cobranzaReal = 0;  // TODO: leer de c_cobrar
        const cumplimientoCobranzaPct = 0;
        const comisionCobranzaPct = 0;
        const comisionCobranzaGs = 0;

        commResults.push({
          vendedorCodigo: codigo,
          vendedorNombre: seller.nombre,
          rolComision: role,
          canal: channel,
          año: year,
          mes: month,
          metaVentas: metaVendedor,
          ventaReal: seller.ventaNeta,
          cumplimientoVentasPct: Math.round(cumplimientoPct * 100) / 100,
          comisionVentasPct: tier.value,
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

    commResults.sort((a, b) => b.comisionTotalGs - a.comisionTotalGs);

    return {
      results: commResults,
      summary: buildCommissionSummary(commResults, year, month),
    };
  }, [salesQ.data, goalsQ.data, year, month, scales]);

  return {
    summary,
    results,
    isLoading: salesQ.isLoading || goalsQ.isLoading,
    error: (salesQ.error ?? goalsQ.error) as Error | null,
  };
}

/** Clasifica un vendedor en rol y canal según su canal de venta y tipo */
function classifySellerRole(canal: string, tipoVenta: string): {
  role: CommissionRole;
  channel: CommissionChannel;
} {
  if (canal === "B2B") {
    if (tipoVenta === "uniforme") return { role: "vendedor_utp", channel: "utp" };
    return { role: "vendedor_mayorista", channel: "mayorista" };
  }
  return { role: "vendedor_tienda", channel: "retail" };
}
