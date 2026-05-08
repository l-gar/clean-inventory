import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBoxesStacked,
  faBarcode,
  faGear,
  faHeartPulse,
  faClockRotateLeft,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { normalizeItem } from '../domain/normalize'
import { classifyItem } from '../utils/stockHealth'
import styles from './BottomNav.module.css'

const NAV_ITEMS = [
  {
    to: '/scan-update',
    labelKey: 'nav.scan_update',
    icon: <FontAwesomeIcon icon={faBarcode} aria-hidden="true" />,
  },
  {
    to: '/inventory',
    labelKey: 'nav.inventory',
    icon: <FontAwesomeIcon icon={faBoxesStacked} aria-hidden="true" />,
  },
  {
    to: '/stock-health',
    labelKey: 'nav.stock_health',
    icon: <FontAwesomeIcon icon={faHeartPulse} aria-hidden="true" />,
    ownerManagerOnly: true,
  },
  {
    to: '/activity-log',
    labelKey: 'nav.activity_log',
    icon: <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />,
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    icon: <FontAwesomeIcon icon={faGear} aria-hidden="true" />,
  },
]

// Routes that live under Settings and should keep it highlighted
const SETTINGS_SUBROUTES = new Set(['/members'])

export default function BottomNav() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname } = useLocation()
  const isSuperAdmin = user?.role === 'super_admin'
  const isOwnerOrManager = user?.role === 'org_owner' || user?.role === 'manager'

  const inventory           = useStore((s) => s.inventory)
  const inventoryLocationId = useStore((s) => s.inventoryLocationId)
  const alertPrefs          = useStore((s) => s.alertPrefs)
  const orgThreshold = Number(user?.low_stock_threshold ?? user?.lowStockThreshold ?? 0)

  const stockAlertCount = useMemo(() => {
    if (!isOwnerOrManager) return 0
    // Prefer the 'all' inventory; fall back to sessionStorage if current view is location-scoped
    let source = inventory
    if (inventoryLocationId !== 'all') {
      try {
        const raw = sessionStorage.getItem(`cleaninv_inventory_${user?.email}_all`)
        source = raw ? JSON.parse(raw) : []
      } catch { source = [] }
    }
    let count = 0
    for (const raw of source) {
      const item = normalizeItem(raw)
      if (!item.track_stock) continue
      const tier = classifyItem(item, orgThreshold)
      if (tier === 'out'    && alertPrefs.outOfStock) count++
      else if (tier === 'low'    && alertPrefs.lowStock)   count++
      else if (tier === 'reorder' && alertPrefs.reorder)   count++
    }
    return count
  }, [inventory, inventoryLocationId, alertPrefs, orgThreshold, isOwnerOrManager, user?.email])

  const visibleItems = [
    ...NAV_ITEMS.filter((item) => !item.ownerManagerOnly || isOwnerOrManager),
    ...(isSuperAdmin
      ? [{ to: '/admin', labelKey: 'nav.admin', icon: <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" /> }]
      : []),
  ]

  return (
    <nav className={styles.bottomNav}>
      {visibleItems.map(({ to, labelKey, icon }) => {
        const badge = to === '/stock-health' && stockAlertCount > 0
          ? (stockAlertCount > 99 ? '99+' : stockAlertCount)
          : null
        return (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive || (to === '/settings' && SETTINGS_SUBROUTES.has(pathname)) ? styles.navItemActive : ''}`
            }
          >
            <span className={styles.navIcon}>
              {icon}
              {badge !== null && <span className={styles.badge}>{badge}</span>}
            </span>
            <span className={styles.navLabel}>{t(labelKey)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
