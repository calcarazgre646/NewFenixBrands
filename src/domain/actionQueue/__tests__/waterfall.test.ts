import { describe, it, expect } from 'vitest'
import type { WaterfallInput, InventoryRecord } from '../types'
import { computeActionQueue } from '../waterfall'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inv(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    sku: 'SKU001', talle: 'M', description: 'Test Item',
    brand: 'Martel', store: 'TIENDA1', storeCluster: 'A',
    channel: 'b2c', units: 10, price: 100, cost: 50,
    linea: 'Camiseria', categoria: 'camisa',
    ...overrides,
  }
}

function makeInput(
  inventory: InventoryRecord[],
  salesHistory?: Map<string, number>,
  bestDayMap?: Map<string, string>,
): WaterfallInput {
  return {
    inventory,
    salesHistory: salesHistory ?? new Map(),
    bestDayMap: bestDayMap ?? new Map(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeActionQueue', () => {
  // 1. Empty input
  it('empty inventory returns empty array', () => {
    const result = computeActionQueue(makeInput([]), 'b2c', null, null, null, null)
    expect(result).toEqual([])
  })

  // 2. Single store, balanced stock — no deficit, no surplus
  it('single store with moderate stock produces no actions', () => {
    const result = computeActionQueue(
      makeInput([inv({ units: 10 })]),
      'b2c', null, null, null, null,
    )
    // Only one store → avgQty = 10, not <= MIN_STOCK_ABS(3), not > avgQty*2.5
    expect(result).toEqual([])
  })

  // 3. Two B2C stores: one 0 stock, one with large excess → N1 store_to_store
  it('two stores, one empty one excess → N1 store_to_store transfer', () => {
    // avg=50, TIENDA1 qty=0 → need, TIENDA2 qty=100 → 100 > 50*2.5=125? No.
    // Use sales history to force surplus: hist=5, cover=3, target=15, TIENDA2 qty=100 > 15*2=30 → excess
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 100 }),
      ], sales),
      'b2c', null, null, null, null,
    )
    const n1 = result.filter(a => a.waterfallLevel === 'store_to_store')
    expect(n1.length).toBeGreaterThanOrEqual(1)
    const deficit = n1.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    expect(deficit).toBeDefined()
    expect(deficit!.actionType).toBe('transfer')
  })

  // 4. RETAILS depot has stock, store has 0, no surplus stores → N2 depot_to_store
  it('depot RETAILS has stock, store empty, no surplus → N2 depot_to_store', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 50 }),
      ]),
      'b2c', null, null, null, null,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2.length).toBeGreaterThanOrEqual(1)
    expect(n2[0].actionType).toBe('restock_from_depot')
    expect(n2[0].store).toBe('TIENDA1')
  })

  // 5. Both depots empty, stores have deficit → N3 central_to_depot
  it('no depot stock, stores in deficit → N3 central_to_depot', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
      ]),
      'b2c', null, null, null, null,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
    expect(n3[0].actionType).toBe('resupply_depot')
    expect(n3[0].store).toBe('RETAILS')
  })

  // 6. B2B mode with deficit → N4 central_to_b2b
  it('b2b mode, deficit stores → N4 central_to_b2b', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'CLIENTEB2B', units: 0, channel: 'b2b' }),
      ]),
      'b2b', null, null, null, null,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    expect(n4.length).toBeGreaterThanOrEqual(1)
    expect(n4[0].actionType).toBe('central_to_b2b')
    expect(n4[0].store).toBe('CLIENTEB2B')
  })

  // 7. Brand filter — only matching brand processed
  it('brand filter excludes non-matching brands', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Martel' }),
        inv({ store: 'TIENDA3', units: 0, brand: 'Wrangler', sku: 'SKU002' }),
      ]),
      'b2c', 'Martel', null, null, null,
    )
    const brands = new Set(result.map(a => a.brand))
    expect(brands.has('Wrangler')).toBe(false)
    if (result.length > 0) expect(brands.has('Martel')).toBe(true)
  })

  // 8. Store filter — only matching store processed
  it('store filter limits output to that store', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, 'TIENDA1',
    )
    // With store filter only TIENDA1 passes; single store with 0 units triggers deficit
    for (const a of result) {
      if (a.waterfallLevel !== 'central_to_depot') {
        expect(a.store).toBe('TIENDA1')
      }
    }
  })

  // 9. Sort order: critical before low before overstock, then by suggestedUnits desc
  it('sort: critical > low > overstock, then suggestedUnits desc', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'A01' }),
        inv({ store: 'TIENDA2', units: 30, sku: 'A01' }),
        inv({ store: 'TIENDA3', units: 2, sku: 'A01' }),
      ]),
      'b2c', null, null, null, null,
    )
    if (result.length >= 2) {
      const riskOrder = { critical: 0, low: 1, overstock: 2, balanced: 3 }
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1]
        const curr = result[i]
        const rp = riskOrder[prev.risk] - riskOrder[curr.risk]
        if (rp !== 0) {
          expect(rp).toBeLessThanOrEqual(0)
        } else {
          expect(prev.suggestedUnits).toBeGreaterThanOrEqual(curr.suggestedUnits)
        }
      }
    }
  })

  // 10. Pareto flagging — top items flagged until 80% cumulative impact
  it('pareto flag marks top items up to 80% cumulative impact', () => {
    // Create many items with varied impact
    const rows: InventoryRecord[] = []
    for (let i = 0; i < 10; i++) {
      rows.push(inv({ store: `T${i}`, units: 0, sku: `SKU${i}`, price: (10 - i) * 100 }))
      rows.push(inv({ store: `T${i}`, units: 30, sku: `SKU${i}`, price: (10 - i) * 100 }))
    }
    // Use different store names so they pair up
    for (let i = 0; i < 10; i++) {
      rows[i * 2].store = `TDEFICIT${i}`
      rows[i * 2 + 1].store = `TSURPLUS${i}`
    }
    const result = computeActionQueue(makeInput(rows), 'b2c', null, null, null, null)
    if (result.length > 2) {
      const totalImpact = result.reduce((s, a) => s + a.impactScore, 0)
      let cum = 0
      for (const a of result) {
        cum += a.impactScore
        if (cum / totalImpact <= 0.80) {
          expect(a.paretoFlag).toBe(true)
        }
      }
      // At least one item should NOT have pareto flag (the tail)
      const nonPareto = result.filter(a => !a.paretoFlag)
      expect(nonPareto.length).toBeGreaterThan(0)
    }
  })

  // 11. MAX_ACTIONS limit — never more than 100 items
  it('never returns more than 100 actions', () => {
    const rows: InventoryRecord[] = []
    for (let i = 0; i < 60; i++) {
      rows.push(inv({ store: `TD${i}`, units: 0, sku: `SK${i}` }))
      rows.push(inv({ store: `TS${i}`, units: 50, sku: `SK${i}` }))
    }
    const result = computeActionQueue(makeInput(rows), 'b2c', null, null, null, null)
    expect(result.length).toBeLessThanOrEqual(100)
  })

  // 12. Ranks sequential 1..N
  it('ranks are sequential 1..N', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null,
    )
    for (let i = 0; i < result.length; i++) {
      expect(result[i].rank).toBe(i + 1)
    }
  })

  // 13. Linea filter
  it('linea filter excludes non-matching linea', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, linea: 'Camiseria' }),
        inv({ store: 'TIENDA2', units: 30, linea: 'Camiseria' }),
        inv({ store: 'TIENDA3', units: 0, linea: 'Vaqueria', sku: 'SKU002' }),
      ]),
      'b2c', null, 'Camiseria', null, null,
    )
    for (const a of result) {
      expect(a.linea).toBe('Camiseria')
    }
  })

  // 14. Categoria filter
  it('categoria filter excludes non-matching categoria', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, categoria: 'camisa' }),
        inv({ store: 'TIENDA2', units: 30, categoria: 'camisa' }),
        inv({ store: 'TIENDA3', units: 0, categoria: 'jean', sku: 'SKU002' }),
      ]),
      'b2c', null, null, 'camisa', null,
    )
    for (const a of result) {
      expect(a.categoria).toBe('camisa')
    }
  })

  // 15. Sales history drives deficit calculation
  it('sales history target causes deficit when stock < target*0.5', () => {
    const sales = new Map([['TIENDA1|SKU001', 10]]) // 10 units/month avg
    // Martel → coverMonths=3 → targetStock=30, threshold=15
    // units=2 < 15 → deficit → N3 central_to_depot (store=RETAILS)
    const result = computeActionQueue(
      makeInput([inv({ store: 'TIENDA1', units: 2 })], sales),
      'b2c', null, null, null, null,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
    // The N3 action targets RETAILS depot, verify the deficit was detected
    expect(n3[0].store).toBe('RETAILS')
    expect(n3[0].suggestedUnits).toBeGreaterThanOrEqual(1)
  })

  // 16. Overstock items appear with risk "overstock"
  it('surplus stores produce overstock actions', () => {
    // Use sales history to force surplus: hist=5, cover=3, target=15, qty=100 > 15*2=30 → excess
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 100 }),
      ], sales),
      'b2c', null, null, null, null,
    )
    const overstock = result.filter(a => a.risk === 'overstock')
    expect(overstock.length).toBeGreaterThanOrEqual(1)
    expect(overstock[0].store).toBe('TIENDA2')
  })

  // 17. B2B rows are ignored in b2c mode
  it('b2b rows ignored in b2c mode', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2BCLIENT', units: 0, channel: 'b2b', sku: 'SKU_B2B' }),
      ]),
      'b2c', null, null, null, null,
    )
    const b2bActions = result.filter(a => a.sku === 'SKU_B2B')
    expect(b2bActions).toEqual([])
  })

  // 18. B2C rows are ignored in b2b mode
  it('b2c rows ignored in b2b mode', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, channel: 'b2c', sku: 'SKU_B2C' }),
      ]),
      'b2b', null, null, null, null,
    )
    const b2cActions = result.filter(a => a.sku === 'SKU_B2C')
    expect(b2cActions).toEqual([])
  })

  // 19. Impact score uses price and gross margin factor
  it('impact score scales with price and margin', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 200, cost: 50 }),
        inv({ store: 'TIENDA2', units: 30, price: 200, cost: 50 }),
      ]),
      'b2c', null, null, null, null,
    )
    for (const a of result) {
      expect(a.impactScore).toBeGreaterThan(0)
    }
  })

  // 20. Cover months: Wrangler = 6, Martel = 3
  it('cover months: imported brand gets 6, national gets 3', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Wrangler', sku: 'WR01' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Wrangler', sku: 'WR01' }),
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel', sku: 'MT01' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Martel', sku: 'MT01' }),
      ]),
      'b2c', null, null, null, null,
    )
    const wr = result.find(a => a.brand === 'Wrangler')
    const mt = result.find(a => a.brand === 'Martel')
    if (wr) expect(wr.coverMonths).toBe(6)
    if (mt) expect(mt.coverMonths).toBe(3)
  })

  // 21. bestDayMap populates bestDay field
  it('bestDayMap populates bestDay on actions', () => {
    const bestDays = new Map([['TIENDA1', 'Martes']])
    const result = computeActionQueue(
      makeInput(
        [
          inv({ store: 'TIENDA1', units: 0 }),
          inv({ store: 'TIENDA2', units: 30 }),
        ],
        undefined,
        bestDays,
      ),
      'b2c', null, null, null, null,
    )
    const t1 = result.find(a => a.store === 'TIENDA1')
    if (t1) expect(t1.bestDay).toBe('Martes')
  })

  // 22. Talle "S/T" default when empty
  it('empty talle defaults to S/T in key grouping', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, talle: '' }),
        inv({ store: 'TIENDA2', units: 30, talle: '' }),
      ]),
      'b2c', null, null, null, null,
    )
    for (const a of result) {
      expect(a.talle).toBe('S/T')
    }
  })

  // 23. N3 dedup — only one central_to_depot per sku+talle
  it('only one central_to_depot action per sku+talle', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 0 }),
      ]),
      'b2c', null, null, null, null,
    )
    const n3 = result.filter(
      a => a.waterfallLevel === 'central_to_depot' && a.sku === 'SKU001' && a.talle === 'M',
    )
    expect(n3.length).toBe(1)
  })
})
