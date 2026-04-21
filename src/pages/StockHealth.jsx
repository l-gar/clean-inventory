import { useEffect, useMemo } from 'react'
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
import LoadingScreen from '../components/LoadingScreen'
import styles from './StockHealth.module.css'

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

  const fetchInventory   = useStore((s) => s.fetchInventory)
  const inventory        = useStore((s) => s.inventory)
  const inventoryLoading = useStore((s) => s.inventoryLoading)
  const inventoryError   = useStore((s) => s.inventoryError)
  const fetchLocations   = useStore((s) => s.fetchLocations)
  const locations        = useStore((s) => s.locations)
  const locationsLoading = useStore((s) => s.locationsLoading)

  useEffect(() => {
    if (!user) return
    fetchLocations(user.email, user.orgId)
    fetchInventory(user.email, user.orgId, 'all')
  }, [user, fetchLocations, fetchInventory])

  const orgThreshold = Number(user?.lowStockThreshold ?? user?.low_stock_threshold ?? 0)

  const accessibleIds = useMemo(
    () => new Set(locations.map((l) => l.location_id)),
    [locations]
  )

  const flagged = useMemo(() => {
    const out = [], low = [], reorder = []
    for (const raw of inventory) {
      // track_stock arrives as boolean or Sheets string — absent field defaults to tracked
      const rawTrack = raw.track_stock ?? raw.trackStock
      const isTracked = rawTrack == null
        ? true
        : rawTrack === true || String(rawTrack).toUpperCase() === 'TRUE'
      if (!isTracked) continue

      const locId = raw.location_id ?? raw.locationId ?? ''
      // Only filter by location once locations have loaded; empty set means still loading
      if (accessibleIds.size > 0 && !accessibleIds.has(locId)) continue

      // Normalize raw API field names so helper functions get consistent keys
      const item = {
        ...raw,
        itemId:        raw.stock_id      ?? raw.stockId      ?? raw.itemId      ?? '',
        itemName:      raw.item_name     ?? raw.itemName     ?? '',
        location_id:   locId,
        location_name: raw.location_name ?? raw.locationName ?? '',
        quantity:      raw.quantity      ?? 0,
        unit:          raw.unit          ?? '',
        lowStockThreshold: Number(
          raw.item_low_stock_threshold ?? raw.itemLowStockThreshold ?? raw.lowStockThreshold ?? 0
        ),
        reorder_point: Number(raw.reorder_point ?? raw.reorderPoint ?? 0),
      }

      const tier = classifyItem(item, orgThreshold)
      if (tier === 'out') out.push(item)
      else if (tier === 'low') low.push(item)
      else if (tier === 'reorder') reorder.push(item)
    }
    return { out, low, reorder }
  }, [inventory, accessibleIds, orgThreshold])

  const isFirstLoad =
    (inventoryLoading || locationsLoading) && !inventory.length && !locations.length
  if (isFirstLoad) return <LoadingScreen />

  const totalFlagged = flagged.out.length + flagged.low.length + flagged.reorder.length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('stock_health.title')}</h1>
        <p className={styles.subtitle}>{t('stock_health.subtitle')}</p>
      </div>

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

      {inventoryError && (
        <p className={styles.errorMsg}>{t('stock_health.errorLoad')}</p>
      )}

      {totalFlagged === 0 && !inventoryLoading ? (
        <div className={styles.empty}>
          <FontAwesomeIcon icon={faCircleCheck} className={styles.emptyIcon} aria-hidden="true" />
          <p className={styles.emptyTitle}>{t('stock_health.allClear')}</p>
          <p className={styles.emptyHint}>{t('stock_health.allClearHint')}</p>
        </div>
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
