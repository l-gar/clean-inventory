# Sheet Schemas

## Master Sheet (finsightlatino account)

### organizations
org_id | org_name | owner_email | sheet_id | status | member_limit | email_alerts_enabled | low_stock_threshold | created_date

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

### inventory
item_id | item_name | brand | barcode | quantity | unit | category | location_id | cost_per_unit | expected_jobs | last_restocked_date | item_low_stock_threshold | track_stock | added_by | added_date | last_updated_by | last_updated_date

### activity_log
timestamp | action | item_id | item_name | quantity_before | quantity_after | location_id | performed_by | role

## Activity log rules
- Auto-logged on every inventory change — never ask user to log manually
- Actions: item_added · item_edited · item_removed · member_added · member_removed · location_assigned
- Apps Script appends on every write
- Visibility: org_owner → all · manager → assigned locations · org_member → own actions only