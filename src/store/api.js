/**
 * Domain API layer — all Apps Script action calls live here.
 *
 * Rules:
 *   - Every function handles success/error unwrapping before returning.
 *   - No caching or TTL logic here — that belongs in the store.
 *   - Components importing write functions from here must call the matching
 *     invalidate*() store action after every successful write.
 *
 * Read functions (called by store actions):
 *   apiGetLocations, apiGetStockByLocation, apiGetCatalogItems,
 *   apiGetStockTransactions, apiGetOrgMembers, apiGetActivityLog,
 *   apiGetActiveInvites, apiValidateInvite
 *
 * Write functions (called directly by components):
 *   apiAddCatalogItem, apiAddStock
 *   apiUpdateCatalogItem, apiUpdateStock
 *   apiDeductItem, apiRestockItem, apiAdjustItem, apiTransferItem
 *   apiRemoveCatalogItem, apiRemoveStock
 *   apiCheckLowStockAllOrgs, apiClearStockAlert
 *   apiUpdateAlertSetting, apiUpdateThreshold, apiUpdateOrgName
 *   apiGenerateInvite, apiRevokeInvite, apiRemoveMember
 *   apiAddLocation, apiUpdateLocation, apiRemoveLocation
 *   apiAssignLocation, apiRemoveLocationAssignment, apiJoinOrg
 */

import { callAppsScript } from '../utils/appsScript'
import { normalizeActivityEntry } from '../domain/normalize'

// ── Read ──────────────────────────────────────────────────────────────────────

export async function apiGetLocations({ email, orgId }) {
  const data = await callAppsScript('getLocations', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.locations ?? []
}

/** locationId can be a specific location_id or 'all'. */
export async function apiGetStockByLocation({ email, orgId, locationId }) {
  const data = await callAppsScript('getStockByLocation', { email, orgId, locationId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.stocks ?? data.items ?? data.inventory ?? []
}

export async function apiGetCatalogItems({ email, orgId }) {
  const data = await callAppsScript('getCatalogItems', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.items ?? []
}

/** locationId is optional — omit for all transactions across the org. days limits results to the last N days. */
export async function apiGetStockTransactions({ email, orgId, locationId, days } = {}) {
  const data = await callAppsScript('getStockTransactions', { email, orgId, locationId, days })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.transactions ?? []
}

/** Fetch transactions for a location, to be filtered client-side by stockId. days limits to last N days. */
export async function apiGetItemTransactions({ email, orgId, locationId, days } = {}) {
  const data = await callAppsScript('getStockTransactions', { email, orgId, locationId, days })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.transactions ?? []
}

export async function apiGetOrgMembers({ email, orgId }) {
  const data = await callAppsScript('getOrgMembers', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.members ?? []
}

/** locationId can be a specific location_id or 'all'. */
export async function apiGetActivityLog({ email, orgId, locationId }) {
  const data = await callAppsScript('getActivityLog', { email, orgId, locationId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  const raw = data.log ?? data.entries ?? []
  return raw.map(normalizeActivityEntry)
}

export async function apiGetActiveInvites({ email, orgId }) {
  const data = await callAppsScript('getActiveInvites', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.invites ?? []
}

export async function apiValidateInvite({ token, email }) {
  const data = await callAppsScript('validateInvite', { token, email })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function apiAddCatalogItem(params) {
  const data = await callAppsScript('addCatalogItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiAddStock(params) {
  const data = await callAppsScript('addStock', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateCatalogItem(params) {
  const data = await callAppsScript('updateCatalogItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateStock(params) {
  const data = await callAppsScript('updateStock', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

/** Reduce quantity — job usage or sale. quantity must be positive. */
export async function apiDeductItem(params) {
  const data = await callAppsScript('deductItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

/** Increase quantity — stock received. quantity must be positive. */
export async function apiRestockItem(params) {
  const data = await callAppsScript('restockItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

/** Set absolute quantity — manual correction. notes is required. */
export async function apiAdjustItem(params) {
  if (!params.notes) throw new Error('notes is required for adjustments')
  const data = await callAppsScript('adjustItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

/** Move quantity between two locations. toStockId (not toLocationId) must already exist. */
export async function apiTransferItem(params) {
  const data = await callAppsScript('transferItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

/** Blocked by Apps Script if any stock records reference this catalog_id. */
export async function apiRemoveCatalogItem(params) {
  const data = await callAppsScript('removeCatalogItem', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiRemoveStock(params) {
  const data = await callAppsScript('removeStock', params)
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiCheckLowStockAllOrgs() {
  const data = await callAppsScript('checkLowStockAllOrgs', {})
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiClearStockAlert({ sheetId, stockId }) {
  const data = await callAppsScript('clearStockAlert', { sheetId, stockId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateAlertSetting({ email, orgId, enabled }) {
  const data = await callAppsScript('updateAlertSetting', { email, orgId, enabled })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateThreshold({ email, orgId, threshold }) {
  const data = await callAppsScript('updateThreshold', { email, orgId, threshold })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateOrgName({ email, orgId, orgName }) {
  const data = await callAppsScript('updateOrgName', { email, orgId, orgName })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiGenerateInvite({ email, orgId, role }) {
  const data = await callAppsScript('generateInvite', { email, orgId, role })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiRevokeInvite({ email, token }) {
  const data = await callAppsScript('revokeInvite', { email, token })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiRemoveMember({ email, targetEmail, orgId }) {
  const data = await callAppsScript('removeMember', { email, targetEmail, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiAddLocation({ email, orgId, locationName }) {
  const data = await callAppsScript('addLocation', { email, orgId, locationName })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateLocation({ email, orgId, locationId, locationName }) {
  const data = await callAppsScript('updateLocation', { email, orgId, locationId, locationName })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiRemoveLocation({ email, orgId, locationId }) {
  const data = await callAppsScript('removeLocation', { email, orgId, locationId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiAssignLocation({ email, targetEmail, orgId, locationId }) {
  const data = await callAppsScript('assignLocation', { email, targetEmail, orgId, locationId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiRemoveLocationAssignment({ email, targetEmail, orgId, locationId }) {
  const data = await callAppsScript('removeLocationAssignment', { email, targetEmail, orgId, locationId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiJoinOrg({ token, email }) {
  const data = await callAppsScript('joinOrg', { token, email })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

// ── Admin only ────────────────────────────────────────────────────────────────

export async function apiGetPendingOrgs({ email }) {
  const data = await callAppsScript('getPending', { email })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.orgs ?? data.pending ?? []
}

export async function apiGetAllOrgs({ email }) {
  const data = await callAppsScript('getAllOrgs', { email })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data.orgs ?? []
}

export async function apiApproveOrg({ email, orgId }) {
  const data = await callAppsScript('approveOrg', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiDenyOrg({ email, orgId }) {
  const data = await callAppsScript('denyOrg', { email, orgId })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}

export async function apiUpdateMemberLimit({ email, orgId, limit }) {
  const data = await callAppsScript('updateMemberLimit', { email, orgId, limit })
  if (data.success === false) throw new Error(data.error ?? 'failed')
  return data
}
