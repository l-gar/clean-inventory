# Stock Health Page — Design Brief

## Page purpose
Surfaces inventory items that need attention based on stock levels.
Visible to org_owner and manager roles only. org_members do not see this page.
Managers see only their assigned locations. Owners see all locations.

## Data source
All data comes from the existing inventory store via fetchInventory(email, orgId, 'all').
Each stock record is pre-joined with catalog fields from the backend.
Before building this page, ensure normalizeItem in InventoryList.jsx explicitly aliases:
- track_stock
- reorder_point

Do not fetch catalog separately. Do not add new backend endpoints.

## Effective threshold logic
Each item's alert threshold resolves in this order:
1. item_low_stock_threshold on the inventory record (per location, nullable)
2. org.lowStockThreshold from the org store (org-wide fallback)
Never alert on items where track_stock is false or null.

## Alert tiers (in priority order)
1. Out of stock — quantity === 0
2. Low stock — quantity > 0 and quantity <= effective threshold
3. Below reorder point — quantity <= reorder_point (softer advisory, only show if reorder_point is set)

## expected_jobs field
expected_jobs on the inventory record is a durability estimate set by the user —
it means "one unit of this item is expected to last X jobs."
It is NOT a demand forecast or a quantity-to-jobs comparison.
Do not use it for threshold logic. Do not display it as a warning condition.
It can be displayed as informational context on an item card if relevant.

## Page name
"Stock Health" is preferred over "Alerts" to avoid implying the page
only activates when something is wrong.

## What this page is not
- Not a notification center
- Not an email alert settings panel (that lives in org settings)
- Not a transaction log

## Future considerations (do not build yet)
- Velocity-based estimates (days remaining based on recent usage from stock_transactions)
- last_inventory_update staleness optimization
- In-app push notifications