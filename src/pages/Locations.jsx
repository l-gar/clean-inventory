import { useState, useEffect, useCallback } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronLeft,
  faLocationDot,
  faPenToSquare,
  faRightFromBracket,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { apiAddLocation, apiUpdateLocation, apiRemoveLocation } from '../store/api'
import { useStore } from '../store'
import LoadingScreen from '../components/LoadingScreen'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import ConfirmBlock from '../components/ConfirmBlock'
import styles from './Locations.module.css'

export default function Locations() {
  const { t } = useTranslation()
  const { user, logout, setHasLocations, hasLocations } = useAuth()
  const navigate = useNavigate()

  // Gate mode: user has no locations yet — rendered outside Layout with its
  // own standalone header and no bottom navigation.
  // App mode: user already has locations, rendered inside Layout which
  // provides the header and bottom navigation.
  const isGate = hasLocations === false

  const fetchLocations    = useStore((s) => s.fetchLocations)
  const invalidateLocations = useStore((s) => s.invalidateLocations)

  const [locations, setLocations] = useState([])
  const [fetching, setFetching] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // ── Bottom sheet state ───────────────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null) // null = add, obj = edit
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // ── Delete confirm state ─────────────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  // Role-based permissions
  const canEdit = user?.role === 'org_owner' || user?.role === 'manager'
  const canDelete = user?.role === 'org_owner'

  // ── Data loading ─────────────────────────────────────────────────────────
  // Uses the store so the result is cached and shared with other views
  // (e.g. ScanUpdate / LocationSelect). After any mutation invalidateLocations()
  // is called first so the cache is busted before re-fetching.
  const loadLocations = useCallback(async () => {
    setFetching(true)
    setLoadError(null)
    try {
      const locs = await fetchLocations(user.email, user.orgId)
      setLocations(locs)
    } catch {
      setLoadError(t('locations.error_load'))
    } finally {
      setFetching(false)
    }
  }, [user.email, user.orgId, t, fetchLocations])

  useEffect(() => { loadLocations() }, [loadLocations])

  usePullToRefresh(useCallback(async () => {
    invalidateLocations()
    try {
      const locs = await fetchLocations(user.email, user.orgId)
      setLocations(locs)
    } catch {}
  }, [invalidateLocations, fetchLocations, user.email, user.orgId]))

  // ── Sheet helpers ─────────────────────────────────────────────────────────
  function openAdd() {
    setEditTarget(null)
    setNameInput('')
    setSaveError(null)
    setSheetOpen(true)
  }

  function openEdit(loc) {
    setEditTarget(loc)
    setNameInput(loc.location_name)
    setSaveError(null)
    setSheetOpen(true)
  }

  function closeSheet() {
    if (saving) return
    setSheetOpen(false)
    setEditTarget(null)
    setNameInput('')
    setSaveError(null)
  }

  // ── Save handler ──────────────────────────────────────────────────────────
  async function handleSave() {
    const trimmed = nameInput.trim()
    if (!trimmed) {
      setSaveError(t('locations.error_empty'))
      return
    }

    const isDupe = locations.some(
      (l) =>
        l.location_name.toLowerCase() === trimmed.toLowerCase() &&
        l.location_id !== editTarget?.location_id,
    )
    if (isDupe) {
      setSaveError(t('locations.error_duplicate'))
      return
    }

    const wasEmpty = locations.length === 0 && !editTarget

    setSaving(true)
    setSaveError(null)
    try {
      if (editTarget) {
        await apiUpdateLocation({
          email: user.email,
          orgId: user.orgId,
          locationId: editTarget.location_id,
          locationName: trimmed,
        })
      } else {
        await apiAddLocation({
          email: user.email,
          orgId: user.orgId,
          locationName: trimmed,
        })
      }

      closeSheet()
      invalidateLocations()
      await loadLocations()

      if (wasEmpty) {
        // First location ever — lift the gate and drop into the main app
        setHasLocations(true)
        navigate('/scan-update', { replace: true })
      }
    } catch {
      setSaveError(t('locations.error_save'))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────────
  async function handleDelete(locationId) {
    setDeleting(true)
    setDeleteError(null)
    try {
      await apiRemoveLocation({
        email: user.email,
        orgId: user.orgId,
        locationId,
      })
      setConfirmDeleteId(null)
      invalidateLocations()
      await loadLocations()
    } catch {
      setDeleteError(t('locations.error_delete'))
    } finally {
      setDeleting(false)
    }
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  if (fetching) {
    return <LoadingScreen message={t('locations.loading')} />
  }

  // ── Gate header — shown only in gate mode (outside Layout) ───────────────
  const GateHeader = (
    <header className={styles.appHeader}>
      <div className={styles.appHeaderInner}>
        <span className={styles.logo}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
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
  )

  // ── Load error ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className={`${styles.page} ${!isGate ? styles.pageApp : ''}`}>
        {isGate && GateHeader}
        {!isGate && (
          <div className={styles.backRow}>
            <button
              type="button"
              className={styles.backLinkBtn}
              onClick={() => navigate('/settings')}
            >
              <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
              {t('locations.back')}
            </button>
          </div>
        )}
        <ErrorState
          message={loadError}
          onRetry={loadLocations}
          retryLabel={t('locations.retry')}
        />
      </div>
    )
  }

  const isEmpty = locations.length === 0

  return (
    <div className={`${styles.page} ${!isGate ? styles.pageApp : ''}`}>

      {/* Gate header — only in gate mode */}
      {isGate && GateHeader}

      {/* Scrollable content area */}
      <div className={styles.content}>

        {/* Back button — app mode only (Layout header has no back button) */}
        {!isGate && (
          <div className={styles.backRow}>
            <button
              type="button"
              className={styles.backLinkBtn}
              onClick={() => navigate('/settings')}
            >
              <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
              {t('locations.back')}
            </button>
          </div>
        )}

        {isEmpty ? (

          /* Empty state */
          <EmptyState
            icon={faLocationDot}
            iconCircle
            fill
            title={t('locations.empty_title')}
            body={t('locations.empty_body')}
            action={canEdit ? { label: t('locations.empty_cta'), onClick: openAdd } : undefined}
          />

        ) : (

          /* Location list */
          <>
            <div className={styles.listHeader}>
              <h1 className={styles.pageTitle}>{t('locations.title')}</h1>
              <p className={styles.pageSubtitle}>
                {t('locations.subtitle', { orgName: user.orgName })}
              </p>
            </div>

            <ul className={styles.list}>
              {locations.map((loc) => (
                <li key={loc.location_id} className={styles.card}>
                  {confirmDeleteId === loc.location_id ? (

                    <ConfirmBlock
                      message={t('locations.delete_confirm')}
                      confirmLabel={t('locations.delete_confirm_yes')}
                      cancelLabel={t('locations.delete_confirm_no')}
                      onConfirm={() => handleDelete(loc.location_id)}
                      onCancel={() => { setConfirmDeleteId(null); setDeleteError(null) }}
                      busy={deleting}
                      error={deleteError}
                    />

                  ) : (

                    /* Normal card */
                    <>
                      <div className={styles.cardLeft}>
                        <span className={styles.cardIcon}>
                          <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                        </span>
                        <span className={styles.cardName}>{loc.location_name}</span>
                      </div>
                      <div className={styles.cardActions}>
                        {canEdit && (
                          <button
                            className={styles.iconBtn}
                            type="button"
                            onClick={() => openEdit(loc)}
                            aria-label={t('locations.edit_aria')}
                          >
                            <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            type="button"
                            onClick={() => {
                              setConfirmDeleteId(loc.location_id)
                              setDeleteError(null)
                            }}
                            aria-label={t('locations.delete_aria')}
                          >
                            <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </>

                  )}
                </li>
              ))}
            </ul>
          </>

        )}

      </div>{/* /content */}

      {/* FAB */}
      {canEdit && (
        <button
          className={styles.fab}
          type="button"
          onClick={openAdd}
          aria-label={t('locations.add_fab')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Bottom sheet */}
      <div
        className={`${styles.backdrop} ${sheetOpen ? styles.backdropVisible : ''}`}
        onClick={closeSheet}
      >
        <div
          className={`${styles.sheet} ${sheetOpen ? styles.sheetOpen : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.sheetHandle} />

          <h2 className={styles.sheetTitle}>
            {editTarget ? t('locations.edit_title') : t('locations.add_title')}
          </h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="locationName">
              {t('locations.name_label')}
            </label>
            <input
              id="locationName"
              className={`${styles.input}${saveError ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); setSaveError(null) }}
              placeholder={t('locations.name_placeholder')}
              autoFocus={sheetOpen}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
              maxLength={80}
            />
            {saveError && <p className={styles.fieldError}>{saveError}</p>}
          </div>

          <div className={styles.sheetButtons}>
            <button
              className={styles.btnPrimary}
              type="button"
              onClick={handleSave}
              disabled={saving || !nameInput.trim()}
            >
              {saving ? t('locations.saving') : t('locations.save')}
            </button>
            <button
              className={styles.btnSecondary}
              type="button"
              onClick={closeSheet}
              disabled={saving}
            >
              {t('locations.cancel')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
