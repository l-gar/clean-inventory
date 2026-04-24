import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBoxesStacked,
  faBarcode,
  faGear,
  faHeartPulse,
  faShieldHalved,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
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
    to: '/members',
    labelKey: 'nav.members',
    icon: <FontAwesomeIcon icon={faUserGroup} aria-hidden="true" />,
    ownerManagerOnly: true,
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    icon: <FontAwesomeIcon icon={faGear} aria-hidden="true" />,
  },
]

export default function BottomNav() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const isOwnerOrManager = user?.role === 'org_owner' || user?.role === 'manager'

  const visibleItems = [
    ...NAV_ITEMS.filter((item) => !item.ownerManagerOnly || isOwnerOrManager),
    ...(isSuperAdmin
      ? [{ to: '/admin', labelKey: 'nav.admin', icon: <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" /> }]
      : []),
  ]

  return (
    <nav className={styles.bottomNav}>
      {visibleItems.map(({ to, labelKey, icon, badge }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
          }
        >
          <span className={styles.navIcon}>
            {icon}
            {badge && <span className={styles.badge}>{badge}</span>}
          </span>
          <span className={styles.navLabel}>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
