/**
 * Centralized Zustand store — single source of truth for all remote data.
 *
 * Rules (from CLAUDE.md):
 *   - Components never call API functions directly for data fetching.
 *     Always go through this store.
 *   - Components CAN call write functions from store/api.js directly
 *     but must call the matching invalidate*() action immediately after
 *     so the next read gets fresh data.
 *   - Store lives in memory — cleared on logout and page refresh.
 *
 * Cache TTLs:
 *   locations         — 5 minutes
 *   catalog           — 5 minutes
 *   inventory (stock) — 2 minutes
 *   members           — 5 minutes
 *   stockTransactions — 1 minute
 *   activityLog       — 1 minute
 *
 * Invalidation rules:
 *   addCatalogItem / updateCatalogItem / removeCatalogItem → invalidateCatalog
 *   addStock / updateStock / deductItem / restockItem / adjustItem / transferItem / removeStock → invalidateInventory
 *   addLocation / updateLocation / removeLocation → invalidateLocations
 *   removeMember → invalidateMembers
 *   logout → clearStore
 */

import { create } from 'zustand'
import {
  apiGetLocations,
  apiGetCatalogItems,
  apiGetStockByLocation,
  apiGetStockTransactions,
  apiGetOrgMembers,
  apiGetActiveInvites,
  apiGetActivityLog,
} from './api'

// ── TTL constants ─────────────────────────────────────────────────────────────
const TTL = {
  locations:         5 * 60 * 1000,
  catalog:           5 * 60 * 1000,
  inventory:         2 * 60 * 1000,
  members:           5 * 60 * 1000,
  invites:           5 * 60 * 1000,
  stockTransactions: 1 * 60 * 1000,
  activityLog:       1 * 60 * 1000,
}

function isExpired(timestamp, ttl) {
  return !timestamp || Date.now() - timestamp > ttl
}

// ── sessionStorage helpers ────────────────────────────────────────────────────
// All inventory and location data is cached in sessionStorage so hard-refresh
// shows stale data immediately while a background fetch runs.  sessionStorage
// is used (not localStorage) so the cache dies when the browser tab closes.
// Keys are scoped to email (and locationId where appropriate) so multiple
// users on the same device and multiple locations never share data.

function saveToSession(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)) } catch { /* quota / private mode */ }
}

function clearSessionKeysByPrefix(prefix) {
  try {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(prefix)) keys.push(k)
    }
    keys.forEach((k) => sessionStorage.removeItem(k))
  } catch { /* ignore */ }
}

// inventory — scoped to email + locationId
function inventorySessionKey(email, locationId) { return `cleaninv_inventory_${email}_${locationId}` }
function saveInventoryToSession(email, locationId, items) { saveToSession(inventorySessionKey(email, locationId), items) }
function clearAllInventorySessionKeys() { clearSessionKeysByPrefix('cleaninv_inventory_') }

// locations — scoped to email only (one org per email)
function locationsSessionKey(email) { return `cleaninv_locations_${email}` }
function saveLocationsToSession(email, locs) { saveToSession(locationsSessionKey(email), locs) }
function clearAllLocationsSessionKeys() { clearSessionKeysByPrefix('cleaninv_locations_') }

// inventory — localStorage with 10-min TTL for cross-session stale seeds.
// Used so switching locations shows the last-known data while fresh data loads.
const LOCAL_INVENTORY_TTL = 10 * 60 * 1000
function inventoryLocalKey(email, locationId) { return `cleaninv_inv_local_${email}_${locationId}` }
function saveInventoryToLocal(email, locationId, items) {
  try { localStorage.setItem(inventoryLocalKey(email, locationId), JSON.stringify({ items, ts: Date.now() })) } catch { /* quota */ }
}
function clearLocalKeysByPrefix(prefix) {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(prefix)) keys.push(k)
    }
    keys.forEach((k) => localStorage.removeItem(k))
  } catch { /* ignore */ }
}
function clearAllInventoryLocalKeys() { clearLocalKeysByPrefix('cleaninv_inv_local_') }

// Normalize a location entry to { location_id, location_name }.
// Handles both snake_case and camelCase field names from Apps Script.
function normalizeLocation(l) {
  if (typeof l === 'string') return { location_id: l, location_name: l }
  const id   = l.location_id   ?? l.locationId   ?? l.id
  const name = l.location_name ?? l.locationName ?? l.name ?? id ?? String(l)
  return { location_id: String(id ?? l), location_name: String(name) }
}

// ── Store ─────────────────────────────────────────────────────────────────────
export const useStore = create((set, get) => ({

  // ── Locations ───────────────────────────────────────────────────────────────
  locations:        [],
  locationsFetched: null,
  locationsLoading: false,
  locationsError:   false,

  fetchLocations: async (email, orgId) => {
    const { locationsFetched, locationsLoading, locations } = get()
    if (!isExpired(locationsFetched, TTL.locations)) return locations
    if (locationsLoading) return locations

    set({ locationsLoading: true, locationsError: false })
    try {
      const raw  = await apiGetLocations({ email, orgId })
      const locs = raw.map(normalizeLocation)
      saveLocationsToSession(email, locs)
      set({ locations: locs, locationsFetched: Date.now(), locationsLoading: false })
      return locs
    } catch (err) {
      set({ locationsError: true, locationsLoading: false })
      throw err
    }
  },

  invalidateLocations: () => set({ locationsFetched: null }),

  getLocationName: (locationId, fallbackName = null) => {
    const { locations } = get()
    return locations.find((l) => l.location_id === locationId)?.location_name ?? fallbackName ?? locationId ?? null
  },

  // ── Item catalog ─────────────────────────────────────────────────────────────
  catalog:        [],
  catalogFetched: null,
  catalogLoading: false,
  catalogError:   false,

  /** Fetch all item definitions for the org. Returns cached data if within TTL. */
  fetchCatalog: async (email, orgId) => {
    const { catalogFetched, catalogLoading, catalog } = get()
    if (!isExpired(catalogFetched, TTL.catalog)) return catalog
    if (catalogLoading) return catalog

    set({ catalogLoading: true, catalogError: false })
    try {
      const items = await apiGetCatalogItems({ email, orgId })
      set({ catalog: items, catalogFetched: Date.now(), catalogLoading: false })
      return items
    } catch (err) {
      set({ catalogError: true, catalogLoading: false })
      throw err
    }
  },

  invalidateCatalog: () => set({ catalogFetched: null }),

  // ── Inventory (stock by location) ────────────────────────────────────────────
  inventory:           [],
  inventoryFetched:    null,
  inventoryLoading:    false,
  inventoryError:      false,
  inventoryLocationId: null, // tracks which locationId the cache is for

  /**
   * Fetch stock records for a specific locationId (or 'all').
   * Automatically invalidates the cache when locationId changes.
   * Throws on error so callers can show their own error UI.
   */
  fetchInventory: async (email, orgId, locationId) => {
    const state = get()

    if (state.inventoryLocationId !== locationId) {
      // Atomic reset: clear stale data + mark loading so the sync effect in
      // InventoryList won't wipe the component's stale-seed items prematurely.
      set({ inventoryFetched: null, inventory: [], inventoryLocationId: locationId, inventoryLoading: true, inventoryError: false })
    } else {
      const current = get()
      if (!isExpired(current.inventoryFetched, TTL.inventory)) return current.inventory
      if (current.inventoryLoading) return current.inventory
      set({ inventoryLoading: true, inventoryError: false })
    }

    try {
      const items = await apiGetStockByLocation({ email, orgId, locationId })
      saveInventoryToSession(email, locationId, items)
      saveInventoryToLocal(email, locationId, items)
      // Discard result if the user switched locations while this fetch was in-flight
      if (get().inventoryLocationId !== locationId) return get().inventory
      set({ inventory: items, inventoryFetched: Date.now(), inventoryLoading: false })
      return items
    } catch (err) {
      if (get().inventoryLocationId === locationId) {
        set({ inventoryError: true, inventoryLoading: false })
      }
      throw err
    }
  },

  invalidateInventory: () => set({ inventoryFetched: null }),

  // ── Stock transactions ────────────────────────────────────────────────────────
  stockTransactions:           [],
  stockTransactionsFetched:    null,
  stockTransactionsLoading:    false,
  stockTransactionsError:      false,
  stockTransactionsLocationId: null,

  /**
   * Fetch stock transaction history for a locationId (or 'all').
   * Automatically invalidates when locationId changes.
   */
  fetchStockTransactions: async (email, orgId, locationId) => {
    const state = get()

    if (state.stockTransactionsLocationId !== locationId) {
      set({ stockTransactionsFetched: null, stockTransactions: [], stockTransactionsLocationId: locationId })
    }

    const current = get()
    if (!isExpired(current.stockTransactionsFetched, TTL.stockTransactions)) return current.stockTransactions
    if (current.stockTransactionsLoading) return current.stockTransactions

    set({ stockTransactionsLoading: true, stockTransactionsError: false })
    try {
      const transactions = await apiGetStockTransactions({ email, orgId, locationId })
      set({ stockTransactions: transactions, stockTransactionsFetched: Date.now(), stockTransactionsLoading: false })
      return transactions
    } catch (err) {
      set({ stockTransactionsError: true, stockTransactionsLoading: false })
      throw err
    }
  },

  invalidateStockTransactions: () => set({ stockTransactionsFetched: null }),

  // ── Org members ─────────────────────────────────────────────────────────────
  members:        [],
  membersFetched: null,
  membersLoading: false,
  membersError:   false,

  fetchMembers: async (email, orgId) => {
    const { membersFetched, membersLoading, members } = get()
    if (!isExpired(membersFetched, TTL.members)) return members
    if (membersLoading) return members

    set({ membersLoading: true, membersError: false })
    try {
      const list = await apiGetOrgMembers({ email, orgId })
      set({ members: list, membersFetched: Date.now(), membersLoading: false })
      return list
    } catch (err) {
      set({ membersError: true, membersLoading: false })
      throw err
    }
  },

  invalidateMembers: () => set({ membersFetched: null }),

  // ── Invites ──────────────────────────────────────────────────────────────────
  invites:        [],
  invitesFetched: null,
  invitesLoading: false,
  invitesError:   false,

  fetchInvites: async (email, orgId) => {
    const { invitesFetched, invitesLoading, invites } = get()
    if (!isExpired(invitesFetched, TTL.invites)) return invites
    if (invitesLoading) return invites

    set({ invitesLoading: true, invitesError: false })
    try {
      const list = await apiGetActiveInvites({ email, orgId })
      set({ invites: list, invitesFetched: Date.now(), invitesLoading: false })
      return list
    } catch (err) {
      set({ invitesError: true, invitesLoading: false })
      throw err
    }
  },

  invalidateInvites: () => set({ invitesFetched: null }),

  // ── Activity log ────────────────────────────────────────────────────────────
  activityLog:           [],
  activityLogFetched:    null,
  activityLogLoading:    false,
  activityLogError:      false,
  activityLogLocationId: null,

  /**
   * Fetch activity log for a locationId (or 'all').
   * Automatically invalidates when locationId changes.
   */
  fetchActivityLog: async (email, orgId, locationId) => {
    const state = get()

    if (state.activityLogLocationId !== locationId) {
      set({ activityLogFetched: null, activityLog: [], activityLogLocationId: locationId })
    }

    const current = get()
    if (!isExpired(current.activityLogFetched, TTL.activityLog)) return current.activityLog
    if (current.activityLogLoading) return current.activityLog

    set({ activityLogLoading: true, activityLogError: false })
    try {
      const log = await apiGetActivityLog({ email, orgId, locationId })
      set({ activityLog: log, activityLogFetched: Date.now(), activityLogLoading: false })
      return log
    } catch (err) {
      set({ activityLogError: true, activityLogLoading: false })
      throw err
    }
  },

  invalidateActivityLog: () => set({ activityLogFetched: null }),

  // ── Clear everything (call on logout) ───────────────────────────────────────
  // Pass the logged-out user's email so the per-user UI preference stored in
  // localStorage (cleaninv_default_location_<email>) is also removed.
  clearStore: (email) => {
    if (email) {
      localStorage.removeItem(`cleaninv_default_location_${email}`)
    }
    // Remove all sessionStorage caches (inventory + locations) so stale data
    // from the previous user is never shown to the next user on this device.
    clearAllInventorySessionKeys()
    clearAllLocationsSessionKeys()
    clearAllInventoryLocalKeys()
    set({
      locations:        [], locationsFetched: null,            locationsLoading: false,         locationsError: false,
      catalog:          [], catalogFetched: null,              catalogLoading: false,            catalogError: false,
      inventory:        [], inventoryFetched: null,            inventoryLoading: false,          inventoryError: false,          inventoryLocationId: null,
      members:          [], membersFetched: null,              membersLoading: false,            membersError: false,
      invites:          [], invitesFetched: null,              invitesLoading: false,            invitesError: false,
      stockTransactions:[], stockTransactionsFetched: null,    stockTransactionsLoading: false,  stockTransactionsError: false,   stockTransactionsLocationId: null,
      activityLog:      [], activityLogFetched: null,          activityLogLoading: false,        activityLogError: false,         activityLogLocationId: null,
    })
  },
}))
