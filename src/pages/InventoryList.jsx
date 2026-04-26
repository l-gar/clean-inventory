import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faBoxOpen,
  faLocationDot,
  faMagnifyingGlass,
  faPenToSquare,
  faRightLeft,
  faSpinner,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { apiTransferItem } from '../store/api'
import { normalizeLocation, normalizeItem } from '../domain/normalize'
import LoadingScreen from '../components/LoadingScreen'
import InlineLoader from '../components/InlineLoader'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import styles from './InventoryList.module.css'

// ── sessionStorage seeds ──────────────────────────────────────────────────────
// Both helpers return null (not []) when nothing is cached so callers can
// distinguish "stale data available" from "genuinely empty / not yet loaded".

function readSessionItems(email, locationId) {
  if (!email || !locationId) return null
  try {
    const raw = sessionStorage.getItem(`cleaninv_inventory_${email}_${locationId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readSessionLocations(email) {
  if (!email) return null
  try {
    const raw = sessionStorage.getItem(`cleaninv_locations_${email}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function readLocalItems(email, locationId) {
  if (!email || !locationId) return null
  try {
    const raw = localStorage.getItem(`cleaninv_inv_local_${email}_${locationId}`)
    if (!raw) return null
    const { items, ts } = JSON.parse(raw)
    return Date.now() - ts <= 10 * 60 * 1000 ? items : null
  } catch {
    return null
  }
}

// ── Visual helpers ────────────────────────────────────────────────────────────
function getCategoryTone(category) {
  const value = String(category ?? '').toLowerCase()

  if (/(chem|clean|soap|disinfect|quim|liquid|solution)/.test(value)) return 'chemicals'
  if (/(safe|glove|ppe|mask|segur)/.test(value)) return 'safety'
  if (/(equip|tool|bottle|spray|machine|botella|rociador)/.test(value)) return 'equipment'
  return 'neutral'
}

function StatusBadge({ quantity, threshold }) {
  const { t } = useTranslation()
  const qty = Number(quantity)
  if (qty === 0) {
    return <span className={`${styles.badge} ${styles.badgeOut}`}>{t('inventory.badgeOut')}</span>
  }
  if (qty <= threshold) {
    return <span className={`${styles.badge} ${styles.badgeLow}`}>{t('inventory.badgeLow')}</span>
  }
  return <span className={`${styles.badge} ${styles.badgeOk}`}>{t('inventory.badgeOk')}</span>
}

// ── Refresh icon ──────────────────────────────────────────────────────────────
function RefreshIcon({ spinning }) {
  return (
    <FontAwesomeIcon
      icon={faArrowsRotate}
      className={spinning ? styles.spinIcon : undefined}
      aria-hidden="true"
    />
  )
}

function TransferSheet({ item, destinations, dest, qty, maxQty, transferring, error, onDestChange, onQtyChange, onClose, onConfirm, t }) {
  const getLocationName = useStore((s) => s.getLocationName)
  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.transferSheet} role="dialog" aria-modal="true">
        <div className={styles.transferHeader}>
          <h2 className={styles.transferTitle}>{t('inventory.transferTitle')}</h2>
          <button type="button" className={styles.transferClose} onClick={onClose} aria-label={t('cancel')}>
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.transferBody}>
          <p className={styles.transferItemName}>{item.itemName}</p>
          <div className={styles.transferField}>
            <span className={styles.transferLabel}>{t('inventory.transferFrom')}</span>
            <div className={styles.transferReadOnly}>{getLocationName(item.location_id, item.location_name)}</div>
          </div>
          <div className={styles.transferField}>
            <label className={styles.transferLabel} htmlFor="xferDest">{t('inventory.transferTo')}</label>
            <select id="xferDest" className={styles.transferSelect} value={dest} onChange={(e) => onDestChange(e.target.value)}>
              {destinations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>{loc.location_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.transferField}>
            <label className={styles.transferLabel} htmlFor="xferQty">
              {t('inventory.transferQty')}
              {maxQty > 0 && <span className={styles.transferMax}> ({t('inventory.transferMax', { max: maxQty })})</span>}
            </label>
            <input
              id="xferQty"
              type="number"
              min="1"
              max={maxQty}
              className={styles.transferInput}
              value={qty}
              onChange={(e) => onQtyChange(e.target.value)}
            />
          </div>
          {error && <p className={styles.transferError}>{error}</p>}
        </div>
        <div className={styles.transferFooter}>
          <button type="button" className={styles.transferCancelBtn} onClick={onClose} disabled={transferring}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={styles.transferSubmitBtn}
            onClick={onConfirm}
            disabled={transferring || !dest || qty < 1 || qty > maxQty}
          >
            {transferring ? t('inventory.transferring') : t('inventory.transferConfirm')}
          </button>
        </div>
      </div>
    </>
  )
}

export default function InventoryList() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const isOwner  = user?.role === 'org_owner'
  const isManager = user?.role === 'manager'
  const isMember  = user?.role === 'org_member'

  // org's low-stock threshold — comes from Apps Script auth response.
  // Stored as low_stock_threshold (snake) or lowStockThreshold (camel).
  const threshold = Number(user?.lowStockThreshold ?? user?.low_stock_threshold ?? 5)

  const storeFetchLocations      = useStore((s) => s.fetchLocations)
  const storeFetchInventory      = useStore((s) => s.fetchInventory)
  const storeInvalidateInventory = useStore((s) => s.invalidateInventory)
  const storeInventory           = useStore((s) => s.inventory)
  const storeInventoryLoading    = useStore((s) => s.inventoryLoading)
  const storeInventoryLocationId = useStore((s) => s.inventoryLocationId)
  const getLocationName          = useStore((s) => s.getLocationName)

  const fetchSerialRef = useRef(0)

  // ── Location filter state ─────────────────────────────────────────────────
  // availableLocations: [{location_id, location_name}] used to render tabs
  // org_owner  → fetched via store; seeded from sessionStorage on hard-refresh
  // manager    → taken from user.assignedLocations (always available on mount)
  // org_member → no filter shown

  // org_owner gets a sessionStorage seed so tabs are visible immediately.
  // manager / org_member also seed from assignedLocations when available so a
  // hard refresh can restore the location context before the first fetch.
  const [availableLocations, setAvailableLocations] = useState(() => {
    if (isOwner) return (readSessionLocations(user?.email) ?? []).map(normalizeLocation)

    const assigned = user?.assignedLocations ?? []
    return assigned.map(normalizeLocation)
  })

  // locationsLoaded gates the inventory fetch so we never call getInventory with
  // an unvalidated locationId:
  //   org_member / manager → true immediately (data in auth context, no API call)
  //   org_owner with session cache → true immediately (tabs seeded above)
  //   org_owner without session cache → false until storeFetchLocations resolves
  const [locationsLoaded, setLocationsLoaded] = useState(() => {
    if (!isOwner) return true
    return readSessionLocations(user?.email) !== null
  })

  // Per-user localStorage key for the saved default location filter.
  const defaultLocKey = user?.email
    ? `cleaninv_default_location_${user.email}`
    : null

  // Compute the initial location ID once — used for both selectedLocationId and
  // the sessionStorage seed so both start from the same value without running
  // the derivation twice.
  // org_member  → first assigned location (no filter UI shown)
  // org_owner / manager → saved preference from localStorage, or 'all'
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialLocationId = useMemo(() => {
    if (isMember) {
      const assigned = (user?.assignedLocations ?? []).map(normalizeLocation)
      if (assigned.length > 0) {
        return assigned[0].location_id || 'all'
      }
    }
    if (defaultLocKey) {
      const saved = localStorage.getItem(defaultLocKey)
      if (saved) return saved
    }
    return 'all'
  // Run once on mount — user object is stable within a session.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [selectedLocationId, setSelectedLocationId] = useState(initialLocationId)

  // ── Inventory data state ──────────────────────────────────────────────────
  // Seed items from sessionStorage on page load so the list renders immediately
  // with stale data while a background fetch gets fresh results — no empty-state
  // flash and no full-screen loader when cached data exists.
  // Both initialisers share the same two synchronous sessionStorage reads —
  // cheap enough that a ref isn't worth the complexity.
  const [items, setItems]       = useState(() => readSessionItems(user?.email, initialLocationId) ?? readLocalItems(user?.email, initialLocationId) ?? [])
  // Show the full-screen loader only when there is no stale data at all to display.
  const [fetching, setFetching] = useState(() => readSessionItems(user?.email, initialLocationId) === null && readLocalItems(user?.email, initialLocationId) === null)
  const [fetchError, setFetchError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const [transferTarget, setTransferTarget] = useState(null)
  const [transferDest, setTransferDest]     = useState('')
  const [transferQty, setTransferQty]       = useState(1)
  const [transferring, setTransferring]     = useState(false)
  const [transferError, setTransferError]   = useState('')

  // Keep the rendered list in sync with external store updates (e.g. after an
  // edit in another view). Guards prevent three bad cases:
  //   1. storeInventoryLoading — store cleared + loading, stale seed would be wiped
  //   2. wrong location — store's data is for a different location tab
  //   3. empty store — let the fetch callback set items; empty is only valid from it
  useEffect(() => {
    if (storeInventoryLoading) return
    if (storeInventoryLocationId !== selectedLocationId) return
    if (storeInventory.length === 0) return
    setItems(storeInventory)
  }, [storeInventory, storeInventoryLoading, storeInventoryLocationId, selectedLocationId])

  useEffect(() => {
    if (!transferTarget) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [transferTarget])

  

  function openTransfer(item) {
    const dests = availableLocations.filter((l) => l.location_id !== item.location_id)
    setTransferTarget(item)
    setTransferDest(dests[0]?.location_id ?? '')
    setTransferQty(1)
    setTransferError('')
  }

  function closeTransfer() {
    setTransferTarget(null)
    setTransferError('')
  }

  async function handleTransfer() {
    if (!transferTarget || !transferDest || transferQty < 1) return
    setTransferring(true)
    setTransferError('')
    try {
      await apiTransferItem({
        email: user.email,
        orgId: user.orgId,
        fromStockId: transferTarget.itemId,
        catalogId: String(transferTarget.catalog_id ?? transferTarget.catalogId ?? ''),
        toLocationId: transferDest,
        quantity: String(transferQty),
      })
      storeInvalidateInventory()
      closeTransfer()
      fetchInventory(selectedLocationId, true)
    } catch {
      setTransferError(t('inventory.transferError'))
    } finally {
      setTransferring(false)
    }
  }

  // ── Load location options for filter tabs ─────────────────────────────────
  useEffect(() => {
    if (!user?.email) return

    if (isOwner) {
      if (!user?.orgId) return

      // storeFetchLocations is a no-op when the in-memory cache is warm.
      storeFetchLocations(user.email, user.orgId)
        .then((locs) => {
          setAvailableLocations(locs.map(normalizeLocation))
          setLocationsLoaded(true) // idempotent if already true from session seed
        })
        .catch(() => {
          // Non-fatal — tabs show "All" only; must unblock so filter resolves.
          setLocationsLoaded(true)
        })
    } else if (isManager || isMember) {
      const assigned = user?.assignedLocations ?? []
      setAvailableLocations(assigned.map(normalizeLocation))
    }
  }, [isOwner, isManager, isMember, storeFetchLocations, user?.email, user?.orgId, user?.assignedLocations])

  // ── Validate saved location against loaded locations ─────────────────────
  // If the saved default no longer exists (location was deleted), reset to
  // 'all' and remove the stale localStorage entry.
  useEffect(() => {
    if (availableLocations.length === 0) return

    if (isMember) {
      const exists = availableLocations.some(
        (l) => l.location_id === selectedLocationId,
      )
      if (!exists || selectedLocationId === 'all') {
        setSelectedLocationId(availableLocations[0].location_id)
      }
      return
    }

    if (!isOwner && !isManager) return
    if (selectedLocationId === 'all') return

    const exists = availableLocations.some(
      (l) => l.location_id === selectedLocationId,
    )
    if (!exists) {
      setSelectedLocationId('all')
      if (defaultLocKey) localStorage.removeItem(defaultLocKey)
    }
  }, [availableLocations, selectedLocationId, isOwner, isManager, isMember, defaultLocKey])

  // ── Fetch inventory ───────────────────────────────────────────────────────
  // Wraps the store action so the component keeps its own loading/refreshing
  // state (for full-screen loading vs header spinner) while the store handles
  // caching and deduplication.
  const fetchInventory = useCallback(
    async (locId, isRefresh = false) => {
      const serial = ++fetchSerialRef.current

      if (isRefresh) {
        setRefreshing(true)
        storeInvalidateInventory()
      } else {
        // Session first (same-tab, fastest), then localStorage (cross-session).
        const stale = readSessionItems(user.email, locId) ?? readLocalItems(user.email, locId)
        if (stale) {
          setItems(stale)
          setFetching(false)
          setRefreshing(true)
        } else {
          setFetching(true)
        }
      }
      setFetchError(null)
      try {
        const freshItems = await storeFetchInventory(user.email, user.orgId, locId)
        if (fetchSerialRef.current !== serial) return  // location switched mid-flight
        // If the store returned [] because a concurrent fetch is already in-flight
        // (e.g. triggered by ScanUpdate's barcode lookup on the same locationId), skip
        // the update — stale seed stays visible and the sync effect will apply the
        // real result once the store settles.
        if (freshItems.length === 0 && useStore.getState().inventoryLoading) return
        setItems(freshItems)
      } catch {
        if (fetchSerialRef.current !== serial) return
        setFetchError(t('inventory.error_load'))
      } finally {
        if (fetchSerialRef.current === serial) {
          setHasLoadedOnce(true)
          setFetching(false)
          setRefreshing(false)
        }
      }
    },
    [user.email, user.orgId, t, storeFetchInventory, storeInvalidateInventory],
  )

  usePullToRefresh(useCallback(() => fetchInventory(selectedLocationId, true), [fetchInventory, selectedLocationId]))

  // Fetch on mount and whenever the selected location changes, but only once
  // the location context has been restored and validated after a hard refresh.
  useEffect(() => {
    if (isOwner && !locationsLoaded) return
    if (isMember && availableLocations.length === 0) return
    if (selectedLocationId !== 'all' && availableLocations.length === 0) return

    if (selectedLocationId !== 'all' && availableLocations.length > 0) {
      const exists = availableLocations.some(
        (l) => l.location_id === selectedLocationId,
      )
      if (!exists) return
    }

    fetchInventory(selectedLocationId)
  }, [selectedLocationId, fetchInventory, isOwner, isMember, locationsLoaded, availableLocations])

  // ── Loading screen ────────────────────────────────────────────────────────
  // Shown when: (a) no stale data at all, OR (b) the store is mid-flight for
  // this location and there is nothing to display yet — covers the case where
  // an in-flight fetch from another page (e.g. ScanUpdate's barcode lookup) caused
  // storeFetchInventory to return [] early so we skipped setItems above.
  if (fetching || (!fetchError && storeInventoryLoading && items.length === 0)) {
    return <LoadingScreen message={t('inventory.loading')} />
  }

  // ── Derived display values ────────────────────────────────────────────────
  // Show the tab selector when there are 2+ locations to choose from.
  // For org_owner: also show while loading (spinner placeholder) to avoid layout shift.
  const showLocationFilter =
    isOwner
      ? (!locationsLoaded || availableLocations.length > 1)
      : availableLocations.length > 1

  // Show a stable location label when there is no location filter UI.
  // Start with the selected ID as a safe fallback, then automatically upgrade
  // to the human-readable name once the location list or item payload rehydrates.
  const resolvedSelectedLocation =
    selectedLocationId !== 'all'
      ? availableLocations.find((l) => l.location_id === selectedLocationId)
      : null

  const itemLocationFallback =
    selectedLocationId !== 'all'
      ? items.find((item) => (item.location_id ?? item.locationId) === selectedLocationId)?.location_name
      : null

  const singleLocationLabel =
    resolvedSelectedLocation?.location_name ??
    itemLocationFallback ??
    (selectedLocationId !== 'all' ? selectedLocationId : null)

  const showSingleLocation = !showLocationFilter && Boolean(singleLocationLabel)

  const normalizedItems = items.map(normalizeItem)

  // Client-side search filter applied on top of whatever the server returned
  const filtered = normalizedItems.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      item.itemName.toLowerCase().includes(q) ||
      item.barcode.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>{t('inventory.title')}</h1>
          <span className={styles.count}>
            {t('inventory.itemCount', { count: filtered.length })}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnActive : ''}`}
          onClick={() => fetchInventory(selectedLocationId, true)}
          disabled={refreshing}
          aria-label={t('inventory.refresh')}
          title={t('inventory.refresh')}
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </div>

      {/* ── Sticky filters ───────────────────────────────────────────── */}
      <div className={styles.filters}>

        {/* Search */}
        <div className={styles.searchWrap}>
          <FontAwesomeIcon
            className={styles.searchIcon}
            icon={faMagnifyingGlass}
            aria-hidden="true"
          />
          <input
            className={`${styles.searchInput}${search ? ` ${styles.searchInputActive}` : ''}`}
            type="search"
            placeholder={t('inventory.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearch('')}
              aria-label={t('clear')}
            >
              {t('clear')}
            </button>
          )}
        </div>

        {/* Single location label — no filter needed when there is only one */}
        {showSingleLocation && (
          <div className={styles.singleLocation}>
            <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
            <span>{singleLocationLabel}</span>
          </div>
        )}

        {/* Location tabs — shown when 2+ locations */}
        {showLocationFilter && (
          <div className={styles.locationTabs} role="tablist" aria-label={t('inventory.filter_label')}>

            {/* Disabled placeholder while org_owner locations are still loading */}
            {isOwner && !locationsLoaded ? (
              <button
                role="tab"
                disabled
                className={styles.locationTab}
                aria-label={t('inventory.filter_label')}
              >
                <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
              </button>
            ) : (
              <>
                {/* "All" tab */}
                <button
                  role="tab"
                  aria-selected={selectedLocationId === 'all'}
                  className={`${styles.locationTab} ${selectedLocationId === 'all' ? styles.locationTabActive : ''}`}
                  onClick={() => { setSelectedLocationId('all'); setSearch('') }}
                >
                  {t('inventory.filterAll')}
                </button>

                {/* One tab per location */}
                {availableLocations.map((loc) => (
                  <button
                    key={loc.location_id}
                    role="tab"
                    aria-selected={selectedLocationId === loc.location_id}
                    className={`${styles.locationTab} ${selectedLocationId === loc.location_id ? styles.locationTabActive : ''}`}
                    onClick={() => { setSelectedLocationId(loc.location_id); setSearch('') }}
                  >
                    {loc.location_name}
                  </button>
                ))}
              </>
            )}

          </div>
        )}
      </div>

      {/* ── Error state ──────────────────────────────────────────────── */}
      {fetchError && (
        <ErrorState
          variant="banner"
          message={fetchError}
          onRetry={() => fetchInventory(selectedLocationId)}
          retryLabel={t('inventory.retry')}
        />
      )}

      {/* ── List or empty state ───────────────────────────────────────── */}
      <div className={`${styles.list} ${refreshing ? styles.listRefreshing : ''}`}>

        {refreshing && <InlineLoader />}

        {/* No items in this location at all — suppressed while a refresh is in-flight
            so stale-empty session data never flashes empty state before real data arrives */}
        {!fetchError && hasLoadedOnce && !refreshing && !storeInventoryLoading && items.length === 0 && (
          <EmptyState
            icon={faBoxOpen}
            title={t('inventory.empty_location')}
            hint={t('inventory.empty_location_hint')}
            action={{ label: t('inventory.add_first_item'), to: '/scan-update' }}
          />
        )}

        {/* Search returned no results, but there are items in this location */}
        {!fetchError && items.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon={faMagnifyingGlass}
            title={t('inventory.empty')}
          />
        )}

        {!fetchError && filtered.length > 0 && (
          <div className={styles.tableHeader} aria-hidden="true">
            <span>{t('item_name')}</span>
            <span className={styles.tableHeaderQty}>{t('quantity')}</span>
            <span className={styles.tableHeaderActions}>{t('inventory.actions')}</span>
          </div>
        )}

        {/* Item list */}
        {filtered.map((item) => {
          const qty = Number(item.quantity ?? 0)
          const itemThreshold = item.lowStockThreshold || threshold
          const isOut = qty === 0
          const isLow = !isOut && qty <= itemThreshold
          const tone = getCategoryTone(item.category)
          const dotColor = {
            chemicals: 'var(--accent)',
            safety:    'var(--status-low)',
            equipment: '#818cf8',
            neutral:   'var(--text-secondary)',
          }[tone]
          const qtyClass = isOut ? styles.qtyOut : isLow ? styles.qtyLow : styles.qtyOk

          return (
            <div
              key={item.itemId}
              className={`${styles.item} ${isOut ? styles.itemOut : isLow ? styles.itemLow : ''}`}
            >
              <div className={`${styles.itemStripe} ${isOut ? styles.itemStripeOut : isLow ? styles.itemStripeLow : ''}`} />

              <div className={styles.itemMain}>
                <div className={styles.itemNameRow}>
                  <span className={styles.itemName}>{item.itemName}</span>
                  <StatusBadge quantity={qty} threshold={itemThreshold} />
                </div>
                <div className={styles.itemMetaRow}>
                  <span className={styles.categoryDot} style={{ background: dotColor }} />
                  <span className={styles.categoryText}>{item.category || '—'}</span>
                  {item.location_id && getLocationName(item.location_id, item.location_name) && (
                    <>
                      <span className={styles.metaSep}>·</span>
                      <span className={styles.locationText}>{getLocationName(item.location_id, item.location_name)}</span>
                    </>
                  )}
                </div>
              </div>

              <div className={`${styles.qtyCell} ${qtyClass}`}>
                <span className={styles.qtyValue}>{qty}</span>
                {item.unit && <span className={styles.unit}>{item.unit}</span>}
              </div>

              <div className={styles.actionsCell}>
                <Link
                  to={`/edit/${item.itemId}`}
                  state={{ item }}
                  className={styles.editLink}
                  aria-label={`${t('edit_item')}: ${item.itemName}`}
                  title={t('edit_item')}
                >
                  <FontAwesomeIcon icon={faPenToSquare} aria-hidden="true" />
                  <span className={styles.editLinkText}>{t('edit_item')}</span>
                </Link>
                <button
                  type="button"
                  className={styles.transferBtn}
                  onClick={() => openTransfer(item)}
                  disabled={availableLocations.length <= 1}
                  aria-label={`${t('inventory.transfer')}: ${item.itemName}`}
                  title={t('inventory.transfer')}
                >
                  <FontAwesomeIcon icon={faRightLeft} aria-hidden="true" />
                  <span className={styles.transferBtnText}>{t('inventory.transfer')}</span>
                </button>
              </div>
            </div>
          )
        })}

      </div>

      {transferTarget && (
        <TransferSheet
          item={transferTarget}
          destinations={availableLocations.filter((l) => l.location_id !== transferTarget.location_id)}
          dest={transferDest}
          qty={transferQty}
          maxQty={Number(transferTarget.quantity ?? 0)}
          transferring={transferring}
          error={transferError}
          onDestChange={setTransferDest}
          onQtyChange={(v) => setTransferQty(Number(v))}
          onClose={closeTransfer}
          onConfirm={handleTransfer}
          t={t}
        />
      )}
    </div>
  )
}
