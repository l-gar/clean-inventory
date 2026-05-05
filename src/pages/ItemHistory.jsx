import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faArrowUp, faArrowDown, faPenToSquare,
  faArrowRightArrowLeft, faPlus, faClockRotateLeft, faLocationDot, faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { useLocations } from '../hooks/useLocations'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import LoadingScreen from '../components/LoadingScreen'
import InlineLoader from '../components/InlineLoader'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import styles from './ItemHistory.module.css'

const TYPE_CONFIG = {
  restock:       { icon: faArrowUp,            mod: 'green'  },
  job_usage:     { icon: faArrowDown,           mod: 'amber'  },
  sale:          { icon: faArrowDown,           mod: 'amber'  },
  transfer_out:  { icon: faArrowRightArrowLeft, mod: 'violet' },
  transfer_in:   { icon: faArrowRightArrowLeft, mod: 'green'  },
  adjustment:    { icon: faPenToSquare,         mod: 'blue'   },
  initial_count: { icon: faPlus,               mod: 'green'  },
}
const DEFAULT_CONFIG = { icon: faClockRotateLeft, mod: 'gray' }

function displayName(email) {
  const local = (email ?? '').split('@')[0]
  return local.split(/[._+]/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

function formatTime(ts, language) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit', hour12: true })
}

function dayKey(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function dayLabel(ts, t, language) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return t('activity_log.date_group_today')
  if (dDay.getTime() === yesterday.getTime()) return t('activity_log.date_group_yesterday')
  return d.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' })
}

function groupByDay(entries, t, language) {
  const groups = []
  let curKey = null, curGroup = null
  for (const e of entries) {
    const key = dayKey(e.timestamp)
    if (key !== curKey) {
      curKey = key
      curGroup = { key, label: dayLabel(e.timestamp, t, language), entries: [] }
      groups.push(curGroup)
    }
    curGroup.entries.push(e)
  }
  return groups
}

function TransactionEntry({ tx, language, t }) {
  const txType = tx.transaction_type ?? tx.transactionType
  const { icon, mod } = TYPE_CONFIG[txType] ?? DEFAULT_CONFIG
  const delta = Number(tx.quantity_delta ?? tx.quantityDelta)
  const after = (tx.quantity_after ?? tx.quantityAfter) != null
    ? Number(tx.quantity_after ?? tx.quantityAfter)
    : null
  const typeLabel = txType
    ? t(`item_history.type_${txType}`, { defaultValue: txType })
    : t('item_history.type_unknown')

  return (
    <div className={styles.entry}>
      <span className={`${styles.dot} ${styles[`dot_${mod}`]}`}>
        <FontAwesomeIcon icon={icon} aria-hidden="true" />
      </span>
      <div className={styles.entryBody}>
        <p className={styles.typeLabel}>{typeLabel}</p>
        <div className={styles.meta}>
          {!isNaN(delta) && delta !== 0 && (
            <span className={`${styles.delta} ${delta > 0 ? styles.deltaPos : styles.deltaNeg}`}>
              {delta > 0 ? `+${delta}` : delta}{after != null ? ` → ${after}` : ''}
            </span>
          )}
          <span className={styles.performer}>{displayName(tx.performed_by ?? tx.performedBy)}</span>
          <span className={styles.timestamp}>{formatTime(tx.timestamp, language)}</span>
        </div>
        {tx.notes && <p className={styles.notes}>{tx.notes}</p>}
      </div>
    </div>
  )
}

export default function ItemHistory() {
  const { t, i18n }         = useTranslation()
  const { stockId }         = useParams()
  const { state: routeState } = useLocation()
  const navigate            = useNavigate()
  const { user }            = useAuth()

  const itemName   = routeState?.itemName ?? ''
  const locationId = routeState?.locationId ?? null
  const { locations } = useLocations()
  const locationName  = locations.find(l => l.location_id === locationId)?.location_name ?? ''

  const transactions     = useStore(s => s.itemTransactions)
  const loading          = useStore(s => s.itemTransactionsLoading)
  const error            = useStore(s => s.itemTransactionsError)
  const fetched          = useStore(s => s.itemTransactionsFetched)
  const fetchItemTx      = useStore(s => s.fetchItemTransactions)
  const invalidateItemTx = useStore(s => s.invalidateItemTransactions)

  const [collapsedDays, setCollapsedDays] = useState(new Set())
  function toggleDay(key) {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const load = useCallback(() => {
    if (user) return fetchItemTx(user.email, user.orgId, stockId, locationId)
  }, [user, fetchItemTx, stockId, locationId])

  useEffect(() => { load() }, [load])

  usePullToRefresh(useCallback(async () => {
    invalidateItemTx()
    await load()
  }, [invalidateItemTx, load]))

  const groups = useMemo(
    () => groupByDay(transactions, t, i18n.language),
    [transactions, t, i18n.language],
  )

  const hasStale    = transactions.length > 0
  const isFirstLoad = !hasStale && !fetched

  if (isFirstLoad && loading) return <LoadingScreen />

  return (
    <div className={styles.page}>
      {loading && hasStale && <InlineLoader />}

      <div className={styles.pageHeader}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          {t('back')}
        </button>
        <h1 className={styles.title}>{itemName || t('item_history.title')}</h1>
        <div className={styles.headerChips}>
          {locationName && (
            <span className={styles.chip}>
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              {locationName}
            </span>
          )}
          <span className={styles.chipCount}>
            {t('item_history.n_transactions', { count: transactions.length })}
          </span>
        </div>
      </div>

      {error && <ErrorState message={t('item_history.error')} />}

      {!error && !loading && transactions.length === 0 && (
        <EmptyState
          icon={faClockRotateLeft}
          title={t('item_history.empty_title')}
          body={t('item_history.empty_body')}
          iconCircle
          fill
        />
      )}

      {!error && transactions.length > 0 && (
        <div className={styles.list}>
          {groups.map(group => (
            <div key={group.label} className={styles.dayGroup}>
              <button
                type="button"
                className={styles.dateHeader}
                onClick={() => toggleDay(group.key)}
              >
                <span className={styles.dateLabel}>{group.label}</span>
                <div className={styles.dateRight}>
                  <span className={styles.dateCount}>{group.entries.length}</span>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className={`${styles.dateChevron} ${collapsedDays.has(group.key) ? styles.dateChevronCollapsed : ''}`}
                    aria-hidden="true"
                  />
                </div>
              </button>
              <div className={`${styles.dayCardWrap} ${collapsedDays.has(group.key) ? styles.dayCardWrapCollapsed : ''}`}>
                <div className={styles.dayCardInner}>
                  <div className={styles.dayCard}>
                    {group.entries.map((tx, i) => (
                      <TransactionEntry
                        key={`${tx.transaction_id ?? tx.timestamp}-${i}`}
                        tx={tx}
                        language={i18n.language}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
