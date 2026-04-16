import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCirclePlus,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { callAppsScript } from '../utils/appsScript'
import LoadingScreen from '../components/LoadingScreen'
import LangToggle from '../components/LangToggle'
import styles from './ConnectSheet.module.css'

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL

const INVENTORY_HEADERS =
  'item_id, item_name, brand, barcode, quantity, unit, category, ' +
  'location_id, cost_per_unit, expected_jobs, last_restocked_date, ' +
  'item_low_stock_threshold, track_stock, added_by, added_date, ' +
  'last_updated_by, last_updated_date'

const ACTIVITY_HEADERS =
  'timestamp, action, item_id, item_name, quantity_before, ' +
  'quantity_after, location_id, performed_by, role'

const INVENTORY_HEADER_ROW = [
  'item_id', 'item_name', 'brand', 'barcode', 'quantity', 'unit',
  'category', 'location_id', 'cost_per_unit', 'expected_jobs',
  'last_restocked_date', 'item_low_stock_threshold', 'track_stock',
  'added_by', 'added_date', 'last_updated_by', 'last_updated_date',
]

const ACTIVITY_HEADER_ROW = [
  'timestamp', 'action', 'item_id', 'item_name',
  'quantity_before', 'quantity_after', 'location_id',
  'performed_by', 'role',
]

export default function ConnectSheet() {
  const { t } = useTranslation()
  const { user, accessToken, logout, updateUser } = useAuth()
  const navigate = useNavigate()

  // ── Auto-create state ─────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [createError, setCreateError] = useState(null)

  // ── Manual connect state ──────────────────────────────────────────────────
  const [sheetId, setSheetId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(null)

  // ── Loading screens ───────────────────────────────────────────────────────
  if (creating) {
    return <LoadingScreen message={loadingMsg} />
  }
  if (connecting) {
    return <LoadingScreen message={t('connect_sheet.connecting')} />
  }

  // ── Auto-create handler ───────────────────────────────────────────────────
  async function handleAutoCreate() {
    setCreating(true)
    setCreateError(null)

    try {
      // Step 1 — create the spreadsheet with both tabs
      setLoadingMsg(t('connect_sheet.creating_step_sheet', { orgName: user.orgName }))
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: `${user.orgName} Inventory` },
          sheets: [
            { properties: { title: 'inventory' } },
            { properties: { title: 'activity_log' } },
          ],
        }),
      })

      if (!createRes.ok) {
        const errBody = await createRes.text()
        console.error('[ConnectSheet] Create sheet failed:', createRes.status, errBody)
        throw new Error('create_sheet')
      }

      const { spreadsheetId } = await createRes.json()
      console.log('[ConnectSheet] Sheet created:', spreadsheetId)

      // Step 2 — write headers to both tabs
      setLoadingMsg(t('connect_sheet.creating_step_headers'))
      const headersRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: [
              { range: 'inventory!A1',    values: [INVENTORY_HEADER_ROW] },
              { range: 'activity_log!A1', values: [ACTIVITY_HEADER_ROW] },
            ],
          }),
        },
      )

      if (!headersRes.ok) {
        const errBody = await headersRes.text()
        console.error('[ConnectSheet] Headers failed:', headersRes.status, errBody)
        throw new Error('create_headers')
      }

      console.log('[ConnectSheet] Headers written')

      // Step 3 — share with admin email as Editor
      setLoadingMsg(t('connect_sheet.creating_step_sharing'))
      const shareRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions?sendNotificationEmail=false`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'user',
            role: 'writer',
            emailAddress: SUPER_ADMIN_EMAIL,
          }),
        },
      )

      if (!shareRes.ok) {
        const errBody = await shareRes.text()
        console.error('[ConnectSheet] Share failed:', shareRes.status, errBody)
        throw new Error('create_share')
      }

      console.log('[ConnectSheet] Sheet shared with admin')

      // Step 4 — register the Sheet ID in Apps Script
      setLoadingMsg(t('connect_sheet.creating_step_connecting'))
      const data = await callAppsScript('connectSheet', {
        email: user.email,
        orgId: user.orgId,
        sheetId: spreadsheetId,
      })

      if (data.success === false) {
        console.error('[ConnectSheet] connectSheet action failed:', data)
        throw new Error('connect')
      }

      console.log('[ConnectSheet] connectSheet success — navigating to app')
      updateUser({ orgStatus: 'active', sheetId: spreadsheetId })
      navigate('/add', { replace: true })
    } catch (err) {
      const knownKeys = ['create_sheet', 'create_headers', 'create_share', 'connect']
      const msgKey = knownKeys.includes(err.message)
        ? `connect_sheet.error_${err.message}`
        : 'connect_sheet.error_create_generic'
      setCreateError(t(msgKey))
    } finally {
      setCreating(false)
    }
  }

  // ── Manual connect handler ────────────────────────────────────────────────
  async function handleConnect(e) {
    e.preventDefault()
    const trimmed = sheetId.trim()
    if (!trimmed) {
      setConnectError(t('connect_sheet.error_empty'))
      return
    }

    setConnecting(true)
    setConnectError(null)
    try {
      const data = await callAppsScript('connectSheet', {
        email: user.email,
        orgId: user.orgId,
        sheetId: trimmed,
      })

      if (data.success === false) {
        setConnectError(data.error ?? t('connect_sheet.error_generic'))
        return
      }

      updateUser({ orgStatus: 'active', sheetId: trimmed })
      navigate('/add', { replace: true })
    } catch {
      setConnectError(t('connect_sheet.error_generic'))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className={styles.page}>
      <LangToggle />
      <div className={styles.card}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className={styles.header}>
          <div className={styles.checkIcon}>
            <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
          </div>
          <h1 className={styles.title}>{t('connect_sheet.title')}</h1>
          <p className={styles.subtitle}>{t('connect_sheet.subtitle')}</p>
        </div>

        {/* ── Auto-create section ─────────────────────────────── */}
        <div className={styles.autoCreate}>
          <p className={styles.autoCreateLabel}>{t('connect_sheet.auto_create_label')}</p>
          <h2 className={styles.autoCreateTitle}>{t('connect_sheet.auto_create_title')}</h2>
          <p className={styles.autoCreateSubtitle}>{t('connect_sheet.auto_create_subtitle')}</p>

          <button
            type="button"
            className={styles.btnPrimary}
            onClick={handleAutoCreate}
            disabled={creating}
          >
            <FontAwesomeIcon icon={faCirclePlus} aria-hidden="true" />
            {t('connect_sheet.auto_create_btn')}
          </button>

          {createError && (
            <div className={styles.errorBox}>
              <p className={styles.errorMsg}>{createError}</p>
              <button
                type="button"
                className={styles.btnRetry}
                onClick={handleAutoCreate}
              >
                {t('connect_sheet.try_again')}
              </button>
            </div>
          )}
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div className={styles.orDivider}>
          <span>{t('connect_sheet.manual_divider')}</span>
        </div>

        {/* ── Manual steps ────────────────────────────────────── */}
        <p className={styles.stepsIntro}>{t('connect_sheet.steps_intro')}</p>

        <div className={styles.steps}>

          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step1_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step1_body')}</span>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step2_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step2_body')}</span>
              <div className={styles.codeBlock}>
                inventory<br />
                activity_log
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step3_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step3_body')}</span>
              <div className={styles.codeBlock}>{INVENTORY_HEADERS}</div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>4</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step4_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step4_body')}</span>
              <div className={styles.codeBlock}>{ACTIVITY_HEADERS}</div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>5</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step5_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step5_body')}</span>
              <div className={styles.emailBlock}>{SUPER_ADMIN_EMAIL}</div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>6</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step6_title')}</span>
              <span className={styles.stepText}>{t('connect_sheet.step6_body')}</span>
              <div className={styles.urlBlock}>
                docs.google.com/spreadsheets/d/
                <span className={styles.urlHighlight}>SHEET_ID_IS_HERE</span>
                /edit
              </div>
            </div>
          </div>

          <div className={styles.step}>
            <span className={styles.stepNum}>7</span>
            <div className={styles.stepBody}>
              <span className={styles.stepTitle}>{t('connect_sheet.step7_title')}</span>
            </div>
          </div>

        </div>

        {/* ── Manual form ─────────────────────────────────────── */}
        <form className={styles.form} onSubmit={handleConnect}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="sheetId">
              {t('connect_sheet.sheet_id_label')}
            </label>
            <input
              id="sheetId"
              className={`${styles.input}${connectError ? ` ${styles.inputError}` : ''}`}
              type="text"
              value={sheetId}
              onChange={(e) => { setSheetId(e.target.value); setConnectError(null) }}
              placeholder={t('connect_sheet.sheet_id_placeholder')}
              spellCheck={false}
            />
            {connectError && <p className={styles.error}>{connectError}</p>}
          </div>

          <button
            className={styles.btnOutline}
            type="submit"
            disabled={!sheetId.trim()}
          >
            {t('connect_sheet.connect_btn')}
          </button>

          <p className={styles.helpText}>
            {t('connect_sheet.help_text', { email: SUPER_ADMIN_EMAIL })}
          </p>
        </form>

        <div className={styles.divider} />

        <button className={styles.btnSecondary} type="button" onClick={logout}>
          {t('connect_sheet.sign_out')}
        </button>

      </div>
    </div>
  )
}
