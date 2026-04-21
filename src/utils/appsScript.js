/**
 * callAppsScript — transport layer for all Apps Script GET requests.
 *
 * Apps Script is called via GET with URL parameters to avoid CORS preflight
 * issues. Every parameter value is encoded with encodeURIComponent.
 *
 * This file is the HTTP transport only. Named domain functions live in
 * src/store/api.js — import from there, not here, for all inventory operations.
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
 * Catalog (item definitions)
 *   getCatalogItems       { email, orgId }
 *   addCatalogItem        { email, orgId, itemName, brand, barcode, sku, unit, category, supplier, costPerUnit, reorderPoint, reorderQuantity, trackStock }
 *   updateCatalogItem     { email, orgId, catalogId, ...updatedFields }
 *   removeCatalogItem     { email, orgId, catalogId }  — blocked if stock records exist
 *
 * Inventory (stock records)
 *   getStockByLocation    { email, orgId, locationId }  locationId can be 'all'
 *   addStock              { email, orgId, catalogId, locationId, quantity, costPerUnitOverride, itemLowStockThreshold, expectedJobs }
 *   updateStock           { email, orgId, stockId, ...updatedFields }  — never touches quantity
 *   removeStock           { email, orgId, stockId }
 *
 * Stock operations (all log to stock_transactions + activity_log)
 *   deductItem            { email, orgId, stockId, quantity, notes, referenceId, referenceType }
 *   restockItem           { email, orgId, stockId, quantity, notes }
 *   adjustItem            { email, orgId, stockId, quantity, notes }  — notes required; quantity is absolute
 *   transferItem          { email, orgId, fromStockId, toStockId, quantity }
 *
 * Stock transactions
 *   getStockTransactions  { email, orgId, locationId }  locationId optional
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
