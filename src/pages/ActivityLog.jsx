import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowUp, faArrowDown, faPenToSquare, faArrowRightArrowLeft,
  faPlus, faTrash, faUserPlus, faUserMinus, faLocationDot,
  faClockRotateLeft, faFilter, faChevronDown,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { useLocations } from '../hooks/useLocations'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { displayName } from '../utils/avatar'
import { isToday, groupByDay } from '../utils/date'
import LoadingScreen from '../components/LoadingScreen'
import InlineLoader from '../components/InlineLoader'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import styles from './ActivityLog.module.css'

const TX_TYPE_CONFIG = {
  restock:       { icon: faArrowUp,            mod: 'green'  },
  job_usage:     { icon: faArrowDown,           mod: 'amber'  },
  sale:          { icon: faArrowDown,           mod: 'amber'  },
  transfer_out:  { icon: faArrowRightArrowLeft, mod: 'violet' },
  transfer_in:   { icon: faArrowRightArrowLeft, mod: 'green'  },
  adjustment:    { icon: faPenToSquare,         mod: 'blue'   },
  initial_count: { icon: faPlus,               mod: 'green'  },
}

const ACTION_CONFIG = {
  stock_restocked:   { icon: faArrowUp,            mod: 'green'  },
  stock_deducted:    { icon: faArrowDown,           mod: 'amber'  },
  stock_adjusted:    { icon: faPenToSquare,         mod: 'blue'   },
  stock_transferred: { icon: faArrowRightArrowLeft, mod: 'violet' },
  item_added:        { icon: faPlus,                mod: 'green'  },
  item_edited:       { icon: faPenToSquare,         mod: 'blue'   },
  item_removed:      { icon: faTrash,               mod: 'red'    },
  member_added:      { icon: faUserPlus,            mod: 'green'  },
  member_removed:    { icon: faUserMinus,           mod: 'red'    },
  location_assigned: { icon: faLocationDot,         mod: 'blue'   },
}
const DEFAULT_CONFIG = { icon: faClockRotateLeft, mod: 'gray' }

const STOCK_ACTIONS = new Set(['stock_deducted', 'stock_restocked', 'stock_transferred', 'stock_adjusted'])
const ITEM_ACTIONS  = new Set(['item_added', 'item_edited', 'item_removed'])
const ORG_ACTIONS   = new Set(['member_added', 'member_removed', 'location_assigned'])
const CATEGORIES    = ['all', 'stock', 'items', 'org']
const PAGE_SIZE     = 50

function formatTime(ts, language) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit', hour12: true })
}

function SummaryBar({ entries, t }) {
  const todayEntries = entries.filter(e => isToday(e.timestamp))
  if (todayEntries.length === 0) return null

  const restocks = todayEntries.filter(e => e.action === 'stock_restocked').length
  const deducts  = todayEntries.filter(e => e.action === 'stock_deducted').length
  const other    = todayEntries.filter(e => e.action !== 'stock_restocked' && e.action !== 'stock_deducted').length

  return (
    <div className={styles.summaryBar}>
      {restocks > 0 && (
        <span className={`${styles.summaryPill} ${styles.summaryPillGreen}`}>
          {t('activity_log.summary_restocked', { count: restocks })}
        </span>
      )}
      {deducts > 0 && (
        <span className={`${styles.summaryPill} ${styles.summaryPillAmber}`}>
          {t('activity_log.summary_used', { count: deducts })}
        </span>
      )}
      {other > 0 && (
        <span className={`${styles.summaryPill} ${styles.summaryPillGray}`}>
          {t('activity_log.summary_other', { count: other })}
        </span>
      )}
    </div>
  )
}

function DateHeader({ label, count, collapsed, onToggle }) {
  return (
    <button type="button" className={styles.dateHeader} onClick={onToggle}>
      <span className={styles.dateLabel}>{label}</span>
      <div className={styles.dateRight}>
        <span className={styles.dateCount}>{count}</span>
        <FontAwesomeIcon
          icon={faChevronDown}
          className={`${styles.dateChevron} ${collapsed ? styles.dateChevronCollapsed : ''}`}
          aria-hidden="true"
        />
      </div>
    </button>
  )
}

function FilterSheet({ open, onClose, locationId, setLocationId, dateRange, setDateRange, locations, t }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <>
      <div className={styles.filterBackdrop} onClick={onClose} />
      <div className={styles.filterSheet} role="dialog" aria-modal="true">
        <div className={styles.filterHandle} />
        <div className={styles.filterTitleRow}>
          <p className={styles.filterTitle}>{t('activity_log.filter_title')}</p>
        </div>
        <div className={styles.filterBody}>
          <div className={styles.filterSection}>
            <p className={styles.filterSectionLabel}>{t('activity_log.filter_location_label')}</p>
            <div className={styles.filterPills}>
              <button
                type="button"
                className={`${styles.filterPill} ${locationId === 'all' ? styles.filterPillActive : ''}`}
                onClick={() => setLocationId('all')}
              >
                {t('activity_log.all_locations')}
              </button>
              {locations.map(loc => (
                <button
                  key={loc.location_id}
                  type="button"
                  className={`${styles.filterPill} ${locationId === loc.location_id ? styles.filterPillActive : ''}`}
                  onClick={() => setLocationId(loc.location_id)}
                >
                  {loc.location_name}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterSection}>
            <p className={styles.filterSectionLabel}>{t('activity_log.filter_time_label')}</p>
            <div className={styles.filterTimeRow}>
              {[
                ['all',   t('activity_log.date_all')],
                ['today', t('activity_log.date_today')],
                ['7d',    t('activity_log.date_7d')],
                ['30d',   t('activity_log.date_30d')],
              ].map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  className={`${styles.filterTimePill} ${dateRange === v ? styles.filterPillActive : ''}`}
                  onClick={() => setDateRange(v)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button type="button" className={styles.filterApply} onClick={onClose}>
            {t('activity_log.filter_apply')}
          </button>
        </div>
      </div>
    </>
  )
}

function ActivityEntry({ entry, locations, language, t }) {
  const { icon, mod } = ACTION_CONFIG[entry.action] ?? DEFAULT_CONFIG
  const locationName  = locations.find(l => l.location_id === entry.location_id)?.location_name
  const performer     = displayName(entry.performed_by)
  const hasDelta      = entry.quantity_before != null && entry.quantity_after != null
  const delta         = hasDelta ? Number(entry.quantity_after) - Number(entry.quantity_before) : null
  const isStockAction = STOCK_ACTIONS.has(entry.action)
  const [nameExpanded, setNameExpanded] = useState(false)
  const displayedName = ORG_ACTIONS.has(entry.action) ? displayName(entry.item_name) : entry.item_name

  return (
    <div className={styles.entry}>
      <span className={`${styles.dot} ${styles[`dot_${mod}`]}`}>
        <FontAwesomeIcon icon={icon} aria-hidden="true" />
      </span>
      <div className={styles.entryBody}>
        <div className={styles.summary}>
          <span className={styles.verb}>{t(`activity_log.action_${entry.action}`, { defaultValue: entry.action })}</span>
          <span className={styles.timestamp}>{formatTime(entry.timestamp, language)}</span>
        </div>
        {entry.item_name && (
          <div className={styles.itemRow}>
            <button
              type="button"
              className={`${styles.itemName} ${ORG_ACTIONS.has(entry.action) ? styles.itemNameOrg : ''} ${nameExpanded ? styles.itemNameExpanded : ''}`}
              onClick={() => setNameExpanded(v => !v)}
            >
              {displayedName}
            </button>
          </div>
        )}
        <div className={styles.metaRow}>
          {hasDelta && delta !== 0 && isStockAction && (
            <span className={`${styles.delta} ${delta > 0 ? styles.deltaPos : styles.deltaNeg}`}>
              {delta > 0 ? `+${delta}` : delta}{' → '}{entry.quantity_after}
            </span>
          )}
        </div>
        <div className={styles.metaRow}>
          <span className={styles.performer}>{performer}</span>
          {locationName && (
            <span className={styles.entryLocation}>
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              {locationName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function StockTransactionEntry({ tx, locations, catalog, language, t }) {
  const txType       = tx.transaction_type ?? tx.transactionType
  const { icon, mod } = TX_TYPE_CONFIG[txType] ?? DEFAULT_CONFIG
  const delta        = Number(tx.quantity_delta ?? tx.quantityDelta)
  const after        = (tx.quantity_after ?? tx.quantityAfter) != null
    ? Number(tx.quantity_after ?? tx.quantityAfter) : null
  const catalogId    = tx.catalog_id ?? tx.catalogId
  const catalogItem  = catalog?.find(c => String(c.catalog_id ?? c.catalogId ?? '') === String(catalogId))
  const itemName     = tx.item_name ?? tx.itemName ?? catalogItem?.item_name ?? catalogItem?.itemName ?? ''
  const locId        = tx.location_id ?? tx.locationId
  const locationName = locations.find(l => l.location_id === locId)?.location_name
  const performer    = displayName(tx.performed_by ?? tx.performedBy)
  const typeLabel    = txType
    ? t(`item_history.type_${txType}`, { defaultValue: txType })
    : t('item_history.type_unknown')
  const [nameExpanded, setNameExpanded] = useState(false)

  return (
    <div className={styles.entry}>
      <span className={`${styles.dot} ${styles[`dot_${mod}`]}`}>
        <FontAwesomeIcon icon={icon} aria-hidden="true" />
      </span>
      <div className={styles.entryBody}>
        <div className={styles.summary}>
          <span className={styles.verb}>{typeLabel}</span>
          <span className={styles.timestamp}>{formatTime(tx.timestamp, language)}</span>
        </div>
        {itemName && (
          <div className={styles.itemRow}>
            <button
              type="button"
              className={`${styles.itemName} ${nameExpanded ? styles.itemNameExpanded : ''}`}
              onClick={() => setNameExpanded(v => !v)}
            >
              {itemName}
            </button>
          </div>
        )}
        <div className={styles.metaRow}>
          {!isNaN(delta) && delta !== 0 && (
            <span className={`${styles.delta} ${delta > 0 ? styles.deltaPos : styles.deltaNeg}`}>
              {delta > 0 ? `+${delta}` : delta}{after != null ? ` → ${after}` : ''}
            </span>
          )}
        </div>
        <div className={styles.metaRow}>
          <span className={styles.performer}>{performer}</span>
          {locationName && (
            <span className={styles.entryLocation}>
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              {locationName}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ActivityLog() {
  const { t, i18n } = useTranslation()
  const { user }    = useAuth()
  const { locations } = useLocations()

  const activityLog           = useStore(s => s.activityLog)
  const activityLogLoading    = useStore(s => s.activityLogLoading)
  const activityLogError      = useStore(s => s.activityLogError)
  const activityLogFetched    = useStore(s => s.activityLogFetched)
  const fetchActivityLog      = useStore(s => s.fetchActivityLog)
  const invalidateActivityLog = useStore(s => s.invalidateActivityLog)

  const stockTransactions        = useStore(s => s.stockTransactions)
  const stockTransactionsLoading = useStore(s => s.stockTransactionsLoading)
  const stockTransactionsError   = useStore(s => s.stockTransactionsError)
  const stockTransactionsFetched = useStore(s => s.stockTransactionsFetched)
  const fetchStockTransactions   = useStore(s => s.fetchStockTransactions)
  const invalidateStockTx        = useStore(s => s.invalidateStockTransactions)

  const catalog        = useStore(s => s.catalog)
  const catalogFetched = useStore(s => s.catalogFetched)
  const fetchCatalog   = useStore(s => s.fetchCatalog)

  const [tab,           setTab]           = useState('activity')
  const [category,      setCategory]      = useState('all')
  const [locationId,    setLocationId]    = useState('all')
  const [dateRange,     setDateRange]     = useState('all')
  const [limit,         setLimit]         = useState(PAGE_SIZE)
  const [filterOpen,    setFilterOpen]    = useState(false)
  const [collapsedDays, setCollapsedDays] = useState(new Set())

  function toggleDay(key) {
    setCollapsedDays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function switchTab(newTab) { setTab(newTab); setLimit(PAGE_SIZE); setCollapsedDays(new Set()) }

  const load = useCallback(() => {
    if (user) return fetchActivityLog(user.email, user.orgId, 'all')
  }, [user, fetchActivityLog])

  const loadTx = useCallback(() => {
    if (user) return fetchStockTransactions(user.email, user.orgId, locationId, 365)
  }, [user, fetchStockTransactions, locationId])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (tab === 'transactions') {
      loadTx()
      if (user && !catalogFetched) fetchCatalog(user.email, user.orgId).catch(() => {})
    }
  }, [tab, loadTx, fetchCatalog, catalogFetched, user])

  usePullToRefresh(useCallback(async () => {
    if (tab === 'activity') {
      invalidateActivityLog()
      await load()
    } else {
      invalidateStockTx()
      await loadTx()
    }
  }, [tab, invalidateActivityLog, load, invalidateStockTx, loadTx]))

  const filtered = useMemo(() => {
    let entries = activityLog

    if (category === 'stock')      entries = entries.filter(e => STOCK_ACTIONS.has(e.action))
    else if (category === 'items') entries = entries.filter(e => ITEM_ACTIONS.has(e.action))
    else if (category === 'org')   entries = entries.filter(e => ORG_ACTIONS.has(e.action))

    if (locationId !== 'all') entries = entries.filter(e => e.location_id === locationId)

    if (dateRange !== 'all') {
      const now    = Date.now()
      const cutoff =
        dateRange === 'today' ? new Date().setHours(0, 0, 0, 0) :
        dateRange === '7d'    ? now - 7  * 24 * 60 * 60 * 1000 :
                                now - 30 * 24 * 60 * 60 * 1000
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= cutoff)
    }

    return entries
  }, [activityLog, category, locationId, dateRange])

  const filteredTx = useMemo(() => {
    let entries = stockTransactions
    if (locationId !== 'all') entries = entries.filter(e => (e.location_id ?? e.locationId) === locationId)
    if (dateRange !== 'all') {
      const now = Date.now()
      const cutoff =
        dateRange === 'today' ? new Date().setHours(0, 0, 0, 0) :
        dateRange === '7d'    ? now - 7  * 24 * 60 * 60 * 1000 :
                                now - 30 * 24 * 60 * 60 * 1000
      entries = entries.filter(e => new Date(e.timestamp).getTime() >= cutoff)
    }
    return entries
  }, [stockTransactions, locationId, dateRange])

  const visible  = filtered.slice(0, limit)
  const hasMore  = filtered.length > limit
  const groups   = groupByDay(visible, t, i18n.language)

  const txVisible = filteredTx.slice(0, limit)
  const txHasMore = filteredTx.length > limit
  const txGroups  = groupByDay(txVisible, t, i18n.language)

  const activeFilterCount = (locationId !== 'all' ? 1 : 0) + (dateRange !== 'all' ? 1 : 0)
  const hasStaleData  = activityLog.length > 0
  const isFirstLoad   = !hasStaleData && !activityLogFetched
  const txHasStale    = stockTransactions.length > 0
  const txIsFirstLoad = !txHasStale && !stockTransactionsFetched

  if (tab === 'activity'     && isFirstLoad   && activityLogLoading)        return <LoadingScreen message={t('activity_log.loading')} />
  if (tab === 'transactions' && txIsFirstLoad && stockTransactionsLoading)  return <LoadingScreen message={t('activity_log.tx_loading')} />

  function resetLimit() { setLimit(PAGE_SIZE) }

  const subtitleDate =
    dateRange === 'today' ? ` · ${t('activity_log.date_today').toLowerCase()}` :
    dateRange === '7d'    ? ` · ${t('activity_log.date_7d').toLowerCase()}`    :
    dateRange === '30d'   ? ` · ${t('activity_log.date_30d').toLowerCase()}`   : ''

  return (
    <div className={styles.page}>
      {(activityLogLoading && hasStaleData) || (stockTransactionsLoading && txHasStale) ? <InlineLoader /> : null}

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('activity_log.title')}</h1>
        <p className={styles.subtitle}>
          {tab === 'activity'
            ? `${t('activity_log.n_events', { count: filtered.length })}${subtitleDate}`
            : t('activity_log.n_transactions', { count: filteredTx.length })
          }
        </p>
        <div className={styles.modeTabs}>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'activity'}
            className={`${styles.modeTab} ${tab === 'activity' ? styles.modeTabActive : ''}`}
            onClick={() => switchTab('activity')}
          >
            <FontAwesomeIcon icon={faClockRotateLeft} aria-hidden="true" />
            {t('activity_log.tab_activity')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'transactions'}
            className={`${styles.modeTab} ${tab === 'transactions' ? styles.modeTabActive : ''}`}
            onClick={() => switchTab('transactions')}
          >
            <FontAwesomeIcon icon={faArrowRightArrowLeft} aria-hidden="true" />
            {t('activity_log.tab_transactions')}
          </button>
        </div>
      </div>

      {tab === 'activity' && (
        <div className={styles.tabBar}>
          <div className={styles.tabs}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                type="button"
                className={`${styles.tab} ${category === cat ? styles.tabActive : ''}`}
                onClick={() => { setCategory(cat); resetLimit() }}
              >
                {t(`activity_log.filter_${cat}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.filterBtn} ${activeFilterCount > 0 ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
            {activeFilterCount > 0
              ? <span className={styles.filterBadge}>{activeFilterCount}</span>
              : <span>{t('activity_log.filter_btn')}</span>
            }
          </button>
        </div>
      )}

      {tab === 'transactions' && (
        <div className={styles.txFilterBar}>
          <button
            type="button"
            className={`${styles.filterBtn} ${activeFilterCount > 0 ? styles.filterBtnActive : ''}`}
            onClick={() => setFilterOpen(true)}
          >
            <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
            {activeFilterCount > 0
              ? <span className={styles.filterBadge}>{activeFilterCount}</span>
              : <span>{t('activity_log.filter_btn')}</span>
            }
          </button>
        </div>
      )}

      {tab === 'activity' && <SummaryBar entries={filtered} t={t} />}

      {/* ── Activity tab ─────────────────────────────────────────────────── */}
      {tab === 'activity' && activityLogError && (
        <ErrorState variant="banner" message={t('activity_log.error')} />
      )}
      {tab === 'activity' && !activityLogError && visible.length === 0 && (
        <EmptyState icon={faClockRotateLeft} title={t('activity_log.empty_title')} body={t('activity_log.empty_body')} iconCircle fill />
      )}
      {tab === 'activity' && !activityLogError && visible.length > 0 && (
        <div className={styles.list}>
          {groups.map(group => (
            <div key={group.label} className={styles.dayGroup}>
              <DateHeader
                label={group.label}
                count={group.entries.length}
                collapsed={collapsedDays.has(group.key)}
                onToggle={() => toggleDay(group.key)}
              />
              <div className={`${styles.dayCardWrap} ${collapsedDays.has(group.key) ? styles.dayCardWrapCollapsed : ''}`}>
                <div className={styles.dayCardInner}>
                  <div className={styles.dayCard}>
                    {group.entries.map((entry, i) => (
                      <ActivityEntry key={`${entry.timestamp}-${i}`} entry={entry} locations={locations} language={i18n.language} t={t} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {hasMore && (
            <button type="button" className={styles.loadMore} onClick={() => setLimit(l => l + PAGE_SIZE)}>
              {t('activity_log.load_more')}
            </button>
          )}
        </div>
      )}

      {/* ── Transactions tab ─────────────────────────────────────────────── */}
      {tab === 'transactions' && stockTransactionsError && (
        <ErrorState variant="banner" message={t('activity_log.tx_error')} />
      )}
      {tab === 'transactions' && !stockTransactionsError && txVisible.length === 0 && (
        <EmptyState icon={faArrowRightArrowLeft} title={t('activity_log.tx_empty_title')} body={t('activity_log.tx_empty_body')} iconCircle fill />
      )}
      {tab === 'transactions' && !stockTransactionsError && txVisible.length > 0 && (
        <div className={styles.list}>
          {txGroups.map(group => (
            <div key={group.label} className={styles.dayGroup}>
              <DateHeader
                label={group.label}
                count={group.entries.length}
                collapsed={collapsedDays.has(group.key)}
                onToggle={() => toggleDay(group.key)}
              />
              <div className={`${styles.dayCardWrap} ${collapsedDays.has(group.key) ? styles.dayCardWrapCollapsed : ''}`}>
                <div className={styles.dayCardInner}>
                  <div className={styles.dayCard}>
                    {group.entries.map((tx, i) => (
                      <StockTransactionEntry key={`${tx.transaction_id ?? tx.timestamp}-${i}`} tx={tx} locations={locations} catalog={catalog} language={i18n.language} t={t} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {txHasMore && (
            <button type="button" className={styles.loadMore} onClick={() => setLimit(l => l + PAGE_SIZE)}>
              {t('activity_log.load_more')}
            </button>
          )}
        </div>
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        locationId={locationId}
        setLocationId={v => { setLocationId(v); resetLimit() }}
        dateRange={dateRange}
        setDateRange={v => { setDateRange(v); resetLimit() }}
        locations={locations}
        t={t}
      />
    </div>
  )
}
