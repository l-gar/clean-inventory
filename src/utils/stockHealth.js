/**
 * Returns the effective low-stock threshold for an item.
 * Item-level threshold takes precedence; falls back to org percentage applied to target qty.
 */
export function effectiveThreshold(item, orgThresholdPct) {
  const raw = item.lowStockThreshold
  if (raw !== null && raw !== undefined) return Number(raw)
  const pct = Number(orgThresholdPct ?? 0)
  if (pct <= 0) return 0
  const targetQty = Number(item.resolvedTargetQty ?? item.targetQuantity ?? 0) || 100
  return Math.round(pct / 100 * targetQty)
}

/**
 * Classifies a normalized item as 'out', 'low', 'reorder', or null (healthy).
 */
export function classifyItem(item, orgThreshold) {
  const qty = Number(item.quantity)
  if (qty === 0) return 'out'
  const threshold = effectiveThreshold(item, orgThreshold)
  if (threshold > 0 && qty <= threshold) return 'low'
  const rp = Number(item.reorder_point ?? 0)
  if (rp > 0 && qty <= rp) return 'reorder'
  return null
}

/**
 * Computes derived stock health metrics from a normalized item.
 */
export function computeStockHealth(stock) {
  const {
    quantity,
    lowStockThreshold,
    reorder_point,
    resolvedTargetQty,
    resolvedRestockCycleDays,
    resolvedCost,
    reorderQuantity,
  } = stock

  const itemLowStockThreshold = lowStockThreshold
  const reorderPoint = reorder_point

  const healthPct = resolvedTargetQty
    ? Math.min(quantity / resolvedTargetQty, 1)
    : null

  const alertMarkerPct = (resolvedTargetQty && itemLowStockThreshold)
    ? itemLowStockThreshold / resolvedTargetQty
    : null

  const reorderMarkerPct = (resolvedTargetQty && reorderPoint)
    ? reorderPoint / resolvedTargetQty
    : null

  const dailyRate = (resolvedTargetQty && resolvedRestockCycleDays)
    ? resolvedTargetQty / resolvedRestockCycleDays
    : null

  const daysRemaining = (dailyRate && dailyRate > 0)
    ? Math.floor(quantity / dailyRate)
    : null

  const projectedStockoutDate = daysRemaining !== null
    ? new Date(Date.now() + daysRemaining * 86400000)
    : null

  let urgency = null
  if (daysRemaining !== null) {
    if (daysRemaining <= 7) {
      urgency = 'order_now'
    } else if (daysRemaining <= resolvedRestockCycleDays * 0.3) {
      urgency = 'order_soon'
    } else {
      urgency = 'healthy'
    }
  }

  const reorderCost = (reorderQuantity && resolvedCost)
    ? reorderQuantity * resolvedCost
    : null

  return {
    healthPct,
    alertMarkerPct,
    reorderMarkerPct,
    daysRemaining,
    projectedStockoutDate,
    urgency,
    reorderCost,
  }
}
