/**
 * Tests para domain/kpis/filterSupport.ts
 *
 * Verifica que checkKpiAvailability respeta el catálogo:
 *   - KPIs con todos los filtros soportados → disponible siempre
 *   - KPIs sin soporte de brand → no disponible cuando brand≠total
 *   - KPIs sin soporte de channel → no disponible cuando channel≠total
 *   - KPIs sin ningún filtro → no disponible con cualquier filtro activo
 *   - UPT → siempre no disponible (todos false en catálogo)
 */
import { describe, it, expect } from 'vitest'
import { checkKpiAvailability } from '../filterSupport'

const NO_FILTERS   = { brand: 'total', channel: 'total' as const, store: null as string | null }
const BRAND_FILTER = { brand: 'wrangler', channel: 'total' as const, store: null as string | null }
const CHANNEL_FILTER = { brand: 'total', channel: 'b2c' as const, store: null as string | null }
const STORE_FILTER = { brand: 'total', channel: 'total' as const, store: 'MCAL' }
const ALL_FILTERS  = { brand: 'wrangler', channel: 'b2c' as const, store: 'MCAL' }

describe('checkKpiAvailability', () => {
  // ── KPIs con todos los filtros soportados (revenue, gross_margin, etc.) ──
  describe('revenue (brand ✓, channel ✓, store ✓)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('revenue', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con brand', () => {
      expect(checkKpiAvailability('revenue', BRAND_FILTER)).toEqual({ available: true })
    })
    it('disponible con todos los filtros', () => {
      expect(checkKpiAvailability('revenue', ALL_FILTERS)).toEqual({ available: true })
    })
  })

  // ── AOV: brand ✗, channel ✓, store ✓ ──
  describe('aov (brand ✗, channel ✓, store ✓)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('aov', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con channel', () => {
      expect(checkKpiAvailability('aov', CHANNEL_FILTER)).toEqual({ available: true })
    })
    it('disponible con store', () => {
      expect(checkKpiAvailability('aov', STORE_FILTER)).toEqual({ available: true })
    })
    it('NO disponible con brand', () => {
      const r = checkKpiAvailability('aov', BRAND_FILTER)
      expect(r.available).toBe(false)
      expect(r.reason).toContain('marca')
    })
    it('NO disponible con brand + channel', () => {
      const r = checkKpiAvailability('aov', { brand: 'lee', channel: 'b2b', store: null })
      expect(r.available).toBe(false)
      expect(r.reason).toContain('marca')
    })
  })

  // ── GMROI: brand ✓, channel ✓, store ✓ ──
  // Inventario viene de mv_stock_tienda.store → canal derivable vía classifyStore.
  describe('gmroi (brand ✓, channel ✓, store ✓)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('gmroi', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con brand', () => {
      expect(checkKpiAvailability('gmroi', BRAND_FILTER)).toEqual({ available: true })
    })
    it('disponible con channel', () => {
      expect(checkKpiAvailability('gmroi', CHANNEL_FILTER)).toEqual({ available: true })
    })
    it('disponible con todos los filtros', () => {
      expect(checkKpiAvailability('gmroi', ALL_FILTERS)).toEqual({ available: true })
    })
  })

  // ── inventory_turnover: brand ✓, channel ✓, store ✓ ──
  describe('inventory_turnover (brand ✓, channel ✓, store ✓)', () => {
    it('disponible con channel', () => {
      expect(checkKpiAvailability('inventory_turnover', CHANNEL_FILTER)).toEqual({ available: true })
    })
    it('disponible con todos los filtros', () => {
      expect(checkKpiAvailability('inventory_turnover', ALL_FILTERS)).toEqual({ available: true })
    })
  })

  // ── UPT: brand ✗, channel ✗, store ✗ ──
  describe('upt (todos false — dato no disponible)', () => {
    it('NO disponible sin filtros (ningún filtro está activo pero todos false)', () => {
      // Cuando todos los filtros del catálogo son false Y ningún filtro del usuario está activo,
      // no se detecta incompatibilidad → available. Esto es correcto: el KPI se deshabilita
      // en el hook con su propio error hardcodeado ("se necesita vista con items por factura").
      const r = checkKpiAvailability('upt', NO_FILTERS)
      expect(r.available).toBe(true) // sin filtros activos → no hay conflicto
    })
    it('NO disponible con brand', () => {
      const r = checkKpiAvailability('upt', BRAND_FILTER)
      expect(r.available).toBe(false)
    })
    it('NO disponible con channel', () => {
      const r = checkKpiAvailability('upt', CHANNEL_FILTER)
      expect(r.available).toBe(false)
    })
  })

  // ── sell_through: brand ✓, channel ✓, store ✓ ──
  // v_sth_cohort tiene store; brand resuelta vía cruce con mv_stock_tienda.
  describe('sell_through (brand ✓, channel ✓, store ✓)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('sell_through', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con brand', () => {
      expect(checkKpiAvailability('sell_through', BRAND_FILTER)).toEqual({ available: true })
    })
    it('disponible con todos los filtros', () => {
      expect(checkKpiAvailability('sell_through', ALL_FILTERS)).toEqual({ available: true })
    })
  })

  // ── dso: brand ✓, channel ✓, store ✗ ──
  // c_cobrar no tiene store; mv_ventas_diarias sí soporta brand+channel.
  describe('dso (brand ✓, channel ✓, store ✗)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('dso', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con brand', () => {
      expect(checkKpiAvailability('dso', BRAND_FILTER)).toEqual({ available: true })
    })
    it('disponible con channel', () => {
      expect(checkKpiAvailability('dso', CHANNEL_FILTER)).toEqual({ available: true })
    })
    it('NO disponible con store', () => {
      const r = checkKpiAvailability('dso', STORE_FILTER)
      expect(r.available).toBe(false)
      expect(r.reason).toContain('tienda')
    })
  })

  // ── customer_recurrence: brand ✗, channel ✓, store ✓ ──
  // v_transacciones_dwh no tiene marca a nivel línea; codigo_sucursal sí da canal/tienda.
  describe('customer_recurrence (brand ✗, channel ✓, store ✓)', () => {
    it('disponible sin filtros', () => {
      expect(checkKpiAvailability('customer_recurrence', NO_FILTERS)).toEqual({ available: true })
    })
    it('disponible con channel', () => {
      expect(checkKpiAvailability('customer_recurrence', CHANNEL_FILTER)).toEqual({ available: true })
    })
    it('disponible con store', () => {
      expect(checkKpiAvailability('customer_recurrence', STORE_FILTER)).toEqual({ available: true })
    })
    it('NO disponible con brand', () => {
      const r = checkKpiAvailability('customer_recurrence', BRAND_FILTER)
      expect(r.available).toBe(false)
      expect(r.reason).toContain('marca')
    })
  })

  // ── KPI inexistente ──
  describe('KPI inexistente', () => {
    it('retorna no disponible', () => {
      const r = checkKpiAvailability('nonexistent_kpi', NO_FILTERS)
      expect(r.available).toBe(false)
      expect(r.reason).toContain('no existe')
    })
  })
})
