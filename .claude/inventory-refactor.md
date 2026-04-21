# Inventory Refactor — Planning Context

This document explains the decisions made during the inventory system redesign.
It exists to give Claude Code the intent behind the architecture, not just the code.

---

## Why We Refactored

The original schema had a single `inventory` table that mixed item definitions
with stock levels. This caused:
- Duplicate item data across locations (same barcode, repeated name/brand/cost)
- No clean way to transfer stock between locations
- No way to distinguish why quantity changed (usage vs correction vs restock)
- No cost history for monthly reporting

---

## Function Map

### Retired Functions
| Old Function | Reason |
|---|---|
| `getInventory` | Replaced by `getStockByLocation` |
| `addItem` | Replaced by `addCatalogItem` + `addStock` |
| `updateItem` | Replaced by `updateCatalogItem` + `updateStock` |
| `removeItem` | Replaced by `removeCatalogItem` + `removeStock` |

### New Functions
| Function | Purpose |
|---|---|
| `getCatalogItems` | Read all catalog definitions for an org |
| `getStockByLocation` | Read inventory stocks joined with catalog data |
| `getStockTransactions` | Read transaction history with optional filters |
| `addCatalogItem` | Create a new item definition in item_catalog |
| `addStock` | Create a stock record for a catalog item at a location |
| `updateCatalogItem` | Update item definition metadata only |
| `updateStock` | Update stock metadata only (no quantity) |
| `deductItem` | Reduce quantity — job usage or sale |
| `restockItem` | Increase quantity — stock received |
| `adjustItem` | Set absolute quantity — correction only |
| `transferItem` | Move quantity between two locations |
| `removeCatalogItem` | Delete catalog item (blocked if stock exists) |
| `removeStock` | Delete a stock record at a location |

### Shared Helpers
| Helper | Purpose |
|---|---|
| `resolveCost(ss, catalogId, costOverride)` | Returns cost override if set, otherwise catalog default |
| `logStockTransaction(sheetId, data)` | Appends to stock_transactions tab |
| `logActivity(sheetId, entry)` | Appends to activity_log tab (unchanged) |
| `updateLastInventoryTimestamp(orgId)` | Updates last_inventory_update on org row in master sheet |

---

## Key Rules Claude Code Must Respect

### Quantity changes
- `updateCatalogItem` and `updateStock` must NEVER touch quantity
- Quantity only changes through: `deductItem`, `restockItem`, `adjustItem`, `transferItem`
- Every quantity change must log to both `stock_transactions` AND `activity_log`
- Every quantity change must call `updateLastInventoryTimestamp` at the end

### Cost resolution
- Always use `resolveCost(ss, catalogId, costOverride)` helper
- Never inline the cost resolution logic — it was duplicated across four functions and consolidated into this helper
- Resolution order: location cost_per_unit_override → catalog cost_per_unit → null
- `cost_per_unit_at_time` must be snapshotted at the moment of every stock transaction

### Transfers
- Both `transfer_out` and `transfer_in` rows must be written to `stock_transactions`
- `transfer_to_location_id` is only populated on the `transfer_out` row
- Destination stock record must already exist — transferItem takes `toStockId` not `toLocationId`
- Cannot transfer to the same location

### Adjustments
- `notes` field is required on `adjustItem` — enforce this, do not make it optional
- `adjustItem` takes an absolute quantity (what it should be), not a delta
- `quantity_delta` in the transaction is calculated as: newQuantity - quantityBefore

### Catalog deletion
- `removeCatalogItem` must check for existing stock records first
- Block deletion and return an error if any inventory rows reference that catalog_id
- This prevents orphaned stock records

### Duplicate stock prevention
- `addStock` must check for an existing row with the same catalog_id + location_id
- Return an error if a duplicate would be created

---

## Role Permissions

| Function | org_owner | manager | org_member |
|---|---|---|---|
| getCatalogItems | ✅ | ✅ | ✅ |
| getStockByLocation | ✅ | ✅ own locations | ✅ own locations |
| getStockTransactions | ✅ | ✅ own locations | ❌ |
| getActivityLog | ✅ | ✅ own locations | ❌ |
| addCatalogItem | ✅ | ✅ | ✅ |
| addStock | ✅ | ✅ own locations | ✅ own locations |
| updateCatalogItem | ✅ | ✅ | ❌ |
| updateStock | ✅ | ✅ own locations | ✅ own locations |
| deductItem | ✅ | ✅ own locations | ✅ own locations |
| restockItem | ✅ | ✅ own locations | ✅ own locations |
| adjustItem | ✅ | ✅ own locations | ❌ |
| transferItem | ✅ | ✅ both locations | ✅ both locations |
| removeCatalogItem | ✅ | ❌ | ❌ |
| removeStock | ✅ | ✅ own locations | ❌ |

"own locations" means the user must pass `checkLocationAccess` for that location_id.

---

## Cost Design

- `cost_per_unit` on `item_catalog` is the org-wide default
- `cost_per_unit_override` on `inventory` is a nullable per-location override
- Small orgs with one supplier price never need to touch the override
- Orgs with regional pricing set the override only where it differs
- No location grouping — kept simple intentionally, two-tier covers 90% of cases

---

## Frontend Caching Strategy

- On first load fetch everything the user has access to in one call
- Store result client-side with a `fetchedAt` timestamp
- Location switching filters the cached data in memory — no additional API calls
- On any write operation invalidate the cache
- Before re-fetching pass `clientTimestamp` to read functions
- If server returns `{ upToDate: true }` skip the update entirely
- `last_inventory_update` on the org row is the source of truth for cache validity

---

## Future Considerations (do not build yet)

- `reference_id` and `reference_type` on stock_transactions are reserved for
  linking transactions to jobs and orders when those features are built
- `transaction_type: sale` is reserved for when selling is added
- Location grouping for regional cost defaults was considered and intentionally
  deferred — the two-tier override model is sufficient for now
- Supplier table for full procurement management was considered and deferred
  — `supplier` field on item_catalog is a plain text field for now