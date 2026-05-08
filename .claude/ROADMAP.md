# Roadmap

## Done
- Barcode scanning (Open Food Facts + UPCitemdb via Apps Script proxy)
- i18n · dark mode · language toggle on auth screens
- Google OAuth · Apps Script · auth + permissions (4 roles)
- Org registration + approval flow · ConnectSheet flow
- Persistent auth across refreshes
- Location management (add/edit/delete · empty state · redirect after first location)
- Google Sheets read/write
- Inventory list screen
- Scan & Update (barcode scan + search by name · improved feedback UI)
- Low stock indicators
- Stock Health page (health bars · restock projections · reorder tracking)
- Invite link system
- Stock transfer between locations
- Edit Item page (Catalog / Health Targets / This Location section layout)
- Version tracking (package.json → Settings footer)
- Activity Log page (chronological feed · category/location/date filters · color-coded action dots · pull-to-refresh · role-based visibility)
- Members moved to Settings → Organization section; Activity Log added to bottom nav (all roles)
- MembersPage back button → returns to Settings; Settings stays highlighted in bottom nav on /members

- Item transaction history (per-item timeline · location-scoped · day-grouped cards · color-coded type icons · delta chips · pull-to-refresh · History button on inventory list rows)
- Logout with confirmation — bottom sheet in `Layout.jsx` (shows signed-in email · Sign Out + Cancel). Onboarding-flow logouts stay immediate.

## In progress

## Pending
- Admin page
- Manager role UI refinement
- Google Picker for existing Sheet

## Future (do not build yet)
- Reorder / purchase orders (after per-item tracking is done)
- Cost tracking: supplier name · purchase history · spend reports
- Job-based consumption tracking (expected_jobs column already in sheet)
- Tiered org plans · custom domain support