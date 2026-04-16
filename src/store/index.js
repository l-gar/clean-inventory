/**
 * Centralized Zustand store — single source of truth for all remote data.
 *
 * Rules (from CLAUDE.md):
 *   - Components never call callAppsScript directly for data fetching.
 *     Always go through this store.
 *   - Components CAN call callAppsScript directly for write operations
 *     (add, update, remove) but must call the matching invalidate*() action
 *     immediately after so the next read gets fresh data.
 *   - Store lives in memory — cleared on logout and page refresh.
 *
 * Cache TTLs:
 *   locations   — 5 minutes
 *   inventory   — 2 minutes
 *   members     — 5 minutes
 *   activityLog — 1 minute
 *
 * Invalidation rules:
 *   addItem / updateItem / removeItem → invalidateInventory
 *   addLocation / updateLocation / removeLocation → invalidateLocations
 *   removeMember → invalidateMembers
 *   logout → clearStore
 */

import { create } from 'zustand'
import { callAppsScript } from '../utils/appsScript'

// ── TTL constants ─────────────────────────────────────────────────────────────
const TTL = {
  locations:   5 * 60 * 1000,
  inventory:   2 * 60 * 1000,
  members:     5 * 60 * 1000,
  activityLog: 1 * 60 * 1000,
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

  /**
   * Fetch locations for the org. Returns cached data if within TTL.
   * Throws on error so callers can show their own error UI.
   */
  fetchLocations: async (email, orgId) => {
    const { locationsFetched, locationsLoading, locations } = get()
    if (!isExpired(locationsFetched, TTL.locations)) return locations
    if (locationsLoading) return locations

    set({ locationsLoading: true, locationsError: false })
    try {
      const data = await callAppsScript('getLocations', { email, orgId })
      if (data.success === false) throw new Error(data.error ?? 'failed')
      const locs = (data.locations ?? []).map(normalizeLocation)
      saveLocationsToSession(email, locs)
      set({ locations: locs, locationsFetched: Date.now(), locationsLoading: false })
      return locs
    } catch (err) {
      set({ locationsError: true, locationsLoading: false })
      throw err
    }
  },

  /** Clear the locations cache so the next fetchLocations call hits the API. */
  invalidateLocations: () => set({ locationsFetched: null }),

  // ── Inventory ───────────────────────────────────────────────────────────────
  inventory:           [],
  inventoryFetched:    null,
  inventoryLoading:    false,
  inventoryError:      false,
  inventoryLocationId: null, // tracks which locationId the cache is for

  /**
   * Fetch inventory for a specific locationId (or 'all').
   * Automatically invalidates the cache when locationId changes.
   * Throws on error so callers can show their own error UI.
   */
  fetchInventory: async (email, orgId, locationId) => {
    const state = get()

    // If the requested location changed, bust the stale cache immediately
    if (state.inventoryLocationId !== locationId) {
      set({ inventoryFetched: null, inventory: [], inventoryLocationId: locationId })
    }

    const current = get()
    if (!isExpired(current.inventoryFetched, TTL.inventory)) return current.inventory
    if (current.inventoryLoading) return current.inventory

    set({ inventoryLoading: true, inventoryError: false })
    try {
      const data = await callAppsScript('getInventory', { email, orgId, locationId })
      if (data.success === false) throw new Error(data.error ?? 'failed')
      const items = data.items ?? []
      saveInventoryToSession(email, locationId, items)
      set({ inventory: items, inventoryFetched: Date.now(), inventoryLoading: false })
      return items
    } catch (err) {
      set({ inventoryError: true, inventoryLoading: false })
      throw err
    }
  },

  /** Clear the inventory cache so the next fetchInventory call hits the API. */
  invalidateInventory: () => set({ inventoryFetched: null }),

  // ── Org members ─────────────────────────────────────────────────────────────
  members:        [],
  membersFetched: null,
  membersLoading: false,
  membersError:   false,

  /**
   * Fetch org members. Returns cached data if within TTL.
   * Throws on error so callers can show their own error UI.
   */
  fetchMembers: async (email, orgId) => {
    const { membersFetched, membersLoading, members } = get()
    if (!isExpired(membersFetched, TTL.members)) return members
    if (membersLoading) return members

    set({ membersLoading: true, membersError: false })
    try {
      const data = await callAppsScript('getOrgMembers', { email, orgId })
      if (data.success === false) throw new Error()
      const list = data.members ?? []
      set({ members: list, membersFetched: Date.now(), membersLoading: false })
      return list
    } catch (err) {
      set({ membersError: true, membersLoading: false })
      throw err
    }
  },

  /** Clear the members cache so the next fetchMembers call hits the API. */
  invalidateMembers: () => set({ membersFetched: null }),

  // ── Activity log ────────────────────────────────────────────────────────────
  activityLog:           [],
  activityLogFetched:    null,
  activityLogLoading:    false,
  activityLogError:      false,
  activityLogLocationId: null,

  /**
   * Fetch activity log for a locationId (or 'all').
   * Automatically invalidates when locationId changes.
   * Throws on error so callers can show their own error UI.
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
      const data = await callAppsScript('getActivityLog', { email, orgId, locationId })
      if (data.success === false) throw new Error()
      const log = data.log ?? data.entries ?? []
      set({ activityLog: log, activityLogFetched: Date.now(), activityLogLoading: false })
      return log
    } catch (err) {
      set({ activityLogError: true, activityLogLoading: false })
      throw err
    }
  },

  /** Clear the activity log cache so the next fetchActivityLog call hits the API. */
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
    set({
      locations: [],        locationsFetched: null,    locationsLoading: false,    locationsError: false,
      inventory: [],        inventoryFetched: null,    inventoryLoading: false,    inventoryError: false,    inventoryLocationId: null,
      members:   [],        membersFetched:   null,    membersLoading:   false,    membersError:   false,
      activityLog: [],      activityLogFetched: null,  activityLogLoading: false,  activityLogError: false,  activityLogLocationId: null,
    })
  },
}))
