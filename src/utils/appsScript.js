/**
 * callAppsScript — single entry point for all Apps Script GET requests.
 *
 * Apps Script is called via GET with URL parameters to avoid CORS preflight
 * issues. Every parameter value is encoded with encodeURIComponent.
 *
 * Usage:
 *   import { callAppsScript } from '../utils/appsScript'
 *   const data = await callAppsScript('checkAuth', { email })
 *
 * ─── Supported actions ────────────────────────────────────────────────────
 *
 * Auth
 *   checkAuth             { email }
 *   registerOrg           { email, orgName }
 *   validateInvite        { token, email }
 *   joinOrg               { token, email }
 *
 * Org management
 *   connectSheet          { email, orgId, sheetId }
 *   updateOrgName         { email, orgId, orgName }
 *   getOrgMembers         { email, orgId }
 *   removeMember          { email, targetEmail, orgId }
 *   generateInvite        { email, orgId }
 *   revokeInvite          { email, token }
 *
 * Locations
 *   getLocations              { email, orgId }
 *   addLocation               { email, orgId, locationName }
 *   updateLocation            { email, orgId, locationId, locationName }
 *   removeLocation            { email, orgId, locationId }
 *   assignLocation            { email, targetEmail, orgId, locationId }
 *   removeLocationAssignment  { email, targetEmail, orgId, locationId }
 *
 * Settings
 *   updateAlertSetting    { email, orgId, enabled }
 *   updateThreshold       { email, orgId, threshold }
 *
 * Inventory
 *   getInventory          { email, orgId, locationId }  locationId can be 'all'
 *   addItem               { email, orgId, itemName, brand, barcode, quantity, unit, category, locationId, costPerUnit, expectedJobs, trackStock }
 *   updateItem            { email, orgId, itemId, ...updates (only defined keys) }
 *   removeItem            { email, orgId, itemId }
 *
 * Activity log
 *   getActivityLog        { email, orgId, locationId }  locationId can be 'all'
 *
 * Barcode proxy
 *   lookupBarcode         { upc }
 *
 * Admin only
 *   getPending            { email }
 *   getAllOrgs            { email }
 *   approveOrg            { email, orgId }
 *   denyOrg               { email, orgId }
 *   updateMemberLimit     { email, orgId, limit }
 *   getAllUsers            { email }
 *
 * ──────────────────────────────────────────────────────────────────────────
 *
 * @param {string} action - The Apps Script action name
 * @param {Record<string, string|number|boolean>} params - Query parameters
 * @returns {Promise<object>} Parsed JSON response from Apps Script
 * @throws {Error} If the response is not valid JSON
 */
export async function callAppsScript(action, params = {}) {
  const base = import.meta.env.VITE_APPS_SCRIPT_URL

  const pairs = [`action=${encodeURIComponent(action)}`]
  for (const [key, value] of Object.entries(params)) {
    pairs.push(`${key}=${encodeURIComponent(value)}`)
  }
  const url = `${base}?${pairs.join('&')}`

  const res = await fetch(url)
  const text = await res.text()

  try {
    return JSON.parse(text)
  } catch {
    throw new Error(
      `Apps Script action "${action}" returned non-JSON (HTTP ${res.status}): ${text}`
    )
  }
}

// ─── Inventory helpers ────────────────────────────────────────────────────────

export function getInventory(email, orgId, locationId) {
  return callAppsScript('getInventory', { email, orgId, locationId })
}

export function addItem(email, orgId, itemData) {
  const { itemName, brand, barcode, quantity, unit, category, locationId, costPerUnit, expectedJobs, trackStock } = itemData
  return callAppsScript('addItem', {
    email,
    orgId,
    itemName,
    brand,
    barcode,
    quantity,
    unit,
    category,
    locationId,
    costPerUnit,
    expectedJobs,
    trackStock,
  })
}

export function updateItem(email, orgId, itemId, updates) {
  const defined = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) defined[key] = value
  }
  return callAppsScript('updateItem', { email, orgId, itemId, ...defined })
}

export function removeItem(email, orgId, itemId) {
  return callAppsScript('removeItem', { email, orgId, itemId })
}

// ─── Activity log helpers ─────────────────────────────────────────────────────

export function getActivityLog(email, orgId, locationId) {
  return callAppsScript('getActivityLog', { email, orgId, locationId })
}
