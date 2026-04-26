import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faTriangleExclamation,
  faArrowTrendDown,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { normalizeItem } from '../domain/normalize'
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

function effectiveThreshold(item, orgThreshold) {
  const t = Number(item.lowStockThreshold ?? 0)
  return t > 0 ? t : Number(orgThreshold ?? 0)
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

function Section({ tier, items, icon, label, orgThreshold, t }) {
  return (
    <div className={styles.section}>
      <div className={`${styles.sectionHeader} ${styles[`tier_${tier}`]}`}>
        <FontAwesomeIcon icon={icon} aria-hidden="true" />
        <span>{label}</span>
        <span className={styles.sectionCount}>{items.length}</span>
      </div>
      {items.map((item) => (
        <ItemCard
          key={`${item.itemId}_${item.location_id}`}
          item={item}
          tier={tier}
          orgThreshold={orgThreshold}
          t={t}
        />
      ))}
    </div>
  )
}

function ItemCard({ item, tier, orgThreshold, t }) {
  const qty = Number(item.quantity)
  const threshold = effectiveThreshold(item, orgThreshold)
  const rp = Number(item.reorder_point ?? 0)
  const getLocationName = useStore((s) => s.getLocationName)
  const locationName = getLocationName(item.location_id, item.location_name)

  return (
    <div className={`${styles.itemCard} ${styles[`card_${tier}`]}`}>
      <div className={styles.cardTop}>
        <div className={styles.cardNameGroup}>
          <span className={styles.itemName}>{item.itemName}</span>
          {locationName && (
            <span className={styles.locationLabel}>{locationName}</span>
          )}
        </div>
        <span className={`${styles.qtyChip} ${styles[`chip_${tier}`]}`}>
          {qty}{item.unit ? ` ${item.unit}` : ''}
        </span>
      </div>
      {((tier === 'low' && threshold > 0) || (tier === 'reorder' && rp > 0)) && (
        <div className={styles.cardMeta}>
          {tier === 'low' && threshold > 0 && (
            <span className={styles.metaNote}>{t('stock_health.alertBelow')} {threshold}</span>
          )}
          {tier === 'reorder' && rp > 0 && (
            <span className={styles.metaNote}>{t('stock_health.reorderAt')} {rp}</span>
          )}
        </div>
      )}
    </div>
  )
}

export default function StockHealth() {
  const { t } = useTranslation()
  const { user } = useAuth()

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

  // Stale-first: seed from sessionStorage so content renders on first paint
  const [items, setItems]               = useState(() => readSessionInventory(user?.email) ?? [])
  const [localLocations, setLocalLocs]  = useState(() => readSessionLocations(user?.email) ?? [])

  useEffect(() => {
    if (!user) return
    fetchLocations(user.email, user.orgId).catch(() => {})
    fetchInventory(user.email, user.orgId, 'all').catch(() => {})
  }, [user, fetchLocations, fetchInventory])

  usePullToRefresh(useCallback(async () => {
    invalidateInventory()
    await fetchInventory(user.email, user.orgId, 'all').catch(() => {})
  }, [invalidateInventory, fetchInventory, user.email, user.orgId]))

  // Sync store → local once fresh data arrives
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
  // Show full-screen loader only when there is truly nothing to display yet
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
      // Only filter by location once locations have loaded; empty set means still loading
      if (accessibleIds.size > 0 && !accessibleIds.has(item.location_id)) continue

      const tier = classifyItem(item, orgThreshold)
      if (tier === 'out') out.push(item)
      else if (tier === 'low') low.push(item)
      else if (tier === 'reorder') reorder.push(item)
    }
    return { out, low, reorder }
  }, [items, accessibleIds, orgThreshold])

  const totalFlagged = flagged.out.length + flagged.low.length + flagged.reorder.length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('stock_health.title')}</h1>
        <p className={styles.subtitle}>{t('stock_health.subtitle')}</p>
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

      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${styles.summaryOut}`}>
          <span className={styles.summaryNum}>{flagged.out.length}</span>
          <span className={styles.summaryLabel}>{t('stock_health.outOfStock')}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryLow}`}>
          <span className={styles.summaryNum}>{flagged.low.length}</span>
          <span className={styles.summaryLabel}>{t('stock_health.lowStock')}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryReorder}`}>
          <span className={styles.summaryNum}>{flagged.reorder.length}</span>
          <span className={styles.summaryLabel}>{t('stock_health.belowReorder')}</span>
        </div>
      </div>

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
              t={t}
            />
          )}
          {flagged.low.length > 0 && (
            <Section
              tier="low"
              items={flagged.low}
              icon={faTriangleExclamation}
              label={t('stock_health.lowStock')}
              orgThreshold={orgThreshold}
              t={t}
            />
          )}
          {flagged.reorder.length > 0 && (
            <Section
              tier="reorder"
              items={flagged.reorder}
              icon={faArrowTrendDown}
              label={t('stock_health.belowReorder')}
              orgThreshold={orgThreshold}
              t={t}
            />
          )}
        </div>
      )}
    </div>
  )
}
