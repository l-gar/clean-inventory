/**
 * Shared normalization helpers.
 * All page/hook-level data passes through these before use.
 */

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
    barcode:           raw.barcode     ?? raw.sku        ?? '',
    category:          raw.category    ?? '',
    quantity:          raw.quantity    ?? 0,
    unit:              raw.unit        ?? '',
    location_id:       raw.location_id ?? raw.locationId ?? '',
    location_name:     raw.location_name ?? raw.locationName ?? '',
    lowStockThreshold: Number(
      raw.item_low_stock_threshold ?? raw.itemLowStockThreshold ??
      raw.minQuantity              ?? raw.min_quantity           ?? 0
    ),
    track_stock:       parseTrackStock(raw.track_stock ?? raw.trackStock),
    reorder_point:     Number(raw.reorder_point ?? raw.reorderPoint ?? 0),
  }
}
