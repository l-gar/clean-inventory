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
