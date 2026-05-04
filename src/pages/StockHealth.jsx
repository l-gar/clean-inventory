import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faTriangleExclamation,
  faArrowTrendDown,
  faBolt,
  faShoppingCart,
  faArrowsRotate,
  faLocationDot,
  faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { normalizeItem } from '../domain/normalize'
import { computeStockHealth } from '../utils/stockHealth'
import { formatDate } from '../utils/date'
import LoadingScreen from '../components/LoadingScreen'
import InlineLoader from '../components/InlineLoader'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import styles from './StockHealth.module.css'

function readSessionInventory(email) {
  if (!email) return null
  try {
    const raw = sessionStorage.getItem(`cleaninv_inventory_${email}_all`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function readSessionLocations(email) {
  if (!email) return null
  try {
    const raw = sessionStorage.getItem(`cleaninv_locations_${email}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function effectiveThreshold(item, orgThresholdPct) {
  const itemThreshold = Number(item.lowStockThreshold ?? 0)
  if (itemThreshold > 0) return itemThreshold
  const pct = Number(orgThresholdPct ?? 0)
  if (pct <= 0) return 0
  // orgThresholdPct is a percentage; apply to resolved target qty, default 100
  const targetQty = Number(item.resolvedTargetQty ?? item.targetQuantity ?? 0) || 100
  return Math.round(pct / 100 * targetQty)
}

function classifyItem(item, orgThreshold) {
  const qty = Number(item.quantity)
  if (qty === 0) return 'out'
  const threshold = effectiveThreshold(item, orgThreshold)
  if (threshold > 0 && qty <= threshold) return 'low'
  const rp = Number(item.reorder_point ?? 0)
  if (rp > 0 && qty <= rp) return 'reorder'
  return null
}

function Section({ tier, items, icon, label, orgThreshold, collapsed, onToggle }) {
  return (
    <div className={styles.section}>
      <button
        type="button"
        className={`${styles.sectionHeader} ${styles[`tier_${tier}`]}`}
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        <span className={`${styles.sectionIconBox} ${styles[`iconBox_${tier}`]}`}>
          <FontAwesomeIcon icon={icon} aria-hidden="true" />
        </span>
        <span className={styles.sectionLabel}>{label}</span>
        <span className={`${styles.sectionBadge} ${styles[`badge_${tier}`]}`}>{items.length}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`${styles.chevron}${collapsed ? ` ${styles.chevronCollapsed}` : ''}`}
          aria-hidden="true"
        />
      </button>
      {!collapsed && items.map((item) => (
        <ItemCard
          key={`${item.itemId}_${item.location_id}`}
          item={item}
          tier={tier}
          orgThreshold={orgThreshold}
        />
      ))}
    </div>
  )
}

function ItemCard({ item, tier, orgThreshold }) {
  const { t, i18n } = useTranslation()
  const qty = Number(item.quantity)
  const threshold = effectiveThreshold(item, orgThreshold)
  const rp = Number(item.reorder_point ?? 0)
  const getLocationName = useStore((s) => s.getLocationName)
  const locationName = getLocationName(item.location_id, item.location_name)
  const health = computeStockHealth(item)
  const hasExtra = health.daysRemaining !== null || health.projectedStockoutDate !== null || health.urgency

  return (
    <div className={`${styles.itemCard} ${styles[`card_${tier}`]}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardNameGroup}>
          <p className={styles.itemName}>{item.itemName}</p>
          {locationName && (
            <div className={styles.locationRow}>
              <FontAwesomeIcon icon={faLocationDot} className={styles.pinIcon} aria-hidden="true" />
              <span className={styles.locationLabel}>{locationName}</span>
            </div>
          )}
        </div>
        <div className={styles.qtyCol}>
          <span className={`${styles.qtyChip} ${styles[`chip_${tier}`]}`}>
            {qty}{item.unit ? ` ${item.unit}` : ''}
          </span>
          {item.resolvedTargetQty && (
            <span className={styles.qtySubLabel}>{qty}/{Number(item.resolvedTargetQty)}</span>
          )}
        </div>
      </div>

      {health.healthPct !== null && (
        <div className={styles.healthBar}>
          <div
            className={`${styles.healthFill} ${styles[`healthFill_${tier}`]}`}
            style={{ width: `${Math.round(health.healthPct * 100)}%` }}
          />
          {threshold > 0 && (
            <div className={styles.tickAlert} style={{ left: `${Math.min(Math.round(threshold / Number(item.resolvedTargetQty) * 100), 100)}%` }} />
          )}
          {rp > 0 && (
            <div className={styles.tickReorder} style={{ left: `${Math.min(Math.round(rp / Number(item.resolvedTargetQty) * 100), 100)}%` }} />
          )}
        </div>
      )}

      <div className={styles.cardMeta}>
        {(tier === 'low' || tier === 'out') && threshold > 0 && (
          <span className={styles.metaNote}>{t('stock_health.alertBelow')} {threshold}</span>
        )}
        {(tier === 'reorder' || tier === 'low' || tier === 'out') && rp > 0 && (
          <span className={styles.metaNote}>{t('stock_health.reorderAt')} {rp}</span>
        )}
        {health.healthPct !== null && (
          <span className={`${styles.metaPct} ${styles[`pct_${tier}`]}`}>
            {t('stock_health.healthPct', { pct: Math.round(health.healthPct * 100) })}
          </span>
        )}
      </div>

      {hasExtra && (
        <div className={styles.cardMetaExtra}>
          {tier !== 'out' && health.daysRemaining !== null && (
            <span className={styles.metaNote}>
              {t('stock_health.daysLeft', { count: health.daysRemaining })}
            </span>
          )}
          {tier !== 'out' && health.projectedStockoutDate !== null && (
            <span className={styles.metaNote}>
              {t('stock_health.runsOut', { date: formatDate(health.projectedStockoutDate, i18n.language) })}
            </span>
          )}
          {/* {health.urgency === 'order_now' && (
            <span className={`${styles.urgencyBadge} ${styles.urgencyOrderNow}`}>
              <FontAwesomeIcon icon={faBolt} aria-hidden="true" />
              {t('stock_health.orderNow')}
            </span>
          )} */}
          {health.urgency === 'order_soon' && (
            <span className={`${styles.urgencyBadge} ${styles.urgencyOrderSoon}`}>
              <FontAwesomeIcon icon={faShoppingCart} aria-hidden="true" />
              {t('stock_health.orderSoon')}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function StockHealth() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  useEffect(() => {
    if (user?.role === 'org_member') navigate('/inventory', { replace: true })
  }, [user, navigate])

  const fetchInventory      = useStore((s) => s.fetchInventory)
  const storeInventory      = useStore((s) => s.inventory)
  const inventoryFetched    = useStore((s) => s.inventoryFetched)
  const inventoryLocationId = useStore((s) => s.inventoryLocationId)
  const inventoryLoading    = useStore((s) => s.inventoryLoading)
  const inventoryError      = useStore((s) => s.inventoryError)
  const invalidateInventory = useStore((s) => s.invalidateInventory)
  const fetchLocations      = useStore((s) => s.fetchLocations)
  const storeLocations      = useStore((s) => s.locations)
  const locationsLoading    = useStore((s) => s.locationsLoading)

  const [items, setItems]              = useState(() => readSessionInventory(user?.email) ?? [])
  const [localLocations, setLocalLocs] = useState(() => readSessionLocations(user?.email) ?? [])
  const [collapsed, setCollapsed]      = useState({})

  useEffect(() => {
    if (!user) return
    fetchLocations(user.email, user.orgId).catch(() => {})
    fetchInventory(user.email, user.orgId, 'all').catch(() => {})
  }, [user, fetchLocations, fetchInventory])

  usePullToRefresh(useCallback(async () => {
    invalidateInventory()
    await fetchInventory(user.email, user.orgId, 'all').catch(() => {})
  }, [invalidateInventory, fetchInventory, user.email, user.orgId]))

  useEffect(() => {
    if (inventoryLoading) return
    if (inventoryLocationId !== 'all') return
    if (storeInventory.length === 0) return
    setItems(storeInventory)
  }, [storeInventory, inventoryLoading, inventoryLocationId])

  useEffect(() => {
    if (locationsLoading) return
    if (storeLocations.length === 0) return
    setLocalLocs(storeLocations)
  }, [storeLocations, locationsLoading])

  const orgThreshold = Number(user?.lowStockThreshold ?? user?.low_stock_threshold ?? 0)

  const hasStaleData = items.length > 0 || localLocations.length > 0
  const isFirstLoad  = !hasStaleData && !inventoryFetched
  if (isFirstLoad) return <LoadingScreen />

  const isRefreshing = (inventoryLoading || locationsLoading) && hasStaleData

  const accessibleIds = useMemo(
    () => new Set(localLocations.map((l) => l.location_id)),
    [localLocations]
  )

  const flagged = useMemo(() => {
    const out = [], low = [], reorder = []
    for (const raw of items) {
      const item = normalizeItem(raw)
      if (!item.track_stock) continue
      if (accessibleIds.size > 0 && !accessibleIds.has(item.location_id)) continue

      const tier = classifyItem(item, orgThreshold)
      if (tier === 'out') out.push(item)
      else if (tier === 'low') low.push(item)
      else if (tier === 'reorder') reorder.push(item)
    }
    return { out, low, reorder }
  }, [items, accessibleIds, orgThreshold])

  const isOwner = user?.role === 'org_owner'

  const cashFlowEstimate = useMemo(() => {
    if (!isOwner) return null
    let total = 0
    let hasAny = false
    for (const raw of items) {
      const item = normalizeItem(raw)
      const { daysRemaining, reorderCost } = computeStockHealth(item)
      if (daysRemaining !== null && daysRemaining <= 14 && reorderCost !== null) {
        total += reorderCost
        hasAny = true
      }
    }
    return hasAny ? total : null
  }, [items, isOwner])

  const totalFlagged = flagged.out.length + flagged.low.length + flagged.reorder.length
  const toggleSection = (tier) => setCollapsed(prev => ({ ...prev, [tier]: !prev[tier] }))

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderRow}>
          <div>
            <h1 className={styles.title}>{t('stock_health.title')}</h1>
            <p className={styles.subtitle}>{t('stock_health.subtitle')}</p>
          </div>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => { invalidateInventory(); fetchInventory(user.email, user.orgId, 'all').catch(() => {}) }}
          >
            <FontAwesomeIcon icon={faArrowsRotate} aria-hidden="true" />
            {t('inventory.refresh')}
          </button>
        </div>

        <div className={styles.summary}>
          <div className={`${styles.summaryCard} ${styles.summaryOut}`}>
            <span className={styles.summaryNum}>{flagged.out.length}</span>
            <span className={styles.summaryLabel}>{t('stock_health.outOfStock')}</span>
            <div className={styles.summaryBar}>
              <div className={`${styles.summaryBarFill} ${styles.summaryBarOut}`} style={{ width: totalFlagged > 0 ? `${Math.round(flagged.out.length / totalFlagged * 100)}%` : '0%' }} />
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryLow}`}>
            <span className={styles.summaryNum}>{flagged.low.length}</span>
            <span className={styles.summaryLabel}>{t('stock_health.lowStock')}</span>
            <div className={styles.summaryBar}>
              <div className={`${styles.summaryBarFill} ${styles.summaryBarLow}`} style={{ width: totalFlagged > 0 ? `${Math.round(flagged.low.length / totalFlagged * 100)}%` : '0%' }} />
            </div>
          </div>
          <div className={`${styles.summaryCard} ${styles.summaryReorder}`}>
            <span className={styles.summaryNum}>{flagged.reorder.length}</span>
            <span className={styles.summaryLabel}>{t('stock_health.belowReorder')}</span>
            <div className={styles.summaryBar}>
              <div className={`${styles.summaryBarFill} ${styles.summaryBarReorder}`} style={{ width: totalFlagged > 0 ? `${Math.round(flagged.reorder.length / totalFlagged * 100)}%` : '0%' }} />
            </div>
          </div>
        </div>
      </div>

      {isRefreshing && <InlineLoader />}

      {inventoryError && (
        <ErrorState
          variant="banner"
          message={t('stock_health.errorLoad')}
          onRetry={() => { invalidateInventory(); fetchInventory(user.email, user.orgId, 'all').catch(() => {}) }}
          retryLabel={t('inventory.retry')}
        />
      )}

      {cashFlowEstimate !== null && (
        <div className={styles.cashFlowPanel}>
          <span className={styles.cashFlowLabel}>{t('stock_health.cashFlow')}</span>
          <div className={styles.cashFlowAmount}>
            ${cashFlowEstimate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      )}

      {totalFlagged === 0 && !inventoryLoading ? (
        <EmptyState
          icon={faCircleCheck}
          iconCircle
          title={t('stock_health.allClear')}
          hint={t('stock_health.allClearHint')}
        />
      ) : (
        <div className={styles.sections}>
          {flagged.out.length > 0 && (
            <Section
              tier="out"
              items={flagged.out}
              icon={faCircleExclamation}
              label={t('stock_health.outOfStock')}
              orgThreshold={orgThreshold}
              collapsed={!!collapsed.out}
              onToggle={() => toggleSection('out')}
            />
          )}
          {flagged.low.length > 0 && (
            <Section
              tier="low"
              items={flagged.low}
              icon={faTriangleExclamation}
              label={t('stock_health.lowStock')}
              orgThreshold={orgThreshold}
              collapsed={!!collapsed.low}
              onToggle={() => toggleSection('low')}
            />
          )}
          {flagged.reorder.length > 0 && (
            <Section
              tier="reorder"
              items={flagged.reorder}
              icon={faArrowTrendDown}
              label={t('stock_health.belowReorder')}
              orgThreshold={orgThreshold}
              collapsed={!!collapsed.reorder}
              onToggle={() => toggleSection('reorder')}
            />
          )}
        </div>
      )}
    </div>
  )
}
