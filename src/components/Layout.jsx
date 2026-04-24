import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import BottomNav from './BottomNav'
import styles from './Layout.module.css'

export default function Layout() {
  const { t } = useTranslation()
  const { logout } = useAuth()

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

      <BottomNav />
    </div>
  )
}
