# Clean Inventory Optimization Checklist

Created: 2026-04-21
Purpose: Track optimization work in a safe rollout order without breaking existing behavior.

## How To Use
- Work top to bottom.
- Keep PRs small (one section or one major task per PR).
- Check each box only after validation passes.

## Phase 1 - Centralize Data Normalization (Low Risk, High ROI)

Issue title suggestion: `tech-debt: centralize item/location normalization helpers`

- [x] Create shared normalization module (for example `src/domain/normalize.js`).
- [x] Move `normalizeLocation` logic out of page-level files into shared module.
- [x] Move item normalization + `track_stock` parsing into shared module.
- [x] Replace duplicated normalization logic in:
  - `src/pages/InventoryList.jsx`
  - `src/pages/EditItem.jsx`
  - `src/pages/StockHealth.jsx`
  - `src/hooks/useLocations.js`
- [ ] Confirm output shapes remain unchanged (`location_id`, `location_name`, `itemId`, etc.).
- [ ] Validate role-based rendering still works for owner/manager/member.

Acceptance criteria:
- [x] No duplicate normalizer functions remain in pages/hooks.
- [ ] No visual or behavior changes observed in Inventory, Edit, Stock Health.

## Phase 2 - Move Members + Invites Reads into Store (API Call Reduction)

Issue title suggestion: `perf: move members and invites reads into zustand store with ttl`

- [x] Add `invites` store slice (`invites`, `invitesFetched`, `invitesLoading`, `invitesError`).
- [x] Add `fetchInvites` + `invalidateInvites` actions with TTL behavior.
- [x] Ensure members slice has consistent TTL/invalidation use from page.
- [x] Update `src/pages/MembersPage.jsx` to use store selectors/actions instead of direct read fetches.
- [x] Keep mutation flows (generate/revoke/remove) followed by targeted invalidation or local optimistic updates.

Acceptance criteria:
- [ ] Opening Members page does not refetch members/invites within TTL.
- [ ] Team and Invite tabs remain functionally identical.
- [ ] Error/loading states still display correctly.

## Phase 3 - Standardize Write Call Paths (Consistency)

Issue title suggestion: `refactor: replace page-level callAppsScript writes with api wrappers`

- [x] Add missing write wrappers in `src/store/api.js` for page-level direct write calls.
- [x] Replace direct `callAppsScript` write usage in:
  - `src/pages/InventoryList.jsx` (transfer)
  - `src/pages/Locations.jsx` (add/update/remove location)
  - `src/pages/Settings.jsx` (org name/threshold updates)
- [x] Preserve existing invalidate behavior and user-facing error messages.

Acceptance criteria:
- [ ] All page write operations use API-layer wrappers.
- [ ] No change in UX for successful and failed operations.

## Phase 4 - Extract Reusable UI Blocks (Maintainability)

Issue title suggestion: `ui-refactor: extract shared error-empty-confirm components`

- [x] Create reusable `ErrorState` component (message + retry action).
- [x] Create reusable `EmptyState` component (icon/title/body/action).
- [x] Create reusable inline confirmation component/block for delete/revoke/remove flows.
- [x] Create reusable `InlineLoader` component (extracted from InventoryList loading bar — replaces all non-full-screen loading states).
- [x] Replace repeated JSX patterns in:
  - `src/pages/InventoryList.jsx`
  - `src/pages/MembersPage.jsx`
  - `src/pages/Locations.jsx`
  - `src/pages/Settings.jsx` (no applicable patterns)
- [ ] Verify CSS module class mappings do not regress spacing/alignment.

Acceptance criteria:
- [ ] Repeated state UI blocks are centralized.
- [ ] UI remains visually consistent on mobile and desktop.

## Phase 5 - Scan/Lookup Efficiency (Performance)

Issue title suggestion: `perf: optimize scan lookup with store-level barcode index`

- [x] Add store-level helper for barcode lookup against cached inventory.
- [x] Consider transient barcode index map for `locationId='all'` inventory cache.
- [x] Keep existing fallback path to server barcode lookup.
- [x] Update `src/pages/ScanUpdate.jsx` to use helper/index first.

Acceptance criteria:
- [ ] Repeated scans in a session avoid unnecessary heavy work.
- [ ] Lookup results stay identical to current behavior.

## Validation Checklist (Run After Each Phase)

- [ ] Owner flow smoke test: inventory, scan/update, settings.
- [ ] Manager flow smoke test: inventory, member/location actions allowed for manager.
- [ ] Org member flow smoke test: restricted actions still enforced.
- [ ] Hard refresh test: location/inventory stale-first behavior still works.
- [ ] Mutation test: add/update/remove/transfer invalidate and refresh correctly.
- [ ] No new console errors in main pages.

## Nice-To-Have Tracking Metadata

- [ ] Add label set in GitHub: `optimization`, `tech-debt`, `performance`, `refactor`.
- [ ] Link each PR to one checklist phase.
- [ ] Record before/after notes for API-call count and perceived load time.

## GitHub Issues Status

Repository remote detected: `https://github.com/l-gar/clean-inventory.git`

Current blocker for auto-creating issues from here:
- GitHub CLI (`gh`) is not installed or not available in PATH on this machine.

Manual fallback:
- Copy each `Issue title suggestion` above into GitHub Issues and paste the relevant phase checklist into the issue body.
