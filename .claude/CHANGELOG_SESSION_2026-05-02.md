# Session Changelog — 2026-05-02

## MembersPage UI Redesign

### Header & Tabs
- Merged page header and tab bar into a single sticky block
- Added live subtitle with member count and active invite count
- Tab badges use `--gray-200` background (not `--gray-100`) so they remain visible in dark mode

### Team Tab — Member Cards
- Replaced static icon with initials avatar: 42×42px circle, color derived from email hash via `src/utils/avatar.js`
- Avatar palette: 6 colors (purple, green, red, blue, amber, pink)
- Email + role badge on top row; joined date on its own line; location chips on their own line below
- Location chips show max 2 by default; "+X more" button expands inline, "less" collapses back
- `org_owner` members never show location chips (they have full access — chips are noise)
- Delete confirmation already existed via `ConfirmBlock`; added `cardConfirmWrap` so it fills card width correctly
- Icon buttons updated: 34×34px, `1.5px var(--color-border)` border, transparent background

### Invites Tab
- Generate section redesigned: icon box + title + expiry subtitle + role grid buttons
- Active links label added above invite list
- Invite cards restructured: icon box, token, role badge, created-by, copy + revoke actions
- Expiry progress bar at top of card (green → amber → red as time runs out); hidden when expired

### Dark Mode Fixes
- Tab badges and location chips both used `--gray-100` which equals `--color-surface` in dark mode → invisible
- Fixed by stepping up to `--gray-200` for pill backgrounds throughout MembersPage

---

## Shared Avatar Utility (`src/utils/avatar.js`)

New file extracted from MembersPage so both pages share consistent avatar logic:
- `getAvatarColors(email)` — returns `{ background, color }` ready to spread as inline style
- `getInitials(email)` — splits on `[._+\-]`, returns first two part initials or first 2 chars
- Used by: `MembersPage.jsx`, `Settings.jsx`
- Settings avatar previously used hardcoded `--green-100 / --green-800`; now uses palette

---

## Stock Health Feature Upgrade

### Backend fields wired (`src/domain/normalize.js`)
Added `nullableNum` helper and 8 new fields to `normalizeItem`:
- `resolvedTargetQty`, `resolvedRestockCycleDays`, `resolvedCost` — pre-resolved by Apps Script
- `reorderQuantity` — from item_catalog
- `targetQuantity`, `restockCycleDays` — catalog-level defaults
- `targetQuantityOverride`, `restockCycleDaysOverride` — per-location overrides

### Computation utility (`src/utils/stockHealth.js`)
New pure function `computeStockHealth(normalizedItem)` returns:
- `healthPct` — 0–1 fill level, null if no target set
- `alertMarkerPct`, `reorderMarkerPct` — tick positions on bar, null if not calculable
- `daysRemaining`, `projectedStockoutDate` — based on daily consumption rate
- `urgency` — `order_now` (≤7 days) | `order_soon` (≤30% of cycle) | `healthy` | null
- `reorderCost` — reorderQuantity × resolvedCost, null if either missing

### StockHealth page (`src/pages/StockHealth.jsx`)
- Role gate: `org_member` redirected to `/inventory` on mount
- `ItemCard` now calls `computeStockHealth` and conditionally renders:
  - Progress bar with amber tick (alert threshold) and blue tick (reorder point)
  - "X% remaining", "~X days left", "Runs out ~[date]" meta labels
  - **Order Now** badge (red, bolt icon) or **Order Soon** badge (amber, cart icon)
- Owner-only cash flow panel above summary counters: sums `reorderCost` for all items with `daysRemaining ≤ 14`
- Items without `resolvedTargetQty` show badge-only (no bar, no day labels) — same as before

### StockHealth CSS (`src/pages/StockHealth.module.css`)
Added: `.healthBar`, `.healthFill`, `.healthFill_{out,low,reorder}`, `.tickAlert`, `.tickReorder`, `.urgencyBadge`, `.urgencyOrderNow`, `.urgencyOrderSoon`, `.cashFlowPanel`, `.cashFlowLabel`, `.cashFlowAmount`

### EditItem health fields (`src/pages/EditItem.jsx`)
New **Health Settings** card (heart-pulse icon) for `canEditAll` users:
- Owner-only row: **Target Qty** + **Cycle Days** (catalog defaults → sent to `apiUpdateCatalogItem`)
- Manager+ row: **Target Qty (location)** + **Cycle Days (location)** overrides (→ `apiUpdateStock`)
- Override placeholders show the catalog default value when blank

---

## i18n Keys Added

### `stock_health` object
`healthPct`, `daysLeft`, `runsOut`, `orderNow`, `orderSoon`, `cashFlow`

### Top-level
`health_settings`, `target_qty`, `target_qty_override`, `restock_cycle_days`, `restock_cycle_override`

### `members` object
`subtitle`, `invite_expires`, `active_links`, `expired`, `expires`, `created_by`, `more`, `less`

All keys added to both `en.json` and `es.json`.
