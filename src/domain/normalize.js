/**
 * Shared normalization helpers.
 * All page/hook-level data passes through these before use.
 */

function nullableNum(raw, ...keys) {
  for (const k of keys) {
    const v = raw[k]
    if (v != null && v !== '') return Number(v)
  }
  return null
}

export function parseTrackStock(raw) {
  return raw == null ? true : raw === true || String(raw).toUpperCase() === 'TRUE'
}

export function normalizeLocation(l) {
  if (typeof l === 'string') return { location_id: l, location_name: l }
  const id   = l.location_id ?? l.locationId ?? l.id ?? ''
  const name = l.location_name ?? l.locationName ?? l.name ?? id
  return { ...l, location_id: String(id), location_name: String(name) }
}

export function normalizeItem(raw) {
  return {
    ...raw,
    itemId:            raw.stock_id    ?? raw.stockId    ?? raw.itemId    ?? '',
    itemName:          raw.item_name   ?? raw.itemName   ?? '',
    barcode:           String(raw.barcode ?? raw.sku ?? ''),
    category:          raw.category    ?? '',
    quantity:          raw.quantity    ?? 0,
    unit:              raw.unit        ?? '',
    location_id:       raw.location_id ?? raw.locationId ?? '',
    location_name:     raw.location_name ?? raw.locationName ?? '',
    lowStockThreshold: Number(
      raw.item_low_stock_threshold ?? raw.itemLowStockThreshold ??
      raw.lowStockThreshold        ??
      raw.minQuantity              ?? raw.min_quantity           ?? 0
    ),
    track_stock:       parseTrackStock(raw.track_stock ?? raw.trackStock),
    reorder_point:     Number(raw.reorder_point ?? raw.reorderPoint ?? 0),
    reorderQuantity:          nullableNum(raw, 'reorder_quantity', 'reorderQuantity'),
    expectedJobs:             nullableNum(raw, 'expected_jobs', 'expectedJobs'),
    costPerUnit:              nullableNum(raw, 'cost_per_unit', 'costPerUnit'),
    costPerUnitOverride:      nullableNum(raw, 'cost_per_unit_override', 'costPerUnitOverride'),
    resolvedTargetQty:        nullableNum(raw, 'resolved_target_qty', 'resolvedTargetQty'),
    resolvedRestockCycleDays: nullableNum(raw, 'resolved_restock_cycle_days', 'resolvedRestockCycleDays'),
    resolvedCost:             nullableNum(raw, 'resolved_cost', 'resolvedCost'),
    targetQuantity:           nullableNum(raw, 'target_quantity', 'targetQuantity'),
    restockCycleDays:         nullableNum(raw, 'restock_cycle_days', 'restockCycleDays'),
    targetQuantityOverride:   nullableNum(raw, 'target_quantity_override', 'targetQuantityOverride'),
    restockCycleDaysOverride: nullableNum(raw, 'restock_cycle_days_override', 'restockCycleDaysOverride'),
  }
}
