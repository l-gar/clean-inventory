import { Outlet, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faBoxesStacked,
  faCirclePlus,
  faGear,
  faRightFromBracket,
  faShieldHalved,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import styles from './Layout.module.css'

const navItems = [
  {
    to: '/add',
    labelKey: 'nav.addItem',
    icon: <FontAwesomeIcon icon={faCirclePlus} aria-hidden="true" />,
  },
  {
    to: '/inventory',
    labelKey: 'nav.inventory',
    icon: <FontAwesomeIcon icon={faBoxesStacked} aria-hidden="true" />,
  },
  {
    to: '/alerts',
    labelKey: 'nav.alerts',
    icon: <FontAwesomeIcon icon={faBell} aria-hidden="true" />,
    badge: 3,
  },
  {
    to: '/settings',
    labelKey: 'nav.settings',
    icon: <FontAwesomeIcon icon={faGear} aria-hidden="true" />,
  },
]

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'

  const visibleNavItems = isSuperAdmin
    ? [
        ...navItems,
        {
          to: '/admin',
          labelKey: 'nav.admin',
          icon: <FontAwesomeIcon icon={faShieldHalved} aria-hidden="true" />,
        },
      ]
    : navItems

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3h7v7H3z" />
              <path d="M14 3h7v7h-7z" />
              <path d="M14 14h7v7h-7z" />
              <path d="M3 14h7v7H3z" />
            </svg>
            CleanInv
          </span>

          <button
            type="button"
            className={styles.logoutBtn}
            onClick={logout}
            aria-label={t('nav.logout')}
            title={t('nav.logout')}
          >
            <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.bottomNav}>
        {visibleNavItems.map(({ to, labelKey, icon, badge }) => (
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
    </div>
  )
}
