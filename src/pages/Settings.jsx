import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBell,
  faBuilding,
  faCheck,
  faChevronRight,
  faGlobe,
  faLocationDot,
  faMoon,
  faPenToSquare,
  faSliders,
  faUserGroup,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../hooks/useLocations'
import { apiUpdateOrgName, apiUpdateThreshold } from '../store/api'
import { getAvatarColors, getInitials } from '../utils/avatar'
import { version } from '../../package.json'
import styles from './Settings.module.css'

function getDisplayName(email) {
  const local = (email ?? '').split('@')[0]
  return local
    .split(/[._+]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')
}

// ── primitives ────────────────────────────────────────────────────────────────

function Spinner() {
  return <span className={styles.spinner} aria-hidden="true" />
}

function IconBadge({ icon, bg, fg }) {
  return (
    <span className={styles.badge} style={{ background: bg, color: fg }}>
      <FontAwesomeIcon icon={icon} aria-hidden="true" />
    </span>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.thumb} />
    </button>
  )
}

function Divider() {
  return <div className={styles.divider} />
}

// ── Default Location sheet ────────────────────────────────────────────────────

function DefaultLocationSheet({ open, onClose, locations, value, onChange }) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOn : ''}`}
        onClick={onClose}
      />
      <div
        className={`${styles.sheet} ${open ? styles.sheetOn : ''}`}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.sheetHandle} />
        <div className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>{t('settings.business.defaultLocation')}</h2>
          <p className={styles.sheetSubtitle}>{t('settings.business.defaultLocationDesc')}</p>
        </div>
        <div className={styles.sheetList}>
          <button
            type="button"
            className={`${styles.locOption} ${value === '' ? styles.locOptionOn : ''}`}
            onClick={() => { onChange(''); onClose() }}
          >
            <span className={`${styles.locOptionBadge} ${value === '' ? styles.locOptionBadgeOn : ''}`}>
              <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            </span>
            <span className={`${styles.locOptionLabel} ${value === '' ? styles.locOptionLabelOn : ''}`}>
              {t('settings.business.noDefault')}
            </span>
            {value === '' && (
              <FontAwesomeIcon icon={faCheck} className={styles.locOptionCheck} aria-hidden="true" />
            )}
          </button>
          {locations.map((loc) => (
            <button
              key={loc.location_id}
              type="button"
              className={`${styles.locOption} ${value === loc.location_id ? styles.locOptionOn : ''}`}
              onClick={() => { onChange(loc.location_id); onClose() }}
            >
              <span className={`${styles.locOptionBadge} ${value === loc.location_id ? styles.locOptionBadgeOn : ''}`}>
                <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              </span>
              <span className={`${styles.locOptionLabel} ${value === loc.location_id ? styles.locOptionLabelOn : ''}`}>
                {loc.location_name}
              </span>
              {value === loc.location_id && (
                <FontAwesomeIcon icon={faCheck} className={styles.locOptionCheck} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

// ── main ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const { locations } = useLocations()
  const [lang, setLang] = useState(i18n.language)

  const isOwner = user?.role === 'org_owner'
  const canManageLocations = user?.role === 'org_owner' || user?.role === 'manager'

  // ── Org name editing ──────────────────────────────────────────────────────
  const [orgName, setOrgName] = useState(user?.orgName ?? '')
  const [orgNameEditing, setOrgNameEditing] = useState(false)
  const [orgNameSaving, setOrgNameSaving] = useState(false)
  const [orgNameError, setOrgNameError] = useState('')
  const orgNameDirty = orgName.trim() !== (user?.orgName ?? '').trim()

  useEffect(() => { setOrgName(user?.orgName ?? '') }, [user?.orgName])

  async function handleOrgNameSave() {
    const trimmed = orgName.trim()
    if (!trimmed || !orgNameDirty) return
    setOrgNameSaving(true)
    setOrgNameError('')
    try {
      await apiUpdateOrgName({ email: user.email, orgId: user.orgId, orgName: trimmed })
      updateUser({ orgName: trimmed })
      setOrgNameEditing(false)
    } catch {
      setOrgNameError(t('settings.business.orgNameError'))
    } finally {
      setOrgNameSaving(false)
    }
  }

  function handleOrgNameCancel() {
    setOrgName(user?.orgName ?? '')
    setOrgNameError('')
    setOrgNameEditing(false)
  }

  // ── Default location ──────────────────────────────────────────────────────
  const defaultLocKey = user?.email ? `cleaninv_default_location_${user.email}` : null

  const [defaultLocation, setDefaultLocation] = useState(
    () => (defaultLocKey ? (localStorage.getItem(defaultLocKey) ?? '') : '')
  )
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)

  useEffect(() => {
    if (!defaultLocKey) return
    if (defaultLocation) localStorage.setItem(defaultLocKey, defaultLocation)
    else localStorage.removeItem(defaultLocKey)
  }, [defaultLocation, defaultLocKey])

  const defaultLocationName =
    locations.find((l) => l.location_id === defaultLocation)?.location_name ?? ''

  // ── Prefs (toggles) ───────────────────────────────────────────────────────
  const [prefs, setPrefs] = useState(() => ({
    lowStockAlerts: true,
    outOfStockAlerts: true,
    darkMode: localStorage.getItem('darkMode') === 'true',
  }))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode)
    localStorage.setItem('darkMode', prefs.darkMode)
  }, [prefs.darkMode])

  function set(key) {
    return (val) => setPrefs((p) => ({ ...p, [key]: val }))
  }

  // ── Language ──────────────────────────────────────────────────────────────
  function handleLangChange(e) {
    const next = e.target.value
    i18n.changeLanguage(next)
    localStorage.setItem('cleaninv_language', next)
    setLang(next)
  }

  // ── Threshold ─────────────────────────────────────────────────────────────
  const [thresholdSaving, setThresholdSaving] = useState(false)
  const [thresholdError, setThresholdError] = useState('')
  const [threshold, setThreshold] = useState(
    String(user?.low_stock_threshold ?? user?.lowStockThreshold ?? '20')
  )
  const savedThreshold = String(user?.low_stock_threshold ?? user?.lowStockThreshold ?? '20')
  const thresholdDirty = threshold !== savedThreshold

  async function handleThresholdSave() {
    if (!thresholdDirty) return
    setThresholdSaving(true)
    setThresholdError('')
    try {
      await apiUpdateThreshold({ email: user.email, orgId: user.orgId, threshold })
      updateUser({ low_stock_threshold: threshold })
    } catch {
      setThresholdError(t('settings.alerts.thresholdError'))
    } finally {
      setThresholdSaving(false)
    }
  }

  // ── Role label ────────────────────────────────────────────────────────────
  const roleLabel = user?.role ? t(`settings.role.${user.role}`, user.role) : ''

  return (
    <div className={styles.page}>

      {/* Profile header */}
      <div className={styles.profileCard}>
        <div className={styles.profileRow}>
          <div className={styles.avatar} style={getAvatarColors(user?.email ?? '')}>{getInitials(user?.email)}</div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>{getDisplayName(user?.email)}</div>
            <div className={styles.profileEmail}>{user?.email}</div>
          </div>
          <div className={styles.profileMeta}>
            {roleLabel && <span className={styles.roleBadge}>{roleLabel}</span>}
            {user?.orgName && <span className={styles.profileOrgName}>{user.orgName}</span>}
          </div>
        </div>
      </div>

      <div className={styles.body}>

        {/* Business */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t('settings.sections.business')}</span>
          <div className={styles.card}>

            {/* Business Name — org_owner only */}
            {isOwner && (
              <div className={styles.businessRow}>
                <div className={styles.businessRowTop}>
                  <IconBadge icon={faBuilding} bg="var(--green-50)" fg="var(--green-600)" />
                  <div className={styles.rowText}>
                    <span className={styles.rowLabel}>{t('settings.business.businessName')}</span>
                    {!orgNameEditing && (
                      <span className={styles.rowDesc}>{user?.orgName ?? '—'}</span>
                    )}
                  </div>
                  {!orgNameEditing && (
                    <button
                      type="button"
                      className={styles.pencilBtn}
                      onClick={() => {
                        setOrgName(user?.orgName ?? '')
                        setOrgNameError('')
                        setOrgNameEditing(true)
                      }}
                      aria-label={t('settings.business.orgNameEdit')}
                    >
                      <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {orgNameEditing && (
                  <div className={styles.businessEditForm}>
                    <input
                      className={styles.editInput}
                      value={orgName}
                      autoFocus
                      onChange={(e) => { setOrgName(e.target.value); setOrgNameError('') }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleOrgNameSave()
                        if (e.key === 'Escape') handleOrgNameCancel()
                      }}
                    />
                    {orgNameError && <span className={styles.rowError}>{orgNameError}</span>}
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={handleOrgNameCancel}
                        disabled={orgNameSaving}
                      >
                        {t('settings.business.orgNameCancel')}
                      </button>
                      <button
                        type="button"
                        className={styles.saveBtn}
                        onClick={handleOrgNameSave}
                        disabled={orgNameSaving || !orgName.trim() || !orgNameDirty}
                      >
                        {orgNameSaving
                          ? <><Spinner />{t('settings.business.orgNameSaving')}</>
                          : t('settings.business.orgNameSave')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isOwner && <Divider />}

            {/* Default Location */}
            <button
              type="button"
              className={styles.navRow}
              onClick={() => setLocationSheetOpen(true)}
            >
              <IconBadge icon={faLocationDot} bg="var(--emerald-50)" fg="var(--emerald-500)" />
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.business.defaultLocation')}</span>
                <span className={styles.rowDesc}>{t('settings.business.defaultLocationDesc')}</span>
              </div>
              <div className={styles.navRight}>
                <span className={styles.navValue}>
                  {defaultLocationName || t('settings.business.noDefault')}
                </span>
                <FontAwesomeIcon icon={faChevronRight} className={styles.navChevron} aria-hidden="true" />
              </div>
            </button>

          </div>
        </div>

        {/* Organization — owners & managers only */}
        {canManageLocations && (
          <div className={styles.section}>
            <span className={styles.sectionLabel}>{t('settings.sections.organization')}</span>
            <div className={styles.card}>
              <button
                type="button"
                className={styles.navRow}
                onClick={() => navigate('/members')}
              >
                <IconBadge icon={faUserGroup} bg="var(--green-50)" fg="var(--green-600)" />
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>{t('settings.organization.manageMembers')}</span>
                  <span className={styles.rowDesc}>{t('settings.organization.manageMembersDesc')}</span>
                </div>
                <FontAwesomeIcon icon={faChevronRight} className={styles.navChevron} aria-hidden="true" />
              </button>

              <Divider />

              <button
                type="button"
                className={styles.navRow}
                onClick={() => navigate('/locations', { state: { fromSettings: true } })}
              >
                <IconBadge icon={faLocationDot} bg="var(--emerald-50)" fg="var(--emerald-500)" />
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>{t('settings.organization.manageLocations')}</span>
                  <span className={styles.rowDesc}>{t('settings.organization.manageLocationsDesc')}</span>
                </div>
                <div className={styles.navRight}>
                  <span className={styles.navValue}>
                    {t('settings.organization.locCount', { count: locations.length })}
                  </span>
                  <FontAwesomeIcon icon={faChevronRight} className={styles.navChevron} aria-hidden="true" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Alerts */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t('settings.sections.alerts')}</span>
          <div className={styles.card}>

            <div className={styles.row}>
              <IconBadge icon={faBell} bg="var(--amber-100)" fg="var(--amber-600)" />
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.alerts.lowStock')}</span>
                <span className={styles.rowDesc}>{t('settings.alerts.lowStockDesc')}</span>
              </div>
              <Toggle checked={prefs.lowStockAlerts} onChange={set('lowStockAlerts')} />
            </div>

            <Divider />

            <div className={styles.row}>
              <IconBadge icon={faBell} bg="var(--red-50)" fg="var(--red-600)" />
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.alerts.outOfStock')}</span>
                <span className={styles.rowDesc}>{t('settings.alerts.outOfStockDesc')}</span>
              </div>
              <Toggle checked={prefs.outOfStockAlerts} onChange={set('outOfStockAlerts')} />
            </div>

            {isOwner && (
              <>
                <Divider />
                <div className={styles.row}>
                  <IconBadge icon={faSliders} bg="var(--amber-50)" fg="var(--amber-500)" />
                  <div className={styles.rowText}>
                    <span className={styles.rowLabel}>{t('settings.alerts.threshold')}</span>
                    <span className={styles.rowDesc}>{t('settings.alerts.thresholdDesc')}</span>
                    {thresholdError && <span className={styles.rowError}>{thresholdError}</span>}
                  </div>
                  <div className={styles.numericInput}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className={styles.numberField}
                      value={threshold}
                      onChange={(e) => { setThreshold(e.target.value); setThresholdError('') }}
                    />
                    <span className={styles.numberSuffix}>%</span>
                  </div>
                </div>
                {thresholdDirty && (
                  <div className={styles.thresholdSaveWrap}>
                    <button
                      type="button"
                      className={styles.saveBtn}
                      onClick={handleThresholdSave}
                      disabled={thresholdSaving}
                    >
                      {thresholdSaving
                        ? <><Spinner />{t('settings.business.orgNameSaving')}</>
                        : t('settings.business.orgNameSave')}
                    </button>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {/* Display */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t('settings.sections.display')}</span>
          <div className={styles.card}>
            <div className={styles.row}>
              <IconBadge icon={faMoon} bg="var(--gray-800)" fg="var(--color-page)" />
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.display.darkMode')}</span>
                <span className={styles.rowDesc}>{t('settings.display.darkModeDesc')}</span>
              </div>
              <Toggle checked={prefs.darkMode} onChange={set('darkMode')} />
            </div>
          </div>
        </div>

        {/* Language */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>{t('settings.sections.language')}</span>
          <div className={styles.card}>
            <div className={styles.row}>
              <IconBadge icon={faGlobe} bg="var(--violet-50)" fg="var(--violet-600)" />
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.language.label')}</span>
                <span className={styles.rowDesc}>{t('settings.language.desc')}</span>
              </div>
              <select
                className={styles.langSelect}
                value={lang}
                onChange={handleLangChange}
              >
                <option value="en">{t('settings.language.en')}</option>
                <option value="es">{t('settings.language.es')}</option>
              </select>
            </div>
          </div>
        </div>

        <p className={styles.version}>CleanInv v{version}</p>

      </div>

      <DefaultLocationSheet
        open={locationSheetOpen}
        onClose={() => setLocationSheetOpen(false)}
        locations={locations}
        value={defaultLocation}
        onChange={setDefaultLocation}
      />

    </div>
  )
}
