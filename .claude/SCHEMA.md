# Sheet Schemas

## Master Sheet (finsightlatino account)

### organizations
org_id | org_name | owner_email | sheet_id | status | member_limit | email_alerts_enabled | low_stock_threshold | last_inventory_update | created_date

`last_inventory_update` — timestamp updated on every inventory write.
Used by frontend to skip re-fetching unchanged data.

### users
email | role | org_id | status | invited_by | joined_date | removed_date

### invite_links
token | org_id | role | created_by | expires_date | used | revoked

### locations
location_id | org_id | location_name | created_date

### member_locations
email | org_id | location_id | assigned_by | assigned_date | status
(status: active | inactive — never delete rows, supports floater scenario)

### product_cache
upc | item_name | brand | description | cached_date

## Org Inventory Sheet (org owner's Google account)

### item_catalog
catalog_id | org_id | item_name | brand | barcode | sku | description | unit | category | supplier | cost_per_unit | reorder_point | reorder_quantity | track_stock | added_by | added_date | last_updated_by | last_updated_date | target_quantity | restock_cycle_days

- One row per unique item definition
- `cost_per_unit` is the org-wide default cost
- Barcode lives here, not on the stock record
- `target_quantity` is the org-wide default max quantity for this item — used as the 100% reference point for stock health bars. Nullable — if not set, item displays badge-only, no health bar
- `restock_cycle_days` is how many days a full stock of this item typically lasts under normal usage. Combined with `target_quantity` to derive daily consumption rate and projected stockout date. Nullable

### inventory
stock_id | catalog_id | location_id | quantity | cost_per_unit_override | item_low_stock_threshold | expected_jobs | last_restocked_date | added_by | added_date | last_updated_by | last_updated_date | target_quantity_override | restock_cycle_days_override

- One row per catalog item × location combination
- Duplicate catalog_id + location_id is not allowed
- `cost_per_unit_override` is nullable — null means use catalog default
- `target_quantity_override` is nullable — null means use catalog `target_quantity`
- `restock_cycle_days_override` is nullable — null means use catalog `restock_cycle_days`
- quantity is NEVER updated directly — only through dedicated functions

### stock_transactions
transaction_id | catalog_id | stock_id | location_id | transaction_type | quantity_before | quantity_after | quantity_delta | cost_per_unit_at_time | transfer_to_location_id | reference_id | reference_type | performed_by | role | notes | timestamp

transaction_type values:
- job_usage    — supplies consumed on a job
- sale         — item sold (future use)
- restock      — stock received
- transfer_out — stock leaving a location
- transfer_in  — stock arriving at a location
- adjustment   — manual correction
- initial_count — starting quantity when stock record first created

reference_type values: job | order | purchase_order | null

- `quantity_delta` is signed: negative for deductions, positive for additions
- `cost_per_unit_at_time` snapshots cost at moment of transaction for reporting
- `transfer_to_location_id` only populated on transfer_out rows
- `reference_id` and `reference_type` are nullable, reserved for future
  job/order linking

### activity_log
timestamp | action | item_id | item_name | quantity_before | quantity_after | location_id | performed_by | role

Action values:
item_added | item_edited | item_removed | stock_deducted | stock_restocked |
stock_transferred | stock_adjusted | member_added | member_removed |
location_assigned

Rules:
- Auto-logged on every inventory change — never ask user to log manually
- Apps Script appends on every write
- Visibility: org_owner → all | manager → assigned locations | org_member → own actions only