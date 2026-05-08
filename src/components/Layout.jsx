import { useRef, useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRightFromBracket, faArrowsRotate } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { PullToRefreshContext } from '../context/PullToRefreshContext'
import BottomNav from './BottomNav'
import styles from './Layout.module.css'

const PULL_THRESHOLD = 72
const PULL_MAX       = 90
const PULL_RESIST    = 0.45

export default function Layout() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false)

  const mainRef         = useRef(null)
  const refreshCbRef    = useRef(null)
  const isRefreshingRef = useRef(false)
  const startYRef       = useRef(0)
  const pullingRef      = useRef(false)
  const pullDistRef     = useRef(0)

  const [pullDist, setPullDist]   = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const register = useCallback((cb) => { refreshCbRef.current = cb }, [])

  useEffect(() => {
    const el = mainRef.current
    if (!el) return

    function onTouchStart(e) {
      if (el.scrollTop > 0 || isRefreshingRef.current) return
      startYRef.current = e.touches[0].clientY
      pullingRef.current = false
    }

    function onTouchMove(e) {
      const dy = e.touches[0].clientY - startYRef.current
      if (!pullingRef.current) {
        if (dy > 4 && el.scrollTop === 0) {
          pullingRef.current = true
          setIsDragging(true)
        } else {
          return
        }
      }
      if (el.scrollTop > 0) {
        pullingRef.current = false
        setIsDragging(false)
        setPullDist(0)
        pullDistRef.current = 0
        return
      }
      e.preventDefault()
      const d = Math.min(dy * PULL_RESIST, PULL_MAX)
      pullDistRef.current = d
      setPullDist(d)
    }

    function onTouchEnd() {
      if (!pullingRef.current) return
      pullingRef.current = false
      setIsDragging(false)
      const dist = pullDistRef.current
      pullDistRef.current = 0
      setPullDist(0)
      if (dist >= PULL_THRESHOLD && refreshCbRef.current && !isRefreshingRef.current) {
        isRefreshingRef.current = true
        const result = refreshCbRef.current()
        const done = () => { isRefreshingRef.current = false }
        if (result && typeof result.finally === 'function') result.finally(done)
        else done()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  return (
    <PullToRefreshContext.Provider value={{ register }}>
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
              onClick={() => setLogoutSheetOpen(true)}
              aria-label={t('nav.logout')}
              title={t('nav.logout')}
            >
              <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main ref={mainRef} className={styles.main}>
          <div
            className={`${styles.ptrWrap} ${isDragging ? styles.ptrDragging : ''}`}
            style={{ height: pullDist }}
            aria-hidden="true"
          >
            <FontAwesomeIcon
              icon={faArrowsRotate}
              className={`${styles.ptrIcon} ${pullDist >= PULL_THRESHOLD ? styles.ptrIconReady : ''}`}
              style={{ opacity: Math.min(pullDist / PULL_THRESHOLD, 1) }}
            />
          </div>
          <Outlet />
        </main>

        <BottomNav />

        <div
          className={`${styles.backdrop} ${logoutSheetOpen ? styles.backdropOn : ''}`}
          onClick={() => setLogoutSheetOpen(false)}
        />
        <div
          className={`${styles.sheet} ${logoutSheetOpen ? styles.sheetOn : ''}`}
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.logout')}
        >
          <div className={styles.sheetHandle} />
          <div className={styles.sheetHeader}>
            <p className={styles.sheetTitle}>{t('logout_confirm_title')}</p>
            <p className={styles.sheetEmail}>{user?.email}</p>
          </div>
          <div className={styles.sheetActions}>
            <button
              type="button"
              className={styles.signOutBtn}
              onClick={logout}
            >
              <FontAwesomeIcon icon={faRightFromBracket} aria-hidden="true" />
              {t('nav.logout')}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setLogoutSheetOpen(false)}
            >
              {t('cancel')}
            </button>
          </div>
        </div>

      </div>
    </PullToRefreshContext.Provider>
  )
}
