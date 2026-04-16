import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChevronRight,
  faDownload,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { callAppsScript } from '../utils/appsScript'
import LocationSelect from '../components/LocationSelect'
import styles from './Settings.module.css'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

function SettingsRow({ label, description, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description && <span className={styles.rowDesc}>{description}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [lang, setLang] = useState(i18n.language)

  const isOwner = user?.role === 'org_owner'
  const canManageLocations = user?.role === 'org_owner' || user?.role === 'manager'

  // ── Org name editing (org_owner only) ─────────────────────────────────────
  const [orgName, setOrgName] = useState(user?.orgName ?? '')
  const [orgNameEditing, setOrgNameEditing] = useState(false)
  const [orgNameSaving, setOrgNameSaving] = useState(false)
  const [orgNameError, setOrgNameError] = useState('')
  const orgNameDirty = orgName.trim() !== (user?.orgName ?? '').trim()

  useEffect(() => {
    setOrgName(user?.orgName ?? '')
  }, [user?.orgName])

  async function handleOrgNameSave() {
    const trimmed = orgName.trim()
    if (!trimmed || !orgNameDirty) return
    setOrgNameSaving(true)
    setOrgNameError('')
    try {
      await callAppsScript('updateOrgName', {
        email: user.email,
        orgId: user.orgId,
        orgName: trimmed,
      })
      updateUser({ orgName: trimmed })
      setOrgNameEditing(false)
    } catch {
      setOrgNameError(t('settings.business.orgNameError'))
    } finally {
      setOrgNameSaving(false)
    }
  }

  function handleOrgNameEditStart() {
    setOrgName(user?.orgName ?? '')
    setOrgNameError('')
    setOrgNameEditing(true)
  }

  function handleOrgNameCancel() {
    setOrgName(user?.orgName ?? '')
    setOrgNameError('')
    setOrgNameEditing(false)
  }

  function handleLangChange(e) {
    const next = e.target.value
    i18n.changeLanguage(next)
    localStorage.setItem('cleaninv_language', next)
    setLang(next)
  }

  // Per-user localStorage key for the default location preference.
  // Scoped to the logged-in email so multiple users on the same device
  // keep independent preferences.
  const defaultLocKey = user?.email
    ? `cleaninv_default_location_${user.email}`
    : null

  const [prefs, setPrefs] = useState(() => ({
    lowStockAlerts: true,
    outOfStockAlerts: true,
    pushNotifications: false,
    darkMode: localStorage.getItem('darkMode') === 'true',
    compactView: false,
    defaultLocation: defaultLocKey
      ? (localStorage.getItem(defaultLocKey) ?? '')
      : '',
    lowStockThreshold: '20',
  }))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode)
    localStorage.setItem('darkMode', prefs.darkMode)
  }, [prefs.darkMode])

  // Persist the default location preference whenever the user changes it.
  useEffect(() => {
    if (!defaultLocKey) return
    if (prefs.defaultLocation) {
      localStorage.setItem(defaultLocKey, prefs.defaultLocation)
    } else {
      localStorage.removeItem(defaultLocKey)
    }
  }, [prefs.defaultLocation, defaultLocKey])

  function set(key) {
    return (val) => setPrefs((p) => ({ ...p, [key]: val }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('settings.title')}</h1>
        <p className={styles.subtitle}>{t('settings.subtitle')}</p>
      </div>

      <div className={styles.sections}>

        {/* Business */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.sections.business')}</h2>
          <div className={styles.card}>
            <div className={`${styles.row} ${orgNameEditing ? styles.businessNameRowEditing : ''}`}>
              <div className={styles.rowText}>
                <label className={`${styles.rowLabel} ${styles.businessNameLabel}`} htmlFor="bizName">
                  {t('settings.business.businessName')}
                </label>
                {orgNameError ? (
                  <span className={styles.rowError}>{orgNameError}</span>
                ) : null}
              </div>
              {isOwner ? (
                <div className={styles.orgNameControl}>
                  {orgNameEditing ? (
                    <div className={styles.orgNameEditForm}>
                      <input
                        id="bizName"
                        className={`${styles.textInput} ${styles.orgNameInput}`}
                        value={orgName}
                        autoFocus
                        onChange={(e) => { setOrgName(e.target.value); setOrgNameError('') }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleOrgNameSave()
                          if (e.key === 'Escape') handleOrgNameCancel()
                        }}
                      />
                      <div className={styles.inlineActions}>
                        <button
                          type="button"
                          className={styles.cancelInlineBtn}
                          onClick={handleOrgNameCancel}
                          disabled={orgNameSaving}
                        >
                          {t('settings.business.orgNameCancel')}
                        </button>
                        <button
                          type="button"
                          className={styles.saveInlineBtn}
                          onClick={handleOrgNameSave}
                          disabled={orgNameSaving || !orgName.trim() || !orgNameDirty}
                        >
                          {orgNameSaving ? t('settings.business.orgNameSaving') : t('settings.business.orgNameSave')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={styles.inlineEditTrigger}
                      onClick={handleOrgNameEditStart}
                      aria-label={t('settings.business.orgNameEdit')}
                      title={t('settings.business.orgNameEdit')}
                    >
                      <span className={styles.readOnlyValue}>{user?.orgName ?? '—'}</span>
                      <span className={styles.editInlineBtn} aria-hidden="true">
                        <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                      </span>
                    </button>
                  )}
                </div>
              ) : (
                <span className={styles.readOnlyValue}>{user?.orgName ?? '—'}</span>
              )}
            </div>
            <div className={styles.divider} />
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="defaultLoc">{t('settings.business.defaultLocation')}</label>
                <span className={styles.rowDesc}>{t('settings.business.defaultLocationDesc')}</span>
              </div>
              <LocationSelect
                id="defaultLoc"
                value={prefs.defaultLocation}
                onChange={(e) => set('defaultLocation')(e.target.value)}
                className={styles.selectInput}
              />
            </div>
          </div>
        </section>

        {/* Language */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.sections.language')}</h2>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{t('settings.language.label')}</span>
                <span className={styles.rowDesc}>{t('settings.language.desc')}</span>
              </div>
              <select
                className={styles.selectInput}
                value={lang}
                onChange={handleLangChange}
              >
                <option value="en">{t('settings.language.en')}</option>
                <option value="es">{t('settings.language.es')}</option>
              </select>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.sections.alerts')}</h2>
          <div className={styles.card}>
            <SettingsRow
              label={t('settings.alerts.lowStock')}
              description={t('settings.alerts.lowStockDesc')}
            >
              <Toggle checked={prefs.lowStockAlerts} onChange={set('lowStockAlerts')} />
            </SettingsRow>
            <div className={styles.divider} />
            <SettingsRow
              label={t('settings.alerts.outOfStock')}
              description={t('settings.alerts.outOfStockDesc')}
            >
              <Toggle checked={prefs.outOfStockAlerts} onChange={set('outOfStockAlerts')} />
            </SettingsRow>
            <div className={styles.divider} />
            {/* <SettingsRow
              label="Push Notifications"
              description="Receive alerts even when app is closed"
            >
              <Toggle checked={prefs.pushNotifications} onChange={set('pushNotifications')} />
            </SettingsRow> */}
            <div className={styles.divider} />
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="threshold">{t('settings.alerts.threshold')}</label>
                <span className={styles.rowDesc}>{t('settings.alerts.thresholdDesc')}</span>
              </div>
              <div className={styles.numericInput}>
                <input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  className={styles.numberField}
                  value={prefs.lowStockThreshold}
                  onChange={(e) => set('lowStockThreshold')(e.target.value)}
                />
                <span className={styles.numberSuffix}>%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Display */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.sections.display')}</h2>
          <div className={styles.card}>
            <SettingsRow label={t('settings.display.darkMode')} description={t('settings.display.darkModeDesc')}>
              <Toggle checked={prefs.darkMode} onChange={set('darkMode')} />
            </SettingsRow>
            {/* <div className={styles.divider} />
            <SettingsRow label={t('settings.display.compactView')} description={t('settings.display.compactViewDesc')}>
              <Toggle checked={prefs.compactView} onChange={set('compactView')} />
            </SettingsRow> */}
          </div>
        </section>

        

        {/* Organization — org_owner and manager only */}
        {canManageLocations && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t('settings.sections.organization')}</h2>
            <div className={styles.card}>
              <button
                className={styles.actionRow}
                type="button"
                onClick={() => navigate('/locations', { state: { fromSettings: true } })}
              >
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>{t('settings.organization.manageLocations')}</span>
                  <span className={styles.rowDesc}>{t('settings.organization.manageLocationsDesc')}</span>
                </div>
                <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* Data */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('settings.sections.data')}</h2>
          <div className={styles.card}>
            <button className={styles.actionRow} type="button">
              <span>{t('settings.data.exportCsv')}</span>
              <FontAwesomeIcon icon={faDownload} aria-hidden="true" />
            </button>
            {/* <div className={styles.divider} />
            <button className={styles.actionRow} type="button">
              <span>Import from CSV</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button> */}
            {/* <div className={styles.divider} />
            <button className={`${styles.actionRow} ${styles.actionDanger}`} type="button">
              <span>{t('settings.data.clearAll')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button> */}
          </div>
        </section>

        <p className={styles.version}>CleanInv v0.1.0 · No backend connected</p>
      </div>
    </div>
  )
}
