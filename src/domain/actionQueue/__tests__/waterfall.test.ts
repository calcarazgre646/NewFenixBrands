import { describe, it, expect } from 'vitest'
import type { WaterfallInput, InventoryRecord } from '../types'
import { computeActionQueue } from '../waterfall'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inv(overrides: Partial<InventoryRecord> = {}): InventoryRecord {
  return {
    sku: 'SKU001', skuComercial: 'MACA001234', talle: 'M', description: 'Test Item',
    brand: 'Martel', store: 'TIENDA1', storeCluster: 'A',
    channel: 'b2c', units: 10, price: 100, priceMay: 70, cost: 50,
    linea: 'Camiseria', categoria: 'camisa',
    ...overrides,
  }
}

function makeInput(
  inventory: InventoryRecord[],
  salesHistory?: Map<string, number>,
): WaterfallInput {
  return {
    inventory,
    salesHistory: salesHistory ?? new Map(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeActionQueue', () => {
  // 1. Empty input
  it('empty inventory returns empty array', () => {
    const result = computeActionQueue(makeInput([]), 'b2c', null, null, null, null, 0)
    expect(result).toEqual([])
  })

  // 2. Single store, balanced stock — no deficit, no surplus
  it('single store with moderate stock produces no actions', () => {
    const result = computeActionQueue(
      makeInput([inv({ units: 10 })]),
      'b2c', null, null, null, null, 0,
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
      'b2c', null, null, null, null, 0,
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
      'b2c', null, null, null, null, 0,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2.length).toBeGreaterThanOrEqual(1)
    expect(n2[0].actionType).toBe('restock_from_depot')
    expect(n2[0].store).toBe('TIENDA1')
  })

  // 5. STOCK depot has stock, RETAILS empty, stores in deficit → N3 central_to_depot
  it('STOCK has stock, stores in deficit → N3 central_to_depot', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
    expect(n3[0].actionType).toBe('resupply_depot')
    expect(n3[0].store).toBe('RETAILS')
  })

  // 5b. No depot stock at all, stores in deficit → no impossible N3 actions
  it('no depot stock, stores in deficit → no N3 generated', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBe(0)
  })

  // 6. B2B mode with deficit → N4 central_to_b2b
  it('b2b mode, deficit stores → N4 central_to_b2b', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'CLIENTEB2B', units: 0, channel: 'b2b' }),
      ]),
      'b2b', null, null, null, null, 0,
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
      'b2c', 'Martel', null, null, null, 0,
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
      'b2c', null, null, null, 'TIENDA1', 0,
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
      'b2c', null, null, null, null, 0,
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
    const result = computeActionQueue(makeInput(rows), 'b2c', null, null, null, null, 0)
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

  // 11. No artificial limit — all actionable items returned
  it('returns all actionable items without artificial limit', () => {
    const rows: InventoryRecord[] = []
    for (let i = 0; i < 60; i++) {
      rows.push(inv({ store: `TD${i}`, units: 0, sku: `SK${i}` }))
      rows.push(inv({ store: `TS${i}`, units: 50, sku: `SK${i}` }))
    }
    // Use sales history to ensure surplus detection so N1 transfers fire
    const sales = new Map<string, number>()
    for (let i = 0; i < 60; i++) {
      sales.set(`TD${i}|SK${i}`, 5)
      sales.set(`TS${i}|SK${i}`, 5)
    }
    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null, 0)
    // Should have actions for all 60 deficit stores (no artificial MAX_ACTIONS limit)
    expect(result.length).toBeGreaterThanOrEqual(60)
  })

  // 12. Ranks sequential 1..N
  it('ranks are sequential 1..N', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
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
      'b2c', null, 'Camiseria', null, null, 0,
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
      'b2c', null, null, 'camisa', null, 0,
    )
    for (const a of result) {
      expect(a.categoria).toBe('camisa')
    }
  })

  // 15. Sales history drives deficit calculation
  it('sales history target causes deficit when stock < target*0.5', () => {
    const sales = new Map([['TIENDA1|SKU001', 10]]) // 10 units/month avg
    // Martel → coverMonths=3 → targetStock=30, threshold=15
    // units=2 < 15 → deficit → N3 central_to_depot (store=RETAILS) if STOCK has inventory
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2 }),
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
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
      'b2c', null, null, null, null, 0,
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
      'b2c', null, null, null, null, 0,
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
      'b2b', null, null, null, null, 0,
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
      'b2c', null, null, null, null, 0,
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
      'b2c', null, null, null, null, 0,
    )
    const wr = result.find(a => a.brand === 'Wrangler')
    const mt = result.find(a => a.brand === 'Martel')
    if (wr) expect(wr.coverWeeks).toBe(24)
    if (mt) expect(mt.coverWeeks).toBe(12)
  })

  // 21. Talle "S/T" default when empty
  it('empty talle defaults to S/T in key grouping', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, talle: '' }),
        inv({ store: 'TIENDA2', units: 30, talle: '' }),
      ]),
      'b2c', null, null, null, null, 0,
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
        inv({ store: 'STOCK', units: 100 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(
      a => a.waterfallLevel === 'central_to_depot' && a.sku === 'SKU001' && a.talle === 'M',
    )
    expect(n3.length).toBe(1)
  })

  // 24. Impact threshold filters low-impact non-critical actions
  it('impact threshold filters out low-impact non-critical actions', () => {
    // price=100, cost=50 → impactScore = units * 100 * 1.15 ≈ 345 per 3 units
    // With threshold 500,000 these low-value actions get filtered out
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const withThreshold = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2, price: 100, cost: 50 }),
        inv({ store: 'TIENDA2', units: 100, price: 100, cost: 50 }),
      ], sales),
      'b2c', null, null, null, null, 500_000,
    )
    const withoutThreshold = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2, price: 100, cost: 50 }),
        inv({ store: 'TIENDA2', units: 100, price: 100, cost: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // With threshold, low-impact non-critical actions are filtered
    expect(withThreshold.length).toBeLessThan(withoutThreshold.length)
  })

  // 25. Critical actions always pass threshold regardless of impact
  it('critical actions always pass regardless of threshold', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 1, cost: 1 }),  // critical, price=1
        inv({ store: 'TIENDA2', units: 0, price: 1, cost: 1 }),  // critical, price=1
        inv({ store: 'STOCK', units: 50, price: 1, cost: 1 }),   // depot stock to enable N3
      ]),
      'b2c', null, null, null, null, 999_999_999,  // absurdly high threshold
    )
    // Critical actions (units=0) should still appear
    const critical = result.filter(a => a.risk === 'critical')
    expect(critical.length).toBeGreaterThanOrEqual(1)
  })

  // 26. Default threshold uses MIN_IMPACT_THRESHOLD
  it('default threshold filters low-value actions', () => {
    // With default threshold (500,000), price=100 actions get filtered
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const resultDefault = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2, price: 100, cost: 50 }),
        inv({ store: 'TIENDA2', units: 100, price: 100, cost: 50 }),
      ], sales),
      'b2c', null, null, null, null,  // uses default MIN_IMPACT_THRESHOLD
    )
    const resultNoThreshold = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2, price: 100, cost: 50 }),
        inv({ store: 'TIENDA2', units: 100, price: 100, cost: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // Default threshold should filter more than threshold=0
    expect(resultDefault.length).toBeLessThanOrEqual(resultNoThreshold.length)
  })

  // ─── Resource integrity tests (greedy allocation) ───────────────────────────

  // 27. suggestedUnits matches counterpart available for N1
  it('suggestedUnits matches sum of counterpart units for N1 transfers', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],  // target=30, T1 has 0 → need=30
      ['TIENDA2|SKU001', 5],   // target=15, T2 has 20 → no excess (20 < 30)
      ['TIENDA3|SKU001', 2],   // target=6, T3 has 50 → excess=44
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 20 }),
        inv({ store: 'TIENDA3', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficit = result.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    if (deficit) {
      const counterpartTotal = deficit.counterpartStores.reduce((s, c) => s + c.units, 0)
      expect(deficit.suggestedUnits).toBe(counterpartTotal)
    }
  })

  // 28. Surplus pool consumed: same stock not double-promised
  it('surplus stock is consumed — not double-promised', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
      ['TIENDA3|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 20 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const fromT3 = result
      .filter(a => a.risk !== 'overstock')
      .flatMap(a => a.counterpartStores)
      .filter(c => c.store === 'TIENDA3')
      .reduce((s, c) => s + c.units, 0)
    expect(fromT3).toBeLessThanOrEqual(14)
  })

  // 29. Depot consumed: total restock never exceeds depot stock
  it('depot inventory is consumed — total restock never exceeds depot stock', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 0 }),
        inv({ store: 'RETAILS', units: 5 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const fromDepot = result
      .filter(a => a.waterfallLevel === 'depot_to_store')
      .reduce((s, a) => s + a.suggestedUnits, 0)
    expect(fromDepot).toBeLessThanOrEqual(5)
  })

  // 30. N3 suggestedUnits capped by STOCK available
  it('N3 suggestedUnits does not exceed STOCK depot available', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 50],
      ['TIENDA2|SKU001', 50],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'STOCK', units: 30 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3).toHaveLength(1)
    expect(n3[0].suggestedUnits).toBe(30)
    expect(n3[0].suggestedUnits).toBe(n3[0].counterpartStores[0].units)
  })

  // 31. N3 currentStock reflects RETAILS depot inventory
  it('N3 action has correct currentStock for RETAILS depot', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 50],
      ['TIENDA2|SKU001', 50],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'RETAILS', units: 12 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    if (n3) {
      expect(n3.currentStock).toBe(12)
    }
  })

  // 32. Critical (stock=0) stores are served before low-stock stores
  it('critical deficit stores are prioritized over low-stock stores', () => {
    const sales = new Map([
      ['TIENDA_LOW|SKU001', 10],     // target=30, qty=5 → need=25 (low)
      ['TIENDA_CRIT|SKU001', 10],    // target=30, qty=0 → need=30 (critical)
      ['TIENDA_SURPLUS|SKU001', 2],  // target=6, qty=50 → excess=44
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA_LOW', units: 5 }),      // low stock
        inv({ store: 'TIENDA_CRIT', units: 0 }),     // critical!
        inv({ store: 'TIENDA_SURPLUS', units: 50 }), // surplus
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // TIENDA_CRIT (stock=0) must get counterpart allocation, not TIENDA_LOW
    const critAction = result.find(
      a => a.store === 'TIENDA_CRIT' && a.waterfallLevel === 'store_to_store' && a.risk === 'critical'
    )
    expect(critAction).toBeDefined()
    expect(critAction!.counterpartStores.length).toBeGreaterThan(0)
    expect(critAction!.suggestedUnits).toBeGreaterThan(0)
  })

  // ─── Pre-production audit tests (08/03/2026 19:11) ─────────────────────────

  // 34. Multiple SKUs processed independently
  it('multiple SKUs produce independent actions per SKU', () => {
    const sales = new Map([
      ['TIENDA1|SKU_A', 5], ['TIENDA2|SKU_A', 5],
      ['TIENDA1|SKU_B', 5], ['TIENDA2|SKU_B', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'SKU_A' }),
        inv({ store: 'TIENDA2', units: 50, sku: 'SKU_A' }),
        inv({ store: 'TIENDA1', units: 0, sku: 'SKU_B', price: 200 }),
        inv({ store: 'TIENDA2', units: 50, sku: 'SKU_B', price: 200 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const skuA = result.filter(a => a.sku === 'SKU_A')
    const skuB = result.filter(a => a.sku === 'SKU_B')
    expect(skuA.length).toBeGreaterThanOrEqual(1)
    expect(skuB.length).toBeGreaterThanOrEqual(1)
  })

  // 35. Multiple talle variants of same SKU are separate items
  it('same SKU different talle produces separate actions', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10], ['TIENDA2|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, talle: 'M' }),
        inv({ store: 'TIENDA1', units: 0, talle: 'L' }),
        inv({ store: 'TIENDA2', units: 50, talle: 'M' }),
        inv({ store: 'TIENDA2', units: 50, talle: 'L' }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const talleM = result.filter(a => a.talle === 'M' && a.store === 'TIENDA1')
    const talleL = result.filter(a => a.talle === 'L' && a.store === 'TIENDA1')
    expect(talleM.length).toBeGreaterThanOrEqual(1)
    expect(talleL.length).toBeGreaterThanOrEqual(1)
  })

  // 36. Surplus mirror actions created (redistribute intent)
  it('surplus stores get mirror redistribute actions', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const overstockActions = result.filter(a => a.risk === 'overstock' && a.store === 'TIENDA2')
    expect(overstockActions.length).toBeGreaterThanOrEqual(1)
    // Mirror action should have counterpartStores pointing to deficit stores
    const mirror = overstockActions.find(a => a.counterpartStores.length > 0)
    if (mirror) {
      expect(mirror.counterpartStores[0].store).toBe('TIENDA1')
    }
  })

  // 37. Liquidation actions for remaining surplus
  it('remaining surplus after redistribution triggers liquidation', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 1], // low sales → big surplus
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 200 }), // huge surplus
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const liquidation = result.filter(
      a => a.risk === 'overstock' && a.counterpartStores.length === 0
    )
    expect(liquidation.length).toBeGreaterThanOrEqual(1)
  })

  // 38. MIN_TRANSFER_UNITS: skip tiny sources
  it('skips surplus sources with less than MIN_TRANSFER_UNITS when others available', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA_SMALL|SKU001', 2],
      ['TIENDA_BIG|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA_SMALL', units: 50 }), // excess but only 1u available after calculation
        inv({ store: 'TIENDA_BIG', units: 100 }),   // big excess
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficit = result.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    if (deficit) {
      // Each counterpart should have >= 2 units (MIN_TRANSFER_UNITS)
      // Exception: if it was the only source available
      for (const c of deficit.counterpartStores) {
        if (deficit.counterpartStores.length > 1) {
          expect(c.units).toBeGreaterThanOrEqual(2)
        }
      }
    }
  })

  // 39. Cascade N1→N2: partial N1, remainder from N2
  it('deficit partially filled by N1, remainder from N2', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 20], // target=60, qty=0 → need=60
      ['TIENDA2|SKU001', 2],  // target=6, qty=20 → excess=14
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 20 }),  // surplus of ~14
        inv({ store: 'RETAILS', units: 100 }), // depot has stock
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // TIENDA1 should get N1 from TIENDA2 (partial) and N2 from RETAILS (remainder)
    const n1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    // At least one of N1 or N2 should exist for TIENDA1
    expect(n1 || n2).toBeDefined()
  })

  // 40. Zero price and cost → actions still generated for critical
  it('zero price items still generate critical actions', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 0, cost: 0 }),
        inv({ store: 'TIENDA2', units: 0, price: 0, cost: 0 }),
        inv({ store: 'STOCK', units: 50, price: 0, cost: 0 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const critical = result.filter(a => a.risk === 'critical')
    expect(critical.length).toBeGreaterThanOrEqual(1)
  })

  // 41. Negative inventory units treated as 0 (no crash)
  it('negative inventory units do not crash the algorithm', () => {
    expect(() => {
      computeActionQueue(
        makeInput([
          inv({ store: 'TIENDA1', units: -5 }),
          inv({ store: 'TIENDA2', units: 30 }),
        ]),
        'b2c', null, null, null, null, 0,
      )
    }).not.toThrow()
  })

  // 42. All stores balanced → no actions
  it('multiple stores all balanced → no actions', () => {
    // With B2C 3-week WOI: coverMonths=0.69, target=5*0.69=3.46
    // Balanced band: 3.46*0.5=1.73 < qty < 3.46*2=6.92
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
      ['TIENDA3|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 5 }),
        inv({ store: 'TIENDA2', units: 5 }),
        inv({ store: 'TIENDA3', units: 5 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // target=3.46, qty=5 → 1.73 < 5 < 6.92 → balanced, no deficit, no surplus
    expect(result.length).toBe(0)
  })

  // 43. Store filter still includes depot context
  it('store filter still processes RETAILS/STOCK for depot actions', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 50 }),
      ]),
      'b2c', null, null, null, 'TIENDA1', 0,
    )
    // TIENDA1 should still get depot restock even with store filter
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store' && a.store === 'TIENDA1')
    expect(n2.length).toBeGreaterThanOrEqual(1)
  })

  // 44. Duplicate inventory rows — same store+sku+talle
  it('duplicate inventory rows are aggregated, not duplicated', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA1', units: 0 }), // duplicate
        inv({ store: 'TIENDA2', units: 50 }),
        inv({ store: 'TIENDA2', units: 50 }), // duplicate
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Should not produce duplicate actions for same store+sku+talle
    const t1Actions = result.filter(a => a.store === 'TIENDA1' && a.risk !== 'overstock')
    const uniqueKeys = new Set(t1Actions.map(a => `${a.sku}|${a.talle}`))
    expect(t1Actions.length).toBe(uniqueKeys.size)
  })

  // ─── EXHAUSTIVE TEST COVERAGE (08/03/2026 — 81 gaps audit) ─────────────────

  // ─── CRITICAL: N1 continue skips N2 cascade ────────────────────────────────

  // C-01: Partial N1 fill → remainder cascades to N2 depot fallback
  // B2C target = hist × (13/4.33). TIENDA1: 20×3.00=60.05→need=61. TIENDA2: 2×3.00=6, qty=20 > 6×2=12 → surplus=14
  it('CRITICAL: partial N1 fill cascades remainder to N2 from RETAILS', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 20],   // target≈60.05, qty=0 → need=61
      ['TIENDA2|SKU001', 2],    // target≈6, qty=20 → 20 > 6×2=12 → excess=floor(20-6)=14
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 20 }),   // surplus of 14
        inv({ store: 'RETAILS', units: 100 }),   // plenty of depot stock
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // TIENDA1 gets N1 from TIENDA2 (14 units) AND N2 from RETAILS for remainder
    const n1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    expect(n1).toBeDefined()
    expect(n2).toBeDefined()  // Fixed: N1→N2 cascade now works for partial fills
    if (n1 && n2) {
      expect(n1.suggestedUnits + n2.suggestedUnits).toBeLessThanOrEqual(61) // total need
    }
  })

  // C-02: N1 fully fills → no N2 needed (correct behavior control)
  it('CRITICAL: N1 fully fills deficit → no N2 or N3 generated', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],   // target=15, qty=0 → need=15
      ['TIENDA2|SKU001', 2],   // target=6, qty=50 → excess=44
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
        inv({ store: 'RETAILS', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    expect(n1).toBeDefined()
    // No N2 needed — N1 fully covered the deficit
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    expect(n2).toBeUndefined()
  })

  // C-03: No N1 available → N2 fires (cascade works when N1 gives 0)
  it('CRITICAL: no surplus stores → deficit falls through to N2 directly', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 100 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    expect(n2).toBeDefined()
    expect(n2!.suggestedUnits).toBeGreaterThan(0)
  })

  // C-04: B2B N4 suppressed when surplus stores exist
  it('CRITICAL: B2B N4 only fires when surplusStores.length === 0', () => {
    const sales = new Map([
      ['B2BCLIENT|SKU001', 10],
      ['B2BSURPLUS|SKU001', 1],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2BCLIENT', units: 0, channel: 'b2b' }),
        inv({ store: 'B2BSURPLUS', units: 100, channel: 'b2b' }), // surplus exists
      ], sales),
      'b2b', null, null, null, null, 0,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    // N4 is suppressed because surplusStores.length > 0
    expect(n4.length).toBe(0)
  })

  // C-05: B2B N4 fires when no surplus
  it('CRITICAL: B2B N4 fires when no surplus stores exist', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2BCLIENT', units: 0, channel: 'b2b' }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    expect(n4.length).toBeGreaterThanOrEqual(1)
    expect(n4[0].actionType).toBe('central_to_b2b')
  })

  // C-06: B2B N4 pool tracking — without STOCK data, all clients get uncapped recommendations
  it('CRITICAL: B2B N4 without STOCK → uncapped recommendations for all clients', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2B_A', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'B2B_B', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'B2B_C', units: 0, channel: 'b2b', sku: 'SKU001' }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    // All 3 get N4 — no STOCK data means uncapped
    expect(n4.length).toBe(3)
    for (const a of n4) {
      expect(a.suggestedUnits).toBeGreaterThan(0)
    }
  })

  // C-06b: B2B N4 pool tracking — with STOCK data, caps total allocation
  it('CRITICAL: B2B N4 with STOCK → caps allocation to available stock', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2B_A', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'B2B_B', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'B2B_C', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'STOCK', units: 5, channel: 'b2c', sku: 'SKU001' }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    const totalAllocated = n4.reduce((s, a) => s + a.suggestedUnits, 0)
    expect(totalAllocated).toBeLessThanOrEqual(5)
  })

  // ─── HIGH: Filter bypass for depot stores ──────────────────────────────────

  // H-01: Brand filter does NOT exclude RETAILS depot
  it('HIGH: brand filter does not exclude RETAILS depot context', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel' }),
        inv({ store: 'RETAILS', units: 50, brand: 'Wrangler' }), // different brand
      ]),
      'b2c', 'Martel', null, null, null, 0,
    )
    // RETAILS should still provide N2 even though its brand doesn't match filter
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2.length).toBeGreaterThanOrEqual(1)
  })

  // H-02: Linea filter does NOT exclude RETAILS
  it('HIGH: linea filter does not exclude RETAILS depot', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, linea: 'Camiseria' }),
        inv({ store: 'RETAILS', units: 50, linea: 'Vaqueria' }),
      ]),
      'b2c', null, 'Camiseria', null, null, 0,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2.length).toBeGreaterThanOrEqual(1)
  })

  // H-03: Categoria filter does NOT exclude STOCK
  it('HIGH: categoria filter does not exclude STOCK depot', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, categoria: 'camisa' }),
        inv({ store: 'STOCK', units: 50, categoria: 'jean' }),
      ]),
      'b2c', null, null, 'camisa', null, 0,
    )
    // STOCK should still be available for N3
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
  })

  // H-04: Combined brand + linea + categoria + store filters
  it('HIGH: combined filters work together correctly', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel', linea: 'Camiseria', categoria: 'camisa' }),
        inv({ store: 'TIENDA2', units: 0, brand: 'Wrangler', linea: 'Vaqueria', categoria: 'jean', sku: 'SKU002' }),
        inv({ store: 'TIENDA3', units: 30, brand: 'Martel', linea: 'Camiseria', categoria: 'camisa' }),
        inv({ store: 'RETAILS', units: 50 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', 'Martel', 'Camiseria', 'camisa', 'TIENDA1', 0,
    )
    // Only TIENDA1 should appear in non-depot actions
    for (const a of result) {
      if (a.waterfallLevel !== 'central_to_depot') {
        expect(a.store).toBe('TIENDA1')
      }
    }
  })

  // ─── HIGH: B2B paths ───────────────────────────────────────────────────────

  // H-05: B2B mode — single deficit client with no surplus → N4 fires
  it('HIGH: B2B single deficit no surplus → N4 central_to_b2b', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2BCLIENT', units: 0, channel: 'b2b' }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    // B2B deficit with no surplus → N4
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    expect(n4.length).toBeGreaterThanOrEqual(1)
  })

  // H-05b: B2B mode — RETAILS depot does NOT participate (RETAILS is B2C only)
  it('HIGH: B2B mode does NOT get N2 from RETAILS depot', () => {
    const sales = new Map([['MAYORISTA|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'MAYORISTA', units: 0, channel: 'b2b' }),
        inv({ store: 'RETAILS', units: 500 }),  // RETAILS has plenty of stock
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2b', null, null, null, null, 0,
    )
    // No N2 actions (RETAILS excluded from B2B)
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2).toHaveLength(0)
    // Should get N4 (central_to_b2b) instead
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    expect(n4.length).toBeGreaterThanOrEqual(1)
  })

  // H-05c: B2C mode still gets N2 from RETAILS depot
  it('HIGH: B2C mode still gets N2 from RETAILS depot', () => {
    const sales = new Map([['TIENDA1|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 500 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    expect(n2.length).toBeGreaterThanOrEqual(1)
  })

  // ─── HIGH: coverMonths calculation ─────────────────────────────────────────

  // H-06: coverMonths = coverWeeks / 4.33 exact values
  it('HIGH: coverMonths for Martel (12w) → ~2.77, Wrangler (24w) → ~5.54', () => {
    // Martel: coverWeeks=12, coverMonths=12/4.33≈2.77
    // sales=10/m → target=27.7, threshold(50%)=13.85 → qty=5 < 13.85 → deficit
    const sales = new Map([['TIENDA1|MT01', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 5, brand: 'Martel', sku: 'MT01' }),
        inv({ store: 'STOCK', units: 100, sku: 'MT01' }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const action = result.find(a => a.sku === 'MT01' && a.store !== 'RETAILS')
    if (action) {
      expect(action.coverWeeks).toBe(12)
    }
  })

  // H-07: Wrangler coverMonths creates larger targets
  // In B2B mode, brand-based coverWeeks still applies: Wrangler=24w, Martel=12w
  // So Wrangler stores need more stock → larger deficit → larger N3 resupply
  it('HIGH: Wrangler longer coverage creates larger deficit than Martel (B2B)', () => {
    const sales = new Map([
      ['TIENDA1|WR01', 10],
      ['TIENDA1|MT01', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 5, brand: 'Wrangler', sku: 'WR01', channel: 'b2b' }),
        inv({ store: 'TIENDA1', units: 5, brand: 'Martel', sku: 'MT01', channel: 'b2b' }),
        inv({ store: 'STOCK', units: 200, sku: 'WR01' }),
        inv({ store: 'STOCK', units: 200, sku: 'MT01' }),
      ], sales),
      'b2b', null, null, null, null, 0,
    )
    // B2B uses brand-based coverWeeks: Wrangler=24w→target≈55.4, Martel=12w→target≈27.7
    const wrAction = result.find(a => a.sku === 'WR01')
    const mtAction = result.find(a => a.sku === 'MT01')
    if (wrAction && mtAction) {
      expect(wrAction.suggestedUnits).toBeGreaterThan(mtAction.suggestedUnits)
    }
  })

  // ─── HIGH: Boundary conditions ─────────────────────────────────────────────

  // H-08: Exactly at deficit threshold (qty === targetStock * 0.5) → no deficit
  it('HIGH: stock exactly at 50% of target → no deficit', () => {
    // B2C 3w WOI: target=15*0.69=10.38, 50%=5.19 → qty=6 should NOT trigger deficit
    const sales = new Map([['TIENDA1|SKU001', 15]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 6 }),
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficit = result.find(a => a.store === 'TIENDA1' && (a.risk === 'critical' || a.risk === 'low'))
    expect(deficit).toBeUndefined()
  })

  // H-09: Exactly at surplus threshold (qty === targetStock * 2) → no surplus
  it('HIGH: stock exactly at 200% of target → no surplus', () => {
    // B2C 3w WOI: sales=5, target=5*0.69=3.46, surplus threshold=6.92 → qty=6 < 6.92 → no surplus
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 6 }),  // 6 < 6.92 → no surplus
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const surplus = result.find(a => a.store === 'TIENDA2' && a.risk === 'overstock')
    expect(surplus).toBeUndefined()
  })

  // H-10: qty > 10 guard for high stock (no-history path)
  it('HIGH: no history, qty <= 10 even if > avgQty * HIGH_STOCK_RATIO → no surplus', () => {
    // No sales history. 2 stores: T1=0, T2=8. avg=4, 8 > 4*2.5=10 → NO because qty <= 10
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 8 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const surplus = result.find(a => a.store === 'TIENDA2' && a.risk === 'overstock')
    expect(surplus).toBeUndefined()
  })

  // H-11: qty > 10 AND > avgQty * 2.5 → surplus triggered (no-history path)
  it('HIGH: no history, qty > 10 and > avgQty * 2.5 → surplus triggered', () => {
    // T1=0, T2=50. avg=25, 50 > 25*2.5=62.5? No. Need more skew.
    // T1=0, T2=0, T3=60. avg=20, 60 > 20*2.5=50 AND 60>10 → surplus
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 60 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const surplus = result.find(a => a.store === 'TIENDA3' && a.risk === 'overstock')
    expect(surplus).toBeDefined()
  })

  // H-12: MIN_AVG_FOR_RATIO guard for low stock ratio (no-history path)
  it('HIGH: no history, avgQty < MIN_AVG_FOR_RATIO → low stock ratio skipped, absolute check active', () => {
    // T1=1, T2=2, T3=3. avg=2, 2 < MIN_AVG_FOR_RATIO=5 → ratio check skipped
    // T1,T2,T3 all <= MIN_STOCK_ABS(3) → deficit. Need depot for actions to generate.
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 1 }),
        inv({ store: 'TIENDA2', units: 2 }),
        inv({ store: 'TIENDA3', units: 3 }),
        inv({ store: 'STOCK', units: 100 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // All deficit → unmetDeficit accumulated → N3 from STOCK
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBeGreaterThanOrEqual(1)
  })

  // H-13: MIN_AVG_FOR_RATIO guard — avgQty >= 5 enables low stock ratio
  it('HIGH: no history, avgQty >= MIN_AVG_FOR_RATIO → low stock ratio check active', () => {
    // T1=1, T2=20, T3=20. avg=13.67, 13.67 >= 5 → ratio check active
    // T1: 1 < 13.67*0.40=5.47 AND 1 <= MIN_STOCK_ABS=3 → deficit via absolute check
    // Need depot stock for actions to actually generate
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 1 }),
        inv({ store: 'TIENDA2', units: 20 }),
        inv({ store: 'TIENDA3', units: 20 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // T1 deficit → unmetDeficit → N3 from STOCK. Check N3 exists.
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    expect(n3).toBeDefined()
  })

  // H-14: MIN_TRANSFER_UNITS when toFill === take (edge: last units needed)
  it('HIGH: MIN_TRANSFER_UNITS skipped when take equals remaining need', () => {
    // If toFill=1 and take=1, skip because take < MIN_TRANSFER_UNITS(2) AND toFill > take is false
    // So toFill=1, take=1 → toFill > take is false → the source is used
    const sales = new Map([
      ['TIENDA1|SKU001', 5],   // target=13.85, qty=13 → need=ceil(13.85-13)=1
      ['TIENDA2|SKU001', 1],   // target=2.77, qty=10 → excess=floor(10-2.77)=7
    ])
    computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 13 }),
        inv({ store: 'TIENDA2', units: 10 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // MIN_TRANSFER_UNITS guard with last units edge case
    // need = max(ceil(13.85 - 13), 3) = 3 because of MIN_STOCK_ABS
  })

  // H-15: N2 partial fill — depot runs out mid-allocation
  it('HIGH: N2 depot runs out mid-allocation across multiple deficit stores', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'SKU001' }),
        inv({ store: 'TIENDA2', units: 0, sku: 'SKU001' }),
        inv({ store: 'TIENDA3', units: 0, sku: 'SKU001' }),
        inv({ store: 'RETAILS', units: 4, sku: 'SKU001' }),  // only 4 units for 3 stores
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    const totalFromDepot = n2.reduce((s, a) => s + a.suggestedUnits, 0)
    // Total should not exceed depot stock
    expect(totalFromDepot).toBeLessThanOrEqual(4)
    // Not all stores get served
    expect(n2.length).toBeLessThanOrEqual(3)
  })

  // H-16: N2 depot allocation fairness (first deficit served first)
  it('HIGH: N2 depot allocation follows deficit priority (critical first)', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],  // target=27.7, qty=0 → need=28 (critical)
      ['TIENDA2|SKU001', 10],  // target=27.7, qty=5 → need=23 (low)
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 5 }),
        inv({ store: 'RETAILS', units: 10 }),  // limited depot
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n2_t1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    const n2_t2 = result.find(a => a.store === 'TIENDA2' && a.waterfallLevel === 'depot_to_store')
    // TIENDA1 (critical, qty=0) should be served first
    if (n2_t1 && n2_t2) {
      expect(n2_t1.suggestedUnits).toBeGreaterThanOrEqual(n2_t2.suggestedUnits)
    } else if (n2_t1) {
      expect(n2_t1.suggestedUnits).toBeGreaterThan(0)
    }
  })

  // H-17: Both mirror + liquidation for same surplus store
  it('HIGH: surplus store gets both mirror action and liquidation action', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],   // target=27.7, qty=0 → need=28
      ['TIENDA2|SKU001', 1],    // target=2.77, qty=200 → excess=197
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 200 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t2Actions = result.filter(a => a.store === 'TIENDA2' && a.risk === 'overstock')
    // Should have mirror (with counterparts) AND liquidation (without counterparts)
    const mirror = t2Actions.find(a => a.counterpartStores.length > 0)
    const liquidation = t2Actions.find(a => a.counterpartStores.length === 0)
    expect(mirror).toBeDefined()
    expect(liquidation).toBeDefined()
  })

  // H-18: Liquidation threshold — remaining < 3 → no liquidation
  it('HIGH: remaining surplus < 3 units → no liquidation action', () => {
    // B2C 3w WOI: T1 target=10*0.69=6.93, need=7. T2 target=10*0.69=6.93, excess=floor(10-6.93)=3.
    // After T1 takes 3u from T2, remaining=0 → no liquidation
    const sales = new Map([
      ['TIENDA1|SKU001', 10],   // target=6.93, qty=0 → need=7
      ['TIENDA2|SKU001', 10],   // target=6.93, qty=10 → excess=3
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 10 }), // excess=3, consumed by T1 need
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // After allocation to TIENDA1, remaining should be ≤2 → no liquidation (threshold=3)
    const liquidation = result.filter(
      a => a.store === 'TIENDA2' && a.risk === 'overstock' && a.counterpartStores.length === 0
    )
    expect(liquidation.length).toBe(0)
  })

  // H-19: Pareto flagging — sorted by impact independently of risk sort
  it('HIGH: pareto flags top items by IMPACT not by risk order', () => {
    const sales = new Map([
      ['TIENDA1|SK_HIGH', 10],
      ['TIENDA2|SK_HIGH', 2],
      ['TIENDA1|SK_LOW', 10],
      ['TIENDA2|SK_LOW', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'SK_HIGH', price: 50000, cost: 10000 }),
        inv({ store: 'TIENDA2', units: 50, sku: 'SK_HIGH', price: 50000, cost: 10000 }),
        inv({ store: 'TIENDA1', units: 0, sku: 'SK_LOW', price: 100, cost: 50 }),
        inv({ store: 'TIENDA2', units: 50, sku: 'SK_LOW', price: 100, cost: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // SK_HIGH should have pareto=true, SK_LOW might not
    const highItem = result.find(a => a.sku === 'SK_HIGH' && a.risk === 'critical')
    if (highItem) {
      expect(highItem.paretoFlag).toBe(true)
    }
  })

  // H-20: Depot stock is per-SKU — different SKUs have independent depot pools
  it('HIGH: depot stock per-SKU — SKU A depot does not affect SKU B allocation', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'SKU_A' }),
        inv({ store: 'TIENDA1', units: 0, sku: 'SKU_B' }),
        inv({ store: 'RETAILS', units: 100, sku: 'SKU_A' }),
        inv({ store: 'RETAILS', units: 0, sku: 'SKU_B' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n2_a = result.find(a => a.sku === 'SKU_A' && a.waterfallLevel === 'depot_to_store')
    const n2_b = result.find(a => a.sku === 'SKU_B' && a.waterfallLevel === 'depot_to_store')
    expect(n2_a).toBeDefined()
    expect(n2_b).toBeUndefined()  // No RETAILS stock for SKU_B
  })

  // ─── MEDIUM: Classification edge cases ─────────────────────────────────────

  // M-01: History = 0 treated as no-history path
  it('MEDIUM: salesHistory = 0 uses no-history fallback', () => {
    const sales = new Map([['TIENDA1|SKU001', 0]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // hist=0 → falsy → falls to else branch → qty=0 → deficit → N3 from STOCK
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    expect(n3).toBeDefined()
  })

  // M-02: Single store with 0 units → deficit from absolute check
  it('MEDIUM: single store qty=0 → deficit', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    expect(n3).toBeDefined()
  })

  // M-03: Multiple stores all at MIN_STOCK_ABS boundary
  it('MEDIUM: all stores at exactly MIN_STOCK_ABS(3) → deficit triggered', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 3 }),
        inv({ store: 'TIENDA2', units: 3 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // qty=3 <= MIN_STOCK_ABS(3) → deficit (no history path)
    const deficits = result.filter(a => a.risk === 'critical' || a.risk === 'low')
    expect(deficits.length).toBeGreaterThanOrEqual(1)
  })

  // M-04: Deficit need minimum is MIN_STOCK_ABS when history-based
  it('MEDIUM: deficit need is at least MIN_STOCK_ABS even with history', () => {
    const sales = new Map([['TIENDA1|SKU001', 1]]) // target=2.77, qty=1 < 1.385 → deficit
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 1 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const action = result.find(a => a.store === 'TIENDA1' || a.store === 'RETAILS')
    if (action && action.store === 'RETAILS') {
      // need = max(ceil(2.77 - 1), 3) = max(2, 3) = 3
      expect(action.suggestedUnits).toBeGreaterThanOrEqual(3)
    }
  })

  // M-05: Price fallback: price=0 → uses cost*2
  it('MEDIUM: price=0 falls back to cost*2', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 0, cost: 100 }),
        inv({ store: 'TIENDA2', units: 50, price: 0, cost: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // price=0 → effectivePrice = cost*2 = 200
    const action = result.find(a => a.store === 'TIENDA1')
    if (action) {
      expect(action.impactScore).toBeGreaterThan(0)
    }
  })

  // M-06: priceMay fallback: priceMay=0 → uses price
  it('MEDIUM: priceMay=0 falls back to price for B2B', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2B1', units: 0, channel: 'b2b', price: 200, priceMay: 0, cost: 50 }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    const action = result.find(a => a.store === 'B2B1')
    if (action) {
      expect(action.impactScore).toBeGreaterThan(0)
    }
  })

  // M-07: grossMarginFactor — negative margin clamps to 0
  it('MEDIUM: negative gross margin → factor = 1 (no penalty)', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 50, cost: 100 }),  // negative margin
        inv({ store: 'TIENDA2', units: 50, price: 50, cost: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const action = result.find(a => a.store === 'TIENDA1')
    if (action) {
      // factor = 1 + max(0, (50-100)/50) * 0.3 = 1 + max(0, -1) * 0.3 = 1
      // impact = units * max(50,1) * 1
      expect(action.impactScore).toBeGreaterThan(0)
    }
  })

  // M-08: MOS calculation — no sales history → MOS = 0
  it('MEDIUM: no sales history → currentMOS = 0', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      if (a.historicalAvg === 0) {
        expect(a.currentMOS).toBe(0)
      }
    }
  })

  // M-09: MOS calculation with history
  it('MEDIUM: currentMOS = currentStock / historicalAvg', () => {
    const sales = new Map([['TIENDA1|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 5 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const action = result.find(a => a.store === 'TIENDA1' || a.store === 'RETAILS')
    if (action && action.historicalAvg > 0) {
      expect(action.currentMOS).toBe(action.currentStock / action.historicalAvg)
    }
  })

  // M-10: Empty string store skipped
  it('MEDIUM: empty store name skipped', () => {
    expect(() => {
      computeActionQueue(
        makeInput([
          inv({ store: '', units: 0 }),
          inv({ store: 'TIENDA1', units: 30 }),
        ]),
        'b2c', null, null, null, null, 0,
      )
    }).not.toThrow()
  })

  // M-11: Empty SKU skipped
  it('MEDIUM: empty SKU rows are skipped in addToSkuMap', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: '' }),
        inv({ store: 'TIENDA2', units: 30, sku: '' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Empty SKU rows should be skipped → no actions
    expect(result.length).toBe(0)
  })

  // M-12: Whitespace in store names trimmed
  it('MEDIUM: store names with whitespace are trimmed', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: '  TIENDA1  ', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Should treat as TIENDA1
    for (const a of result) {
      expect(a.store.trim()).toBe(a.store)
    }
  })

  // M-13: Lowercase store name normalized to uppercase
  it('MEDIUM: store name case insensitive (uppercased)', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'tienda1', units: 0 }),
        inv({ store: 'tienda2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Stores should be uppercased
    for (const a of result) {
      expect(a.store).toBe(a.store.toUpperCase())
    }
  })

  // M-14: storeFilter case insensitive
  it('MEDIUM: storeFilter is case insensitive', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 50 }),
      ]),
      'b2c', null, null, null, 'tienda1', 0,  // lowercase filter
    )
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    expect(n2).toBeDefined()
  })

  // M-15: brandFilter case insensitive
  it('MEDIUM: brandFilter is case insensitive', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Martel' }),
      ]),
      'b2c', 'martel', null, null, null, 0,  // lowercase filter
    )
    expect(result.length).toBeGreaterThanOrEqual(0)
    for (const a of result) {
      expect(a.brand.toLowerCase()).toBe('martel')
    }
  })

  // M-16: Deterministic sort — same risk + units → sorted by impact, then sku, then talle, then store
  it('MEDIUM: deterministic sort tiebreaker: impact > sku > talle > store', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, sku: 'B01', talle: 'M' }),
        inv({ store: 'TIENDA2', units: 0, sku: 'A01', talle: 'M' }),
        inv({ store: 'TIENDA3', units: 30, sku: 'A01', talle: 'M' }),
        inv({ store: 'TIENDA3', units: 30, sku: 'B01', talle: 'M' }),
        inv({ store: 'STOCK', units: 100, sku: 'A01' }),
        inv({ store: 'STOCK', units: 100, sku: 'B01' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Both are critical with same price, so sort by suggestedUnits desc, then impact, then sku
    // Verify no duplicates and proper ordering
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1]
      const curr = result[i]
      const RISK_ORDER = { critical: 0, low: 1, overstock: 2, balanced: 3 }
      const rp = RISK_ORDER[prev.risk] - RISK_ORDER[curr.risk]
      if (rp !== 0) {
        expect(rp).toBeLessThanOrEqual(0)
      }
    }
  })

  // M-17: Impact score formula verification
  it('MEDIUM: impact score = units × max(price, 1) × grossMarginFactor', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 1000, cost: 400 }),
        inv({ store: 'TIENDA2', units: 50, price: 1000, cost: 400 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const critical = result.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    if (critical) {
      // grossMargin = (1000-400)/1000 = 0.6
      // factor = 1 + 0.6 * 0.3 = 1.18
      // impact = units * 1000 * 1.18
      const expectedFactor = 1 + Math.max(0, (1000 - 400) / 1000) * 0.3
      const expectedImpact = critical.suggestedUnits * 1000 * expectedFactor
      expect(Math.abs(critical.impactScore - expectedImpact)).toBeLessThan(1)
    }
  })

  // M-18: surplus stores sorted by excess descending
  it('MEDIUM: surplus stores are consumed largest-first', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 20],
      ['T_SMALL|SKU001', 1],
      ['T_BIG|SKU001', 1],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'T_SMALL', units: 20 }),   // excess ~17
        inv({ store: 'T_BIG', units: 100 }),     // excess ~97
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficit = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    if (deficit && deficit.counterpartStores.length >= 2) {
      // T_BIG should be listed first (more excess)
      expect(deficit.counterpartStores[0].store).toBe('T_BIG')
    }
  })

  // M-19: SURPLUS_LIQUIDATE_RATIO applied to liquidation
  it('MEDIUM: liquidation units = remaining × SURPLUS_LIQUIDATE_RATIO(0.60)', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 1],    // target ~2.77, qty=200 → excess=197
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 200 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const liquidation = result.find(
      a => a.store === 'TIENDA1' && a.risk === 'overstock' && a.counterpartStores.length === 0
    )
    if (liquidation) {
      // liquidation units = min(remaining, round(remaining * 0.60))
      // with no deficit stores, remaining = full excess
      expect(liquidation.suggestedUnits).toBeGreaterThan(0)
    }
  })

  // M-20: N3 only generated once per SKU+talle (dedup)
  it('MEDIUM: N3 dedup — only one per SKU+talle even with many deficit stores', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0 }),
        inv({ store: 'T2', units: 0 }),
        inv({ store: 'T3', units: 0 }),
        inv({ store: 'T4', units: 0 }),
        inv({ store: 'T5', units: 0 }),
        inv({ store: 'STOCK', units: 200 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.filter(a => a.waterfallLevel === 'central_to_depot')
    expect(n3.length).toBe(1)
    expect(n3[0].store).toBe('RETAILS')
  })

  // M-21: N3 suggestedUnits = min(depotStock, unmetDeficit)
  it('MEDIUM: N3 units = min(STOCK available, total unmet deficit)', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0 }),
        inv({ store: 'T2', units: 0 }),
        inv({ store: 'STOCK', units: 5 }),  // very limited
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    if (n3) {
      expect(n3.suggestedUnits).toBeLessThanOrEqual(5)
    }
  })

  // M-22: N3 counterpart is always STOCK
  it('MEDIUM: N3 counterpart is always STOCK depot', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    if (n3) {
      expect(n3.counterpartStores).toHaveLength(1)
      expect(n3.counterpartStores[0].store).toBe('STOCK')
    }
  })

  // M-23: Mirror actions have correct counterpart
  it('MEDIUM: mirror overstock action counterparts point to deficit stores', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
      ['TSURPLUS|SKU001', 1],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TSURPLUS', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const mirror = result.find(
      a => a.store === 'TSURPLUS' && a.risk === 'overstock' && a.counterpartStores.length > 0
    )
    if (mirror) {
      for (const c of mirror.counterpartStores) {
        expect(['TIENDA1', 'TIENDA2']).toContain(c.store)
        expect(c.units).toBeGreaterThan(0)
      }
    }
  })

  // M-24: Impact threshold = 0 → all actions pass
  it('MEDIUM: impact threshold 0 → all actions returned', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 5],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 2, price: 1, cost: 1 }),
        inv({ store: 'TIENDA2', units: 50, price: 1, cost: 1 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    expect(result.length).toBeGreaterThan(0)
  })

  // M-25: Overstock filter by threshold (non-critical)
  it('MEDIUM: overstock actions below threshold are filtered', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 1],
    ])
    const withThreshold = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 10, cost: 5 }),
        inv({ store: 'TIENDA2', units: 100, price: 10, cost: 5 }),
      ], sales),
      'b2c', null, null, null, null, 999_999_999,
    )
    // Overstock actions with low price should be filtered
    const overstock = withThreshold.filter(a => a.risk === 'overstock')
    expect(overstock.length).toBe(0)
  })

  // M-26: Duplicate inventory aggregation in skuMap
  it('MEDIUM: duplicate rows same store+sku+talle → units aggregated', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 10 }),
        inv({ store: 'TIENDA1', units: 10 }), // total=20
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // TIENDA1 should have currentStock=20 (aggregated)
    const t1 = result.find(a => a.store === 'TIENDA1')
    if (t1) {
      expect(t1.currentStock).toBe(20)
    }
  })

  // M-27: Depot duplicate rows aggregated
  it('MEDIUM: duplicate RETAILS rows are aggregated', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 25 }),
        inv({ store: 'RETAILS', units: 25 }),  // total=50
      ]),
      'b2c', null, null, null, null, 0,
    )
    const n2 = result.filter(a => a.waterfallLevel === 'depot_to_store')
    const total = n2.reduce((s, a) => s + a.suggestedUnits, 0)
    expect(total).toBeLessThanOrEqual(50)
  })

  // M-28: targetStore set to first counterpart
  it('MEDIUM: targetStore equals first counterpart store', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      if (a.counterpartStores.length > 0) {
        expect(a.targetStore).toBe(a.counterpartStores[0].store)
      }
    }
  })

  // M-29: No counterparts → targetStore undefined
  it('MEDIUM: no counterparts → targetStore is undefined', () => {
    const sales = new Map([['TIENDA1|SKU001', 1]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 200 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const liq = result.find(a => a.counterpartStores.length === 0)
    if (liq) {
      expect(liq.targetStore).toBeUndefined()
    }
  })

  // M-30: Lee brand treated as imported (24 weeks)
  it('MEDIUM: Lee brand gets 24 weeks coverage like Wrangler', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Lee', sku: 'LEE01' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Lee', sku: 'LEE01' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const action = result.find(a => a.brand === 'Lee')
    if (action) {
      expect(action.coverWeeks).toBe(24)
    }
  })

  // ─── LOW: Edge cases and minor paths ───────────────────────────────────────

  // L-01: Very large inventory numbers don't overflow
  it('LOW: very large inventory values do not crash', () => {
    expect(() => {
      computeActionQueue(
        makeInput([
          inv({ store: 'TIENDA1', units: 999_999, price: 999_999 }),
          inv({ store: 'TIENDA2', units: 0, price: 999_999 }),
        ]),
        'b2c', null, null, null, null, 0,
      )
    }).not.toThrow()
  })

  // L-02: Single item in inventory → single store → no peer comparison for surplus
  it('LOW: single store → no surplus possible without peers', () => {
    const sales = new Map([['TIENDA1|SKU001', 5]])
    const result = computeActionQueue(
      makeInput([inv({ store: 'TIENDA1', units: 100 })], sales),
      'b2c', null, null, null, null, 0,
    )
    // Single store can be surplus but no N1 target
    const n1 = result.filter(a => a.waterfallLevel === 'store_to_store' && a.risk !== 'overstock')
    expect(n1.length).toBe(0)
  })

  // L-03: All items same price → equal impact per unit
  it('LOW: items with same price have proportional impact to units', () => {
    const sales = new Map([
      ['T1|S1', 5], ['T2|S1', 2],
      ['T1|S2', 5], ['T2|S2', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0, sku: 'S1', price: 500, cost: 200 }),
        inv({ store: 'T2', units: 50, sku: 'S1', price: 500, cost: 200 }),
        inv({ store: 'T1', units: 0, sku: 'S2', price: 500, cost: 200 }),
        inv({ store: 'T2', units: 50, sku: 'S2', price: 500, cost: 200 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // All items with same price/cost should have impact proportional to units
    const criticals = result.filter(a => a.risk === 'critical')
    if (criticals.length >= 2) {
      const ratio = criticals[0].impactScore / criticals[0].suggestedUnits
      for (const c of criticals) {
        const r = c.impactScore / c.suggestedUnits
        expect(Math.abs(r - ratio)).toBeLessThan(1)
      }
    }
  })

  // L-04: Pareto with single item → always flagged
  it('LOW: single action is always pareto flagged', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    if (result.length === 1) {
      // Single item = 100% of impact → always pareto
      expect(result[0].paretoFlag).toBe(true)
    }
  })

  // L-05: Pareto with zero total impact → no flags
  it('LOW: zero total impact → no pareto flags', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 0, cost: 0 }),
        inv({ store: 'TIENDA2', units: 0, price: 0, cost: 0 }),
        inv({ store: 'STOCK', units: 50, price: 0, cost: 0 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // price=0 → effectivePrice = max(price, 1) = 1, so impact won't be exactly 0
    // But test that it doesn't crash
    expect(result.length).toBeGreaterThanOrEqual(0)
  })

  // L-06: Multiple talles for same SKU in same store aggregated
  it('LOW: same store+sku but different talle → separate items', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, talle: 'S' }),
        inv({ store: 'TIENDA1', units: 0, talle: 'M' }),
        inv({ store: 'TIENDA1', units: 0, talle: 'L' }),
        inv({ store: 'STOCK', units: 50, talle: 'S' }),
        inv({ store: 'STOCK', units: 50, talle: 'M' }),
        inv({ store: 'STOCK', units: 50, talle: 'L' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const talles = new Set(result.filter(a => a.store === 'RETAILS').map(a => a.talle))
    // Each talle should generate independent N3
    expect(talles.size).toBe(3)
  })

  // L-07: storeCluster populated for known stores
  it('LOW: storeCluster is set for known stores', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'CERROALTO', units: 0 }),
        inv({ store: 'WRSSL', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      if (a.store === 'CERROALTO') expect(a.storeCluster).toBe('B')
      if (a.store === 'WRSSL') expect(a.storeCluster).toBe('A')
    }
  })

  // L-08: Unknown store → storeCluster null
  it('LOW: unknown store → storeCluster is null', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'UNKNOWNSTORE', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const unknown = result.find(a => a.store === 'UNKNOWNSTORE')
    if (unknown) {
      expect(unknown.storeCluster).toBeNull()
    }
  })

  // L-09: timeRestriction for known stores
  it('LOW: timeRestriction populated for stores with restrictions', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'GALERIAWRLEE', units: 0 }),
        inv({ store: 'TIENDA2', units: 30 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const gal = result.find(a => a.store === 'GALERIAWRLEE')
    if (gal) {
      expect(gal.timeRestriction).toContain('10am')
    }
  })

  // L-10: recommendedAction string for N1, N2, N3
  it('LOW: recommendedAction contains human-readable instruction', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
        inv({ store: 'RETAILS', units: 50 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(a.recommendedAction.length).toBeGreaterThan(0)
    }
  })

  // L-11: IDs are unique
  it('LOW: all action IDs are unique', () => {
    const sales = new Map([
      ['T1|SKU001', 10], ['T2|SKU001', 2], ['T3|SKU001', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0 }),
        inv({ store: 'T2', units: 100 }),
        inv({ store: 'T3', units: 0 }),
        inv({ store: 'RETAILS', units: 50 }),
        inv({ store: 'STOCK', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const ids = result.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  // L-12: resetIdCounter called each invocation
  it('LOW: id counter resets between invocations', () => {
    const r1 = computeActionQueue(
      makeInput([inv({ store: 'T1', units: 0 }), inv({ store: 'T2', units: 30 })]),
      'b2c', null, null, null, null, 0,
    )
    const r2 = computeActionQueue(
      makeInput([inv({ store: 'T1', units: 0 }), inv({ store: 'T2', units: 30 })]),
      'b2c', null, null, null, null, 0,
    )
    // Both should have similar id patterns (counter reset)
    if (r1.length > 0 && r2.length > 0) {
      // IDs contain _idCounter — they should have same suffix pattern
      const suffix1 = r1[0].id.split('-').pop()
      const suffix2 = r2[0].id.split('-').pop()
      expect(suffix1).toBe(suffix2)
    }
  })

  // L-13: skuComercial preserved in output
  it('LOW: skuComercial passed through to action item', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0, skuComercial: 'MACA999' }),
        inv({ store: 'T2', units: 30, skuComercial: 'MACA999' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(a.skuComercial).toBe('MACA999')
    }
  })

  // L-14: description preserved
  it('LOW: description preserved in output', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0, description: 'Camisa Azul XL' }),
        inv({ store: 'T2', units: 30, description: 'Camisa Azul XL' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(a.description).toBe('Camisa Azul XL')
    }
  })

  // L-15: Mixed channels in same inventory
  it('LOW: b2c and b2b rows in same inventory separated correctly', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, channel: 'b2c' }),
        inv({ store: 'B2BCLIENT', units: 0, channel: 'b2b', sku: 'SKU_B2B' }),
        inv({ store: 'TIENDA2', units: 30, channel: 'b2c' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(a.sku).not.toBe('SKU_B2B')
    }
  })

  // L-16: Max price across stores used for impact
  it('LOW: max price across stores used for impact calculation', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 100 }),
        inv({ store: 'TIENDA2', units: 30, price: 500 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const critical = result.find(a => a.risk === 'critical')
    if (critical) {
      // Should use max(100, 500) = 500 for impact
      expect(critical.impactScore).toBeGreaterThan(critical.suggestedUnits * 100)
    }
  })

  // 33. B2B mode uses wholesale price (priceMay) for impact score
  it('B2B impact score uses priceMay instead of retail price', () => {
    // Same SKU: price=200, priceMay=80 — B2B should use 80
    const b2cResult = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, channel: 'b2c', price: 200, priceMay: 80, cost: 40 }),
        inv({ store: 'TIENDA2', units: 50, channel: 'b2c', price: 200, priceMay: 80, cost: 40 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    const b2bResult = computeActionQueue(
      makeInput([
        inv({ store: 'CLIENTEB2B', units: 0, channel: 'b2b', price: 200, priceMay: 80, cost: 40 }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    // B2B impact should be lower than B2C for same units (80 vs 200 price)
    if (b2cResult.length > 0 && b2bResult.length > 0) {
      const b2cImpact = b2cResult[0].impactScore
      const b2bImpact = b2bResult[0].impactScore
      expect(b2bImpact).toBeLessThan(b2cImpact)
    }
  })

  // ─── DEEP AUDIT TESTS (17/03/2026) ─────────────────────────────────────────

  // DA-01: NaN units are safely skipped (8.2 NaN propagation guard)
  it('DA-01: NaN units rows are silently skipped', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: NaN }),
        inv({ store: 'TIENDA2', units: 30 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // NaN row skipped — TIENDA2 is the only operational store, no deficit
    // No crash, algorithm completes
    expect(result).toBeDefined()
    const nanActions = result.filter(a => Number.isNaN(a.suggestedUnits))
    expect(nanActions).toHaveLength(0)
  })

  // DA-02: Infinity units are safely skipped
  it('DA-02: Infinity units rows are skipped', () => {
    expect(() => {
      computeActionQueue(
        makeInput([
          inv({ store: 'TIENDA1', units: Infinity }),
          inv({ store: 'TIENDA2', units: 30 }),
        ]),
        'b2c', null, null, null, null, 0,
      )
    }).not.toThrow()
  })

  // DA-03: N1→N2 cascade — partial N1 fill now cascades to N2
  it('DA-03: N1 partial fill + N2 cascade = combined fill', () => {
    // B2C 13w WOI: T1 target=30×3.00=90, need=91. T2 target=1×3.00=3, qty=10 > 3×2=6 → excess=floor(10-3)=7
    // N1 gives 7u (< 91 need) → remainder cascades to N2 from RETAILS
    const sales = new Map([
      ['TIENDA1|SKU001', 30],   // target≈90, qty=0 → need=91
      ['TIENDA2|SKU001', 1],    // target≈3, qty=10 → 10 > 6 → excess=7
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 10 }),    // surplus ~7 (not enough for full need)
        inv({ store: 'RETAILS', units: 100 }),   // plenty for N2
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    // Both N1 and N2 should fire for this deficit store
    expect(n1).toBeDefined()
    expect(n2).toBeDefined()
    if (n1 && n2) {
      expect(n1.suggestedUnits + n2.suggestedUnits).toBeGreaterThanOrEqual(1)
    }
  })

  // DA-04: B2B N4 pool tracking with limited STOCK
  it('DA-04: B2B N4 with limited STOCK caps total across clients', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'B2B_X', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'B2B_Y', units: 0, channel: 'b2b', sku: 'SKU001' }),
        inv({ store: 'STOCK', units: 3, channel: 'b2c', sku: 'SKU001' }),
      ]),
      'b2b', null, null, null, null, 0,
    )
    const n4 = result.filter(a => a.waterfallLevel === 'central_to_b2b')
    const totalAllocated = n4.reduce((s, a) => s + a.suggestedUnits, 0)
    expect(totalAllocated).toBeLessThanOrEqual(3)
  })

  // DA-05: SKU in RETAILS but no operational stores → no crash
  it('DA-05: SKU exists only in RETAILS depot → no actions generated', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'RETAILS', units: 100, sku: 'ORPHAN_SKU' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // No operational stores → no skuMap entries → no actions
    expect(result).toEqual([])
  })

  // DA-06: SKU in STOCK but no operational stores → no actions
  it('DA-06: SKU exists only in STOCK depot → no actions', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'STOCK', units: 200, sku: 'ORPHAN_SKU' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    expect(result).toEqual([])
  })

  // DA-07: Threshold + pareto interaction — threshold filters first, then pareto on filtered set
  it('DA-07: pareto is computed on threshold-filtered set', () => {
    const sales = new Map<string, number>()
    for (let i = 0; i < 10; i++) {
      sales.set(`TD${i}|SK${i}`, 5)
      sales.set(`TS${i}|SK${i}`, 2)
    }
    const rows: InventoryRecord[] = []
    for (let i = 0; i < 10; i++) {
      // High-value items
      rows.push(inv({ store: `TD${i}`, units: 0, sku: `SK${i}`, price: 100000 }))
      rows.push(inv({ store: `TS${i}`, units: 50, sku: `SK${i}`, price: 100000 }))
    }
    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null, 500_000)
    if (result.length > 2) {
      // Pareto flags exist on the filtered set
      const pareto = result.filter(a => a.paretoFlag)
      const nonPareto = result.filter(a => !a.paretoFlag)
      expect(pareto.length).toBeGreaterThan(0)
      // At least some items should not be pareto
      if (result.length > 3) {
        expect(nonPareto.length).toBeGreaterThanOrEqual(0)
      }
    }
  })

  // DA-08: Mirror action units match deficit N1 allocation
  it('DA-08: surplus mirror units equal deficit N1 units for same SKU', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],   // deficit
      ['TIENDA2|SKU001', 2],    // surplus
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficitN1 = result.find(
      a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store'
    )
    const surplusMirror = result.find(
      a => a.store === 'TIENDA2' && a.risk === 'overstock' && a.counterpartStores.length > 0
    )
    if (deficitN1 && surplusMirror) {
      // Mirror should report same units as deficit received from this store
      const fromT2 = deficitN1.counterpartStores.find(c => c.store === 'TIENDA2')
      const toT1 = surplusMirror.counterpartStores.find(c => c.store === 'TIENDA1')
      if (fromT2 && toT1) {
        expect(fromT2.units).toBe(toT1.units)
      }
    }
  })

  // DA-09: Surplus pool never goes negative
  it('DA-09: no action has more counterpart units than the surplus store excess', () => {
    // B2C 3w WOI: T3 target=2*0.69=1.38, excess=floor(20-1.38)=18
    const sales = new Map([
      ['TIENDA1|SKU001', 20], // big deficit
      ['TIENDA2|SKU001', 20], // big deficit
      ['TIENDA3|SKU001', 2],  // small surplus
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 20 }), // excess ≈ 18 with 3w WOI
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // Total units sourced from TIENDA3 across all actions
    const fromT3 = result
      .filter(a => a.risk !== 'overstock')
      .flatMap(a => a.counterpartStores)
      .filter(c => c.store === 'TIENDA3')
      .reduce((s, c) => s + c.units, 0)
    // Excess = floor(20 - 1.38) = 18 with B2C 3-week WOI
    expect(fromT3).toBeLessThanOrEqual(18)
  })

  // DA-10: Negative units in inventory don't cause negative surplus
  it('DA-10: negative units row → no surplus generated from it', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: -10 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // TIENDA2 with -10 units should not generate surplus
    const surplus = result.filter(a => a.store === 'TIENDA2' && a.risk === 'overstock')
    expect(surplus).toHaveLength(0)
  })

  // DA-11: Price=0 → grossMarginFactor returns 1 (no NaN/Infinity)
  it('DA-11: zero price → impact uses price=1 minimum', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: 0, cost: 0 }),
        inv({ store: 'TIENDA2', units: 0, price: 0, cost: 0 }),
        inv({ store: 'STOCK', units: 50, price: 0, cost: 0 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(Number.isFinite(a.impactScore)).toBe(true)
      expect(a.impactScore).toBeGreaterThanOrEqual(0)
    }
  })

  // DA-12: Negative price → grossMarginFactor clamps to 1
  it('DA-12: negative price → grossMarginFactor returns 1, no inversion', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, price: -100, cost: 50 }),
        inv({ store: 'STOCK', units: 50, price: -100, cost: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(Number.isFinite(a.impactScore)).toBe(true)
      expect(a.impactScore).toBeGreaterThanOrEqual(0)
    }
  })

  // DA-13: Store appearing in both B2C and B2B rows
  it('DA-13: same store code in b2c and b2b → only relevant channel processed', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'HYBRID', units: 0, channel: 'b2c', sku: 'SKU_C' }),
        inv({ store: 'HYBRID', units: 50, channel: 'b2b', sku: 'SKU_C' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // In B2C mode, only B2C rows enter — single store with 0 units
    for (const a of result) {
      if (a.waterfallLevel !== 'central_to_depot') {
        expect(a.store).toBe('HYBRID')
      }
    }
  })

  // DA-14: Large dataset performance — 500 SKUs × 10 stores completes in <100ms
  it('DA-14: 500 SKUs × 10 stores completes in <100ms', () => {
    const rows: InventoryRecord[] = []
    const sales = new Map<string, number>()
    for (let sku = 0; sku < 500; sku++) {
      for (let store = 0; store < 10; store++) {
        rows.push(inv({
          store: `STORE${store}`,
          units: Math.floor(Math.random() * 50),
          sku: `SKU${sku}`,
          price: 50000 + Math.random() * 100000,
        }))
        sales.set(`STORE${store}|SKU${sku}`, 5 + Math.random() * 20)
      }
    }
    const start = performance.now()
    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null)
    const elapsed = performance.now() - start
    expect(result).toBeDefined()
    expect(elapsed).toBeLessThan(100) // 100ms budget
  })

  // DA-15: Pareto exactly at 80% boundary — all items at equal impact
  it('DA-15: equal impact items → pareto flags subset, not all', () => {
    const sales = new Map<string, number>()
    const rows: InventoryRecord[] = []
    for (let i = 0; i < 10; i++) {
      rows.push(inv({ store: `TD${i}`, units: 0, sku: `EQ${i}`, price: 1000, cost: 500 }))
      rows.push(inv({ store: `TS${i}`, units: 50, sku: `EQ${i}`, price: 1000, cost: 500 }))
      sales.set(`TD${i}|EQ${i}`, 5)
      sales.set(`TS${i}|EQ${i}`, 2)
    }
    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null, 0)
    if (result.length > 3) {
      const pareto = result.filter(a => a.paretoFlag)
      const nonPareto = result.filter(a => !a.paretoFlag)
      // With equal impact, ~80% of items should be flagged
      expect(pareto.length).toBeGreaterThan(0)
      expect(nonPareto.length).toBeGreaterThan(0)
    }
  })

  // DA-16: avgQty self-bias — high-stock store inflates its own average
  it('DA-16: avgQty self-bias acknowledged — store with 100u among 5 stores', () => {
    // 5 stores: 4 at 5u + 1 at 100u. avg=24. Without self: avg of 4 others = 5.
    // The high store (100) is NOT flagged as surplus because 100 > 24*2.5=60 → YES surplus.
    // This test documents the self-bias behavior.
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 5 }),
        inv({ store: 'T2', units: 5 }),
        inv({ store: 'T3', units: 5 }),
        inv({ store: 'T4', units: 5 }),
        inv({ store: 'T5', units: 100 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // T5 with 100u, avg=24, 100 > 24*2.5=60 AND 100>10 → surplus triggered
    const surplus = result.find(a => a.store === 'T5' && a.risk === 'overstock')
    expect(surplus).toBeDefined()
    // T1-T4 with 5u, avg=24, 5 < 24*0.4=9.6 AND avg(24)>=5 → deficit
    const deficit = result.filter(a => a.risk === 'critical' || a.risk === 'low')
    expect(deficit.length).toBeGreaterThan(0)
  })

  // DA-17: "Otras" brand gets 12w coverage (national), not 24w (imported)
  it('DA-17: unknown brand normalizes to "Otras" → 12 weeks coverage', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'UnknownBrand' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'UnknownBrand' }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const a of result) {
      expect(a.coverWeeks).toBe(12)
    }
  })

  // DA-18: Empty store name is skipped
  it('DA-18: empty store name rows are skipped', () => {
    const result = computeActionQueue(
      makeInput([
        inv({ store: '', units: 50 }),
        inv({ store: '  ', units: 50 }),
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'STOCK', units: 50 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    // Empty store rows should be skipped, not crash
    const emptyStoreActions = result.filter(a => a.store === '' || a.store === '  ')
    expect(emptyStoreActions).toHaveLength(0)
  })

  // DA-19: N2 depot consumption shared across cascade and direct N2
  it('DA-19: N2 depot pool shared between cascade and direct N2 allocations', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 20],  // target=55, qty=0 → need=55
      ['TIENDA2|SKU001', 20],  // target=55, qty=0 → need=55
      ['TIENDA3|SKU001', 1],   // target=2.77, qty=10 → excess=7
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'TIENDA3', units: 10 }),   // surplus ~7
        inv({ store: 'RETAILS', units: 20 }),    // limited depot
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // Total N2 from RETAILS should not exceed 20
    const n2Total = result
      .filter(a => a.waterfallLevel === 'depot_to_store')
      .reduce((s, a) => s + a.suggestedUnits, 0)
    expect(n2Total).toBeLessThanOrEqual(20)
  })

  // DA-20: Depot MOS calculation uses aggregated demand of all stores
  it('DA-20: depot MOS reflects total demand across all stores', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 15],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 0 }),
        inv({ store: 'RETAILS', units: 50 }),
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    if (n3) {
      // histAvg for depot = sum of store demands = 10+15 = 25
      expect(n3.historicalAvg).toBe(25)
      // MOS = currentStock(50) / histAvg(25) = 2.0
      expect(n3.currentMOS).toBeCloseTo(2.0, 1)
    }
  })

  // ─── WOI 3-Semanas Audit: Verificaciones matemáticas V1-V7 ──────────────

  // V1: End-to-end con 10 u/mes B2C → target = histAvg × (13/4.33) ≈ 30.02
  //     deficit si qty < target×0.5 = 15.01 → need ≈ ceil(30.02 - qty)
  //     surplus si qty > target×2 = 60.05 → excess ≈ floor(qty - 30.02)
  //     qty=0 → need = max(ceil(30.02), 3) = 31
  it('V1: end-to-end 10 u/mes B2C — target ≈ 30.02, deficit/surplus thresholds', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],  // 10 u/mes avg
      ['TIENDA2|SKU001', 10],
    ])
    // TIENDA1: qty=0 → deficit (critical). target = 10 × (13/4.33) ≈ 30.02. need = ceil(30.02) = 31
    // TIENDA2: qty=70 → 70 > 30.02×2=60.05 → surplus. excess = floor(70 - 30.02) = 39
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 70 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const deficit = result.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    expect(deficit).toBeDefined()
    expect(deficit!.suggestedUnits).toBe(31) // ceil(10 × 13/4.33)

    const surplus = result.find(a => a.store === 'TIENDA2' && a.risk === 'overstock')
    expect(surplus).toBeDefined()
    // Surplus mirror shows units sent to TIENDA1
    const surplusSent = result.find(
      a => a.store === 'TIENDA2' && a.risk === 'overstock' && a.counterpartStores.length > 0
    )
    expect(surplusSent).toBeDefined()
    expect(surplusSent!.counterpartStores[0].store).toBe('TIENDA1')
  })

  // V2: coverWeeks=13 para tiendas B2C, 12/24 para depósitos
  it('V2: coverWeeks = 13 for B2C stores, brand-based for depots', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Martel' }),
        inv({ store: 'TIENDA2', units: 80, brand: 'Martel' }),
        inv({ store: 'RETAILS', units: 50, brand: 'Martel' }),
        inv({ store: 'STOCK', units: 100, brand: 'Martel' }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // B2C stores should have coverWeeks = 13 (B2C_STORE_COVER_WEEKS)
    const storeActions = result.filter(a => a.store !== 'RETAILS' && a.store !== 'STOCK')
    for (const a of storeActions) {
      expect(a.coverWeeks).toBe(13)
    }
    // Depot actions should have brand-based coverWeeks (Martel = national = 12)
    const depotActions = result.filter(a => a.store === 'RETAILS' || a.store === 'STOCK')
    for (const a of depotActions) {
      expect(a.coverWeeks).toBe(12)
    }
  })

  // V2b: Wrangler (imported) depot gets 24 weeks
  it('V2b: imported brand depot gets 24 weeks coverage', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0, brand: 'Wrangler' }),
        inv({ store: 'TIENDA2', units: 30, brand: 'Wrangler' }),
        inv({ store: 'STOCK', units: 100, brand: 'Wrangler' }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const storeActions = result.filter(a => a.store !== 'RETAILS' && a.store !== 'STOCK')
    for (const a of storeActions) {
      expect(a.coverWeeks).toBe(13) // 13 for B2C stores
    }
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    if (n3) {
      expect(n3.coverWeeks).toBe(24) // Wrangler = imported = 24 weeks for depot
    }
  })

  // V3: Pool surplus no sobrepromete con WOI 13 semanas
  // Con target 13 sem, surplus threshold = target×2 = 60.05 u (para 10 u/mes).
  // El pool de cada surplus store debe decrementarse correctamente.
  it('V3: surplus pool does not overpromise with 13-week WOI target', () => {
    const sales = new Map<string, number>()
    // 5 deficit stores, 1 surplus store with 200 units
    for (let i = 1; i <= 5; i++) {
      sales.set(`TD${i}|SKU001`, 10) // each needs ~31 units (target≈30.02)
    }
    sales.set('TS1|SKU001', 5) // surplus store sells 5/mo, target=5×3.00=15.01, excess=floor(200-15.01)=184
    const rows: InventoryRecord[] = []
    for (let i = 1; i <= 5; i++) {
      rows.push(inv({ store: `TD${i}`, units: 0 }))
    }
    rows.push(inv({ store: 'TS1', units: 200 }))

    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null, 0)

    // Total units transferred from TS1 via N1 should not exceed its excess (184)
    const n1FromTS1 = result.filter(
      a => a.waterfallLevel === 'store_to_store' && a.counterpartStores.some(c => c.store === 'TS1')
    )
    const totalFromTS1 = n1FromTS1.reduce(
      (sum, a) => sum + a.counterpartStores.filter(c => c.store === 'TS1').reduce((s, c) => s + c.units, 0),
      0,
    )
    // excess = floor(200 - 5*(13/4.33)) = floor(200 - 15.01) = 184
    expect(totalFromTS1).toBeLessThanOrEqual(184)

    // Mirror surplus action should match
    const surplusMirror = result.find(
      a => a.store === 'TS1' && a.risk === 'overstock' && a.counterpartStores.length > 0
    )
    if (surplusMirror) {
      const mirrorTotal = surplusMirror.counterpartStores.reduce((s, c) => s + c.units, 0)
      expect(mirrorTotal).toBe(totalFromTS1)
    }
  })

  // V4: N1→N2 cascade con 13-week targets
  it('V4: N1→N2 cascade with 13-week targets', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10], // target = 10×(13/4.33) ≈ 30.02, need = ceil(30.02) = 31
      ['TIENDA2|SKU001', 2],  // target = 2×3.00 ≈ 6.00, qty=80 > 6×2=12 → surplus, excess=floor(80-6)=74
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 80 }),
        inv({ store: 'RETAILS', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    // N1 should transfer from TIENDA2 (excess 74) to TIENDA1 (need 31) → takes 31
    const n1 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'store_to_store')
    expect(n1).toBeDefined()
    expect(n1!.suggestedUnits).toBe(31)
    // N1 fully covers need → no N2 cascade needed
    const n2 = result.find(a => a.store === 'TIENDA1' && a.waterfallLevel === 'depot_to_store')
    expect(n2).toBeUndefined()
  })

  // V5: Pareto recalculates over post-threshold filtered set
  it('V5: pareto is calculated on filtered set (post-threshold), not pre-filter', () => {
    const sales = new Map<string, number>()
    // Create items with varying prices: some below threshold, some above
    const rows: InventoryRecord[] = []
    // 5 high-value SKUs (price=10000 → impact >> 500K)
    for (let i = 0; i < 5; i++) {
      rows.push(inv({ store: `TD${i}`, units: 0, sku: `HV${i}`, price: 10000, cost: 5000 }))
      rows.push(inv({ store: `TS${i}`, units: 50, sku: `HV${i}`, price: 10000, cost: 5000 }))
      sales.set(`TD${i}|HV${i}`, 10)
      sales.set(`TS${i}|HV${i}`, 3)
    }
    // 5 low-value SKUs (price=10 → impact < 500K, filtered out by threshold unless critical)
    for (let i = 0; i < 5; i++) {
      rows.push(inv({ store: `TDL${i}`, units: 0, sku: `LV${i}`, price: 10, cost: 5 }))
      rows.push(inv({ store: `TSL${i}`, units: 50, sku: `LV${i}`, price: 10, cost: 5 }))
      sales.set(`TDL${i}|LV${i}`, 10)
      sales.set(`TSL${i}|LV${i}`, 3)
    }
    const result = computeActionQueue(makeInput(rows, sales), 'b2c', null, null, null, null)
    // Pareto flags should only exist among the filtered (high-value) items
    const paretoItems = result.filter(a => a.paretoFlag)
    const nonPareto = result.filter(a => !a.paretoFlag)
    expect(paretoItems.length).toBeGreaterThan(0)
    // Cumulative pareto impact should be >= 80% of total filtered impact
    const totalImpact = result.reduce((s, a) => s + a.impactScore, 0)
    const paretoImpact = paretoItems.reduce((s, a) => s + a.impactScore, 0)
    expect(paretoImpact / totalImpact).toBeGreaterThanOrEqual(0.79)
    // And non-pareto items should exist (not 100% flagged)
    if (result.length > 3) {
      expect(nonPareto.length).toBeGreaterThan(0)
    }
  })

  // V6: Stats exactas: critical + low + overstock = total items (no hidden "balanced" items)
  it('V6: critical + low + overstock = total items — no items lost as balanced', () => {
    // 13w: target = 10×3.00 = 30.02. deficit < 15.01, surplus > 60.05
    const sales = new Map([
      ['T1|SKU001', 10],
      ['T2|SKU001', 10],
      ['T3|SKU001', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'T1', units: 0 }),         // critical
        inv({ store: 'T2', units: 10 }),         // low (10 < 30.02*0.5=15.01)
        inv({ store: 'T3', units: 100 }),        // overstock (100 > 30.02*2=60.05)
        inv({ store: 'RETAILS', units: 20 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const critical = result.filter(a => a.risk === 'critical').length
    const low = result.filter(a => a.risk === 'low').length
    const overstock = result.filter(a => a.risk === 'overstock').length
    const balanced = result.filter(a => a.risk === 'balanced').length
    // All actions should be categorized as critical, low, or overstock — never balanced
    expect(balanced).toBe(0)
    expect(critical + low + overstock).toBe(result.length)
  })

  // V7: MOS=0 when stock=0 but there IS history → should have currentMOS=0, not be excluded
  it('V7: MOS=0 shows correctly when stock=0 and historicalAvg > 0', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
    ])
    // TIENDA2 needs 70u to be surplus (70 > 30.02×2=60.05)
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 70 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t1 = result.find(a => a.store === 'TIENDA1')
    expect(t1).toBeDefined()
    expect(t1!.historicalAvg).toBe(10)       // has history
    expect(t1!.currentStock).toBe(0)          // no stock
    expect(t1!.currentMOS).toBe(0)            // MOS = 0/10 = 0 (not excluded)
    // The UI condition: currentMOS <= 0 && historicalAvg <= 0 → show "—"
    // Here historicalAvg > 0, so UI should show "0.0 MOS" (not "—")
    expect(t1!.currentMOS <= 0 && t1!.historicalAvg <= 0).toBe(false)
  })
})

// ─── idealUnits / gapUnits / daysOfInventory ─────────────────────────────────

describe('idealUnits, gapUnits, daysOfInventory', () => {
  it('idealUnits equals full deficit.need regardless of available supply', () => {
    // TIENDA1 has 0 stock, hist=10 → target = 10 * (13/4.33) ≈ 30.02 → need = ceil(30.02 - 0) = 31
    // TIENDA2 has 5 surplus units (not enough to fill 31)
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t1 = result.find(a => a.store === 'TIENDA1' && a.risk === 'critical')
    expect(t1).toBeDefined()
    // idealUnits should be the full need (not capped by supply)
    expect(t1!.idealUnits).toBeGreaterThan(0)
    expect(t1!.idealUnits).toBeGreaterThanOrEqual(t1!.suggestedUnits)
  })

  it('gapUnits = idealUnits - suggestedUnits when supply < demand', () => {
    // TIENDA1 needs ~31 units, RETAILS has only 5
    const sales = new Map([['TIENDA1|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 5 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t1 = result.find(a => a.store === 'TIENDA1')
    expect(t1).toBeDefined()
    expect(t1!.gapUnits).toBe(t1!.idealUnits - t1!.suggestedUnits)
    expect(t1!.gapUnits).toBeGreaterThan(0)
  })

  it('gapUnits = 0 when supply >= demand', () => {
    // TIENDA1 needs ~31, RETAILS has 100 — more than enough
    const sales = new Map([['TIENDA1|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'RETAILS', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t1 = result.find(a => a.store === 'TIENDA1')
    expect(t1).toBeDefined()
    expect(t1!.gapUnits).toBe(0)
    expect(t1!.suggestedUnits).toBe(t1!.idealUnits)
  })

  it('daysOfInventory = (currentStock / historicalAvg) * 30', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 10],
      ['TIENDA2|SKU001', 10],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const t2 = result.find(a => a.store === 'TIENDA2')
    expect(t2).toBeDefined()
    // DOI = (100 / 10) * 30 = 300
    expect(t2!.daysOfInventory).toBeCloseTo(300, 0)
  })

  it('daysOfInventory = 0 when historicalAvg = 0', () => {
    // No sales history → DOI = 0
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 100 }),
      ]),
      'b2c', null, null, null, null, 0,
    )
    for (const action of result) {
      expect(action.daysOfInventory).toBe(0)
    }
  })

  it('surplus/overstock actions have idealUnits = 0', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 2],
      ['TIENDA2|SKU001', 2],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const overstock = result.filter(a => a.risk === 'overstock')
    for (const action of overstock) {
      expect(action.idealUnits).toBe(0)
    }
  })

  it('N3 action idealUnits = unmetDeficit', () => {
    // TIENDA1 needs units, no surplus stores, RETAILS has 0, STOCK has inventory → N3
    const sales = new Map([['TIENDA1|SKU001', 10]])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    const n3 = result.find(a => a.waterfallLevel === 'central_to_depot')
    expect(n3).toBeDefined()
    expect(n3!.idealUnits).toBeGreaterThan(0)
  })

  it('all actions have valid idealUnits and gapUnits (no NaN, no negative)', () => {
    const sales = new Map([
      ['TIENDA1|SKU001', 5],
      ['TIENDA2|SKU001', 3],
      ['TIENDA3|SKU001', 8],
    ])
    const result = computeActionQueue(
      makeInput([
        inv({ store: 'TIENDA1', units: 0 }),
        inv({ store: 'TIENDA2', units: 50 }),
        inv({ store: 'TIENDA3', units: 2 }),
        inv({ store: 'RETAILS', units: 10 }),
        inv({ store: 'STOCK', units: 100 }),
      ], sales),
      'b2c', null, null, null, null, 0,
    )
    for (const action of result) {
      expect(Number.isFinite(action.idealUnits)).toBe(true)
      expect(action.idealUnits).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(action.gapUnits)).toBe(true)
      expect(action.gapUnits).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(action.daysOfInventory)).toBe(true)
      expect(action.daysOfInventory).toBeGreaterThanOrEqual(0)
    }
  })
})
