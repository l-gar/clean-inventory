import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBuilding, faCheck, faXmark, faArrowsRotate,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { formatDate } from '../utils/date'
import { apiApproveOrg, apiDenyOrg, apiUpdateMemberLimit } from '../store/api'
import LoadingScreen from '../components/LoadingScreen'
import InlineLoader from '../components/InlineLoader'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import ConfirmBlock from '../components/ConfirmBlock'
import styles from './Admin.module.css'

const STATUS_MOD = {
  pending:           'amber',
  approved_no_sheet: 'blue',
  active:            'green',
  denied:            'red',
}

function StatusBadge({ status, t }) {
  const mod = STATUS_MOD[status] ?? 'gray'
  return (
    <span className={`${styles.statusBadge} ${styles[`status_${mod}`]}`}>
      {t(`admin.status_${status}`, { defaultValue: status })}
    </span>
  )
}

function PendingCard({ org, email, onDone, t, language }) {
  const [approving, setApproving] = useState(false)
  const [approveErr, setApproveErr] = useState('')
  const [denyOpen, setDenyOpen] = useState(false)
  const [denying, setDenying] = useState(false)
  const [denyErr, setDenyErr] = useState('')

  async function handleApprove() {
    setApproving(true)
    setApproveErr('')
    try {
      await apiApproveOrg({ email, orgId: org.org_id })
      onDone()
    } catch {
      setApproveErr(t('admin.error_approve'))
    } finally {
      setApproving(false)
    }
  }

  async function handleDeny() {
    setDenying(true)
    setDenyErr('')
    try {
      await apiDenyOrg({ email, orgId: org.org_id })
      onDone()
    } catch {
      setDenyErr(t('admin.error_deny'))
    } finally {
      setDenying(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardIcon}>
          <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
        </div>
        <div className={styles.cardBody}>
          <p className={styles.cardName}>{org.org_name}</p>
          <p className={styles.cardMeta}>{org.owner_email}</p>
          {org.created_date && (
            <p className={styles.cardMeta}>{formatDate(org.created_date, language)}</p>
          )}
          {approveErr && <p className={styles.cardErr}>{approveErr}</p>}
        </div>
      </div>

      {denyOpen ? (
        <ConfirmBlock
          message={t('admin.deny_confirm')}
          confirmLabel={t('admin.deny_confirm_yes')}
          cancelLabel={t('admin.deny_confirm_no')}
          onConfirm={handleDeny}
          onCancel={() => { setDenyOpen(false); setDenyErr('') }}
          busy={denying}
          error={denyErr}
        />
      ) : (
        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.approveBtn}
            onClick={handleApprove}
            disabled={approving}
          >
            <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
            {approving ? '…' : t('admin.approve')}
          </button>
          <button
            type="button"
            className={styles.denyBtn}
            onClick={() => setDenyOpen(true)}
            disabled={approving}
          >
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
            {t('admin.deny')}
          </button>
        </div>
      )}
    </div>
  )
}

function OrgCard({ org, email, onLimitSaved, t, language }) {
  const [limit, setLimit] = useState(String(org.member_limit ?? ''))
  const savedLimit = String(org.member_limit ?? '')
  const isDirty = limit !== savedLimit
  const [saving, setSaving] = useState(false)
  const [saveErr, setSaveErr] = useState('')

  function clampedLimit(n) { return String(Math.min(999, Math.max(1, n))) }

  function handleStep(delta) {
    setLimit(prev => clampedLimit((Number(prev) || 0) + delta))
    setSaveErr('')
  }

  async function handleSave() {
    if (!isDirty) return
    setSaving(true)
    setSaveErr('')
    try {
      await apiUpdateMemberLimit({ email, orgId: org.org_id, limit })
      onLimitSaved(org.org_id, limit)
    } catch {
      setSaveErr(t('admin.error_limit'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardMain}>
        <div className={styles.cardIcon}>
          <FontAwesomeIcon icon={faBuilding} aria-hidden="true" />
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardNameRow}>
            <p className={styles.cardName}>{org.org_name}</p>
            <StatusBadge status={org.status} t={t} />
          </div>
          <p className={styles.cardMeta}>{org.owner_email}</p>
          {org.created_date && (
            <p className={styles.cardMeta}>{formatDate(org.created_date, language)}</p>
          )}
        </div>
      </div>

      <div className={styles.orgStats}>
        <div className={styles.orgStat}>
          <span className={styles.orgStatLabel}>{t('admin.members_label')}</span>
          <span className={styles.orgStatValue}>
            {org.member_count != null && org.member_limit != null
              ? t('admin.members_value', { count: org.member_count, limit: org.member_limit })
              : org.member_count ?? '—'}
          </span>
        </div>
        <div className={styles.orgStat}>
          <span className={styles.orgStatLabel}>{t('admin.sheet_label')}</span>
          <span className={org.sheet_id ? styles.orgStatValueGreen : styles.orgStatValueMuted}>
            {org.sheet_id ? t('admin.sheet_connected') : t('admin.sheet_not_connected')}
          </span>
        </div>
        <div className={styles.orgStat}>
          <span className={styles.orgStatLabel}>{t('admin.alerts_label')}</span>
          <span className={org.email_alerts_enabled ? styles.orgStatValueGreen : styles.orgStatValueMuted}>
            {org.email_alerts_enabled ? t('admin.alerts_on') : t('admin.alerts_off')}
          </span>
        </div>
        <div className={styles.orgStat}>
          <span className={styles.orgStatLabel}>{t('admin.threshold_label')}</span>
          <span className={styles.orgStatValue}>
            {org.low_stock_threshold != null ? t('admin.threshold_value', { count: org.low_stock_threshold }) : '—'}
          </span>
        </div>
      </div>

      <div className={styles.limitSection}>
        <div className={styles.limitRow}>
          <span className={styles.limitLabel}>{t('admin.member_limit')}</span>
          <div className={styles.limitStepper}>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => handleStep(-1)}
              disabled={saving || Number(limit) <= 1}
              aria-label="Decrease"
            >−</button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={styles.limitInput}
              value={limit}
              onChange={e => { setLimit(e.target.value.replace(/\D/g, '')); setSaveErr('') }}
            />
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() => handleStep(1)}
              disabled={saving || Number(limit) >= 999}
              aria-label="Increase"
            >+</button>
          </div>
        </div>

        <div className={styles.limitActions}>
          {saveErr && <p className={styles.cardErr}>{saveErr}</p>}
          <button
            type="button"
            className={`${styles.limitSaveBtn} ${!isDirty ? styles.limitSaveBtnHidden : ''}`}
            onClick={handleSave}
            disabled={saving || !isDirty}
            aria-hidden={!isDirty}
          >
            {saving ? t('admin.limit_saving') : t('admin.limit_save')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Admin() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && user.role !== 'super_admin') navigate('/scan-update', { replace: true })
  }, [user, navigate])

  const pendingOrgs        = useStore(s => s.pendingOrgs)
  const pendingOrgsLoading = useStore(s => s.pendingOrgsLoading)
  const pendingOrgsError   = useStore(s => s.pendingOrgsError)
  const pendingOrgsFetched = useStore(s => s.pendingOrgsFetched)
  const fetchPendingOrgs   = useStore(s => s.fetchPendingOrgs)
  const invalidatePending  = useStore(s => s.invalidatePendingOrgs)

  const allOrgs        = useStore(s => s.allOrgs)
  const allOrgsLoading = useStore(s => s.allOrgsLoading)
  const allOrgsError   = useStore(s => s.allOrgsError)
  const allOrgsFetched = useStore(s => s.allOrgsFetched)
  const fetchAllOrgs   = useStore(s => s.fetchAllOrgs)
  const invalidateAll  = useStore(s => s.invalidateAllOrgs)

  const load = useCallback(() => {
    if (!user) return
    fetchPendingOrgs(user.email).catch(() => {})
    fetchAllOrgs(user.email).catch(() => {})
  }, [user, fetchPendingOrgs, fetchAllOrgs])

  useEffect(() => { load() }, [load])

  usePullToRefresh(useCallback(async () => {
    invalidatePending()
    invalidateAll()
    if (user) {
      await Promise.all([
        fetchPendingOrgs(user.email),
        fetchAllOrgs(user.email),
      ]).catch(() => {})
    }
  }, [invalidatePending, invalidateAll, fetchPendingOrgs, fetchAllOrgs, user]))

  function handleOrgActioned() {
    invalidatePending()
    invalidateAll()
    load()
  }

  function handleLimitSaved() {
    invalidateAll()
    if (user) fetchAllOrgs(user.email).catch(() => {})
  }

  const hasStale    = pendingOrgs.length > 0 || allOrgs.length > 0
  const isFirstLoad = !hasStale && !pendingOrgsFetched && !allOrgsFetched && (pendingOrgsLoading || allOrgsLoading)
  const isRefreshing = (pendingOrgsLoading || allOrgsLoading) && (hasStale || !!(pendingOrgsFetched || allOrgsFetched))

  if (isFirstLoad) return <LoadingScreen message={t('admin.loading')} />

  return (
    <div className={styles.page}>
      {isRefreshing && <InlineLoader />}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>{t('admin.title')}</h1>
          <p className={styles.subtitle}>
            {t('admin.subtitle', { total: allOrgs.length, pending: pendingOrgs.length })}
          </p>
        </div>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => { invalidatePending(); invalidateAll(); load() }}
          aria-label="Refresh"
        >
          <FontAwesomeIcon icon={faArrowsRotate} aria-hidden="true" />
        </button>
      </div>

      {/* ── Pending approvals ─────────────────────────────────────────────── */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('admin.pending_title')}</p>

        {pendingOrgsError && (
          <ErrorState variant="banner" message={t('admin.error_load')} />
        )}

        {!pendingOrgsError && !pendingOrgsLoading && pendingOrgs.length === 0 && (
          <EmptyState
            icon={faCheck}
            iconCircle
            title={t('admin.pending_empty_title')}
            hint={t('admin.pending_empty_hint')}
          />
        )}

        {!pendingOrgsError && pendingOrgs.length > 0 && (
          <div className={styles.cards}>
            {pendingOrgs.map(org => (
              <PendingCard
                key={org.org_id}
                org={org}
                email={user.email}
                onDone={handleOrgActioned}
                t={t}
                language={i18n.language}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── All organizations ─────────────────────────────────────────────── */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>{t('admin.all_orgs_title')}</p>

        {allOrgsError && (
          <ErrorState variant="banner" message={t('admin.error_load')} />
        )}

        {!allOrgsError && !allOrgsLoading && allOrgs.length === 0 && (
          <EmptyState
            icon={faBuilding}
            title={t('admin.all_orgs_empty')}
          />
        )}

        {!allOrgsError && allOrgs.length > 0 && (
          <div className={styles.cards}>
            {allOrgs.map(org => (
              <OrgCard
                key={org.org_id}
                org={org}
                email={user.email}
                onLimitSaved={handleLimitSaved}
                t={t}
                language={i18n.language}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
