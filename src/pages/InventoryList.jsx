import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowsRotate,
  faBoxOpen,
  faLocationDot,
  faMagnifyingGlass,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import LoadingScreen from '../components/LoadingScreen'
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

// ── Visual helpers ────────────────────────────────────────────────────────────
function getCategoryTone(category) {
  const value = String(category ?? '').toLowerCase()

  if (/(chem|clean|soap|disinfect|quim|liquid|solution)/.test(value)) return 'chemicals'
  if (/(safe|glove|ppe|mask|segur)/.test(value)) return 'safety'
  if (/(equip|tool|bottle|spray|machine|botella|rociador)/.test(value)) return 'equipment'
  return 'neutral'
}

// Shown next to the item name. Zero quantity → "Out" (red). At-or-below
// threshold → "Low stock" (red). Above threshold → nothing shown.
function LowStockBadge({ quantity, threshold }) {
  const { t } = useTranslation()
  const qty = Number(quantity)
  if (qty === 0) {
    return <span className={`${styles.badge} ${styles.badgeOut}`}>{t('inventory.badgeOut')}</span>
  }
  if (qty <= threshold) {
    return <span className={`${styles.badge} ${styles.badgeLow}`}>{t('inventory.badgeLow')}</span>
  }
  return null
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

export default function InventoryList() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const isOwner  = user?.role === 'org_owner'
  const isManager = user?.role === 'manager'
  const isMember  = user?.role === 'org_member'

  // org's low-stock threshold — comes from Apps Script auth response.
  // Stored as low_stock_threshold (snake) or lowStockThreshold (camel).
  const threshold = Number(user?.lowStockThreshold ?? user?.low_stock_threshold ?? 5)

  const storeFetchLocations    = useStore((s) => s.fetchLocations)
  const storeFetchInventory    = useStore((s) => s.fetchInventory)
  const storeInvalidateInventory = useStore((s) => s.invalidateInventory)

  // ── Location filter state ─────────────────────────────────────────────────
  // availableLocations: [{location_id, location_name}] used to render tabs
  // org_owner  → fetched via store; seeded from sessionStorage on hard-refresh
  // manager    → taken from user.assignedLocations (always available on mount)
  // org_member → no filter shown

  // org_owner gets a sessionStorage seed so tabs are visible immediately.
  // manager and org_member start empty — filled synchronously in the effect below.
  const [availableLocations, setAvailableLocations] = useState(() =>
    isOwner ? (readSessionLocations(user?.email) ?? []) : []
  )

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
      const assigned = user?.assignedLocations ?? []
      if (assigned.length > 0) {
        const first = assigned[0]
        return typeof first === 'string' ? first : (first.location_id ?? 'all')
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
  const [items, setItems]       = useState(() => readSessionItems(user?.email, initialLocationId) ?? [])
  // Show the full-screen loader only when there is no stale data to display.
  const [fetching, setFetching] = useState(() => readSessionItems(user?.email, initialLocationId) === null)
  const [fetchError, setFetchError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  // ── Helpers ───────────────────────────────────────────────────────────────
  // Resolve a location_id to a human-readable name for the location tag.
  function locationName(locationId) {
    return availableLocations.find((l) => l.location_id === locationId)?.location_name ?? null
  }

  // ── Load location options for filter tabs ─────────────────────────────────
  useEffect(() => {
    if (isOwner) {
      // storeFetchLocations is a no-op when the in-memory cache is warm.
      storeFetchLocations(user.email, user.orgId)
        .then((locs) => {
          setAvailableLocations(locs)
          setLocationsLoaded(true) // idempotent if already true from session seed
        })
        .catch(() => {
          // Non-fatal — tabs show "All" only; must unblock so filter resolves.
          setLocationsLoaded(true)
        })
    } else if (isManager) {
      const assigned = user?.assignedLocations ?? []
      setAvailableLocations(
        assigned.map((l) =>
          typeof l === 'string'
            ? { location_id: l, location_name: l }
            : l,
        ),
      )
      // locationsLoaded already true for manager — no action needed
    } else if (isMember) {
      const assigned = user?.assignedLocations ?? []
      setAvailableLocations(
        assigned.map((l) =>
          typeof l === 'string'
            ? { location_id: l, location_name: l }
            : l,
        ),
      )
    }
  }, []) // mount-only — user object is stable within a session

  // ── Validate saved location against loaded locations ─────────────────────
  // If the saved default no longer exists (location was deleted), reset to
  // 'all' and remove the stale localStorage entry.
  useEffect(() => {
    if (!isOwner && !isManager) return
    if (availableLocations.length === 0) return
    if (selectedLocationId === 'all') return

    const exists = availableLocations.some(
      (l) => l.location_id === selectedLocationId,
    )
    if (!exists) {
      setSelectedLocationId('all')
      if (defaultLocKey) localStorage.removeItem(defaultLocKey)
    }
  }, [availableLocations, selectedLocationId, isOwner, isManager, defaultLocKey])

  // ── Fetch inventory ───────────────────────────────────────────────────────
  // Wraps the store action so the component keeps its own loading/refreshing
  // state (for full-screen loading vs header spinner) while the store handles
  // caching and deduplication.
  const fetchInventory = useCallback(
    async (locId, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true)
        storeInvalidateInventory() // force a fresh fetch on explicit refresh
      } else {
        // If sessionStorage has data for this location, show it immediately and
        // fetch fresh data in the background — no full-screen loader needed.
        const stale = readSessionItems(user.email, locId)
        if (stale) {
          setItems(stale)
          setFetching(false)
          setRefreshing(true) // spinning refresh icon while background fetch runs
        } else {
          setFetching(true)   // no stale data — show full-screen loader
        }
      }
      setFetchError(null)
      try {
        const freshItems = await storeFetchInventory(user.email, user.orgId, locId)
        setItems(freshItems)
      } catch {
        setFetchError(t('inventory.error_load'))
      } finally {
        setFetching(false)
        setRefreshing(false)
      }
    },
    [user.email, user.orgId, t, storeFetchInventory, storeInvalidateInventory],
  )

  // Fetch on mount and whenever the selected location tab changes.
  // Locations and inventory load in parallel — no gate needed here.
  // If the validation effect resets selectedLocationId the dep change re-fires.
  useEffect(() => {
    fetchInventory(selectedLocationId)
  }, [selectedLocationId, fetchInventory])

  // ── Loading screen ────────────────────────────────────────────────────────
  // Only shown when there is no stale data to display (fetching === true).
  // Locations loading never blocks this — tabs show a disabled placeholder
  // while the locations API call is in-flight (see filter render below).
  if (fetching) {
    return <LoadingScreen message={t('inventory.loading')} />
  }

  // ── Derived display values ────────────────────────────────────────────────
  // Show the tab selector when there are 2+ locations to choose from.
  // For org_owner: also show while loading (spinner placeholder) to avoid layout shift.
  const showLocationFilter =
    isOwner
      ? (!locationsLoaded || availableLocations.length > 1)
      : availableLocations.length > 1

  // Show a static location name when there is exactly 1 location — no need to filter.
  const showSingleLocation = locationsLoaded && availableLocations.length === 1

  // Client-side search filter applied on top of whatever the server returned
  const filtered = items.filter((item) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (item.itemName ?? '').toLowerCase().includes(q) ||
      (item.barcode ?? '').toLowerCase().includes(q) ||
      (item.category ?? '').toLowerCase().includes(q)
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
            className={styles.searchInput}
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
            <span>{availableLocations[0].location_name}</span>
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
        <div className={styles.errorBanner}>
          <span>{fetchError}</span>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => fetchInventory(selectedLocationId)}
          >
            {t('inventory.retry')}
          </button>
        </div>
      )}

      {/* ── List or empty state ───────────────────────────────────────── */}
      <div className={styles.list}>

        {/* No items in this location at all — suppressed while a refresh is in-flight
            so stale-empty session data never flashes empty state before real data arrives */}
        {!fetchError && !refreshing && items.length === 0 && (
          <div className={styles.empty}>
            <FontAwesomeIcon icon={faBoxOpen} aria-hidden="true" />
            <p className={styles.emptyText}>{t('inventory.empty_location')}</p>
            <p className={styles.emptyHint}>{t('inventory.empty_location_hint')}</p>
            <Link to="/add" className={styles.emptyBtn}>
              {t('inventory.add_first_item')}
            </Link>
          </div>
        )}

        {/* Search returned no results, but there are items in this location */}
        {!fetchError && items.length > 0 && filtered.length === 0 && (
          <div className={styles.empty}>
            <FontAwesomeIcon icon={faMagnifyingGlass} aria-hidden="true" />
            <p className={styles.emptyText}>{t('inventory.empty')}</p>
          </div>
        )}

        {!fetchError && filtered.length > 0 && (
          <div className={styles.tableHeader} aria-hidden="true">
            <span>{t('item_name')}</span>
            <span className={styles.tableHeaderQty}>{t('quantity')}</span>
            <span className={styles.tableHeaderCategory}>{t('category')}</span>
          </div>
        )}

        {/* Item list */}
        {filtered.map((item) => {
          const qty = Number(item.quantity ?? 0)
          const isLow = qty === 0 || qty <= threshold
          const tone = getCategoryTone(item.category)
          const categoryToneClass = {
            chemicals: styles.categoryChemicals,
            safety: styles.categorySafety,
            equipment: styles.categoryEquipment,
            neutral: styles.categoryNeutral,
          }[tone]
          const qtyToneClass = isLow
            ? styles.qtyLow
            : {
                chemicals: styles.qtyChemicals,
                safety: styles.qtySafety,
                equipment: styles.qtyEquipment,
                neutral: styles.qtyNeutral,
              }[tone]

          return (
            <div
              key={item.itemId}
              className={`${styles.item} ${isLow ? styles.itemLow : ''}`}
            >
              <div className={styles.itemMain}>
                <div className={styles.itemNameRow}>
                  <span className={styles.itemName}>{item.itemName}</span>
                  <LowStockBadge quantity={qty} threshold={threshold} />
                </div>

                <div className={styles.itemDetailsRow}>
                  {item.location_id && locationName(item.location_id) && (
                    <span className={styles.locationText}>{locationName(item.location_id)}</span>
                  )}
                  {item.barcode && (
                    <span className={styles.barcodeText}>{item.barcode}</span>
                  )}
                </div>
              </div>

              <div className={styles.qtyCell}>
                <div className={`${styles.qtyStack} ${qtyToneClass}`}>
                  <span className={styles.qtyValue}>{qty}</span>
                  {item.unit && <span className={styles.unit}>{item.unit}</span>}
                </div>
              </div>

              <div className={styles.categoryCell}>
                <span className={`${styles.categoryBadge} ${categoryToneClass}`}>
                  {item.category || '—'}
                </span>
              </div>
            </div>
          )
        })}

      </div>
    </div>
  )
}
