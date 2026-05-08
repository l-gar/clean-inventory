# Clean Inventory — FinsightLatino
React+Vite · GitHub Pages · HashRouter · react-i18next · Google OAuth · Sheets API

## Hard rules
- No hardcoded emails, keys, or credentials — use .env (gitignored)
- No new dependencies without checking existing ones first
- Never self-report role in frontend — always read from Apps Script response
- All Apps Script calls: GET only, encodeURIComponent on all params
  Pattern: fetch(`${VITE_APPS_SCRIPT_URL}?action=X&email=${encodeURIComponent(email)}`)

## Code style
- Token-efficient: no redundant comments, shorter names where clarity allows
- No inline comments except for complex calculations or non-obvious edge cases
- No "what" comments (// increment i) — only "why" comments
- Top-level function docstrings only
- Strip all unnecessary whitespace/boilerplate
- Prefer `clamp()` / `min()` / `max()` over media queries for fluid sizing
- One declaration per CSS rule — no shorthand that obscures intent (exception: `flex`, `padding`, `margin`)

## Responsive / mobile-first
- Design for 375px (iPhone SE) as the baseline; scale up, never down
- All layouts must be tested at 320px, 375px, 390px (iPhone 14), and 768px
- Use `min-width: 0` on flex/grid children to prevent overflow blowout
- `white-space: nowrap` + `text-overflow: ellipsis` + `overflow: hidden` on any text that sits inside a fixed-width flex item
- Never use fixed pixel heights on containers that hold dynamic text
- Always apply `env(safe-area-inset-*)` padding for iPhone notch / home bar
- Touch targets: minimum 44×44px (Apple HIG) — use padding, not width/height alone
- Avoid `hover`-only interactions — pair every hover state with a matching `active` state
- `webkit-tap-highlight-color: transparent` on interactive elements to suppress the grey flash on iOS Safari
- Pull-to-refresh is the standard reload mechanism for any page that fetches a list — call `usePullToRefresh(callback)` from `src/hooks/usePullToRefresh.js`; the gesture is handled globally by Layout and calls the registered callback on release

## i18n
- All user-facing text via t() hook — no hardcoded English strings
- Keys: snake_case descriptive (scan_barcode, save_item)
- Always add both en + es; uncertain Spanish → "ES: scan barcode" placeholder
- Locale files: src/locales/en.json + es.json

## Dark mode + theming
- CSS variables only — never hardcode colors
- Every component must work in light and dark mode

## Icons
- Font Awesome only — no other icon libraries, no emoji as icons

## Dates
- Never render a raw date string or timestamp — always format with `formatDate(value, i18n.language)` from `src/utils/date.js`
- `formatDate` handles null/undefined/unparseable values safely; never guard separately before calling it
- Display format: `{ year: 'numeric', month: 'short', day: 'numeric' }` — matches what members see on the Team tab (e.g. "Apr 25, 2026")

## Data normalization
- All field-name coercion (camelCase ↔ snake_case, alias resolution) lives in `src/domain/normalize.js` — never inline it in a page or hook
- Use `normalizeLocation` for any location object that may arrive as a string or with mixed field names
- Use `normalizeItem` for any raw stock/inventory record before it is rendered or classified
- Use `parseTrackStock` wherever a `track_stock` / `trackStock` value must become a boolean
- Adding a new normalization need? Add it to `src/domain/normalize.js`, not at the call site

## State + caching
- Components never call callAppsScript directly — use Zustand store for reads, `src/store/api.js` wrappers for writes
- Adding a new write operation? Add an `api*` wrapper in `src/store/api.js` first, then import it in the page — never call callAppsScript inline
- Write ops must invalidate the affected store slice after every successful mutation
- Every remote data resource must have a store slice: state + fetched timestamp + loading + error + fetch action + invalidate action
- Cache TTLs: locations 5m · inventory 2m · members 5m · invites 5m · auth 10m · activity_log 1m
- After a mutation, always invalidate the affected slice then call the fetch action to get fresh data — do not patch local state manually
- Store clears on logout and page refresh — add new slices to `clearStore`

## Loading states
- Two loading components only — never add a third:
  - `LoadingScreen` — full-screen animated logo; use only for initial page load when zero stale data exists
  - `InlineLoader` — thin 3px animated bar; use for background refreshes over existing content
- Never use `faSpinner` or any other spinner for page/section-level loading — it's `LoadingScreen` or `InlineLoader`
- Pages that fetch remote data must seed local state from sessionStorage so stale content displays instantly on hard refresh and navigation; show `InlineLoader` while the background refresh runs
- `isFirstLoad` pattern: `!hasStaleData && !sliceFetchedTimestamp` — only show `LoadingScreen` when there is truly nothing to display

## Tooltips
- One `useState(null)` controls which tooltip is open, keyed by a string ID — only one open at a time
- Trigger button calls `e.stopPropagation()` then toggles the ID; `useEffect` adds a document `click` listener while open to close on outside tap
- After mount, `useLayoutEffect` + `useRef` clamps horizontal position: reset `left` to `0`, measure `getBoundingClientRect()`, shift by overflow so the tooltip never exits the viewport (8px edge padding)
- Structure: `.tipWrap` (`position: relative; display: inline-flex`) wraps the trigger button and the tooltip div
- Tooltip div: `position: absolute; top: calc(100% + 8px); left: 0; z-index: 20` — floats below the trigger, `left` adjusted at runtime by the layout effect
- Styling: CSS vars only (`--color-surface`, `--gray-200`, `--gray-600`, `box-shadow`) so light/dark mode is automatic — no separate dark-mode overrides needed
- Arrow: `::before` pseudo-element at `top: -5px; left: 6px`, rotated 45°, matching `background` and `border-top/border-left` of the tooltip
- Canonical implementation: `src/components/StockSettings.jsx` + `src/components/StockSettings.module.css`

## Collapsible sections
- Animation: `display: grid; grid-template-rows: 1fr` → `0fr` on the wrapper; inner div has `overflow: hidden` — never use `max-height` or JS-measured heights
- Three-layer structure: `.wrap` (grid, transition) → `.inner` (overflow hidden) → content
- Section header: `position: sticky; top: 0; background: var(--color-page)` so it pins while scrolling; use `position: sticky` (not `relative`) so it still acts as a containing block
- Inset divider line: `::after` pseudo on the header with `position: absolute; bottom: 0; left: 16px; right: 16px; height: 1px; background: var(--gray-100)` — never a full-bleed `border-bottom`
- Breathing room: `padding-top: 8px` on the `.inner` div so the first card breathes below the line; this padding collapses to zero automatically when collapsed (clipped by `overflow: hidden`)
- Count badge: pill chip — `background: var(--gray-100); color: var(--gray-500); padding: 2px 7px; border-radius: 99px; font-size: 11px; font-weight: 800`
- Chevron rotation: `transition: transform 0.2s` with `rotate(-90deg)` when collapsed
- Canonical implementations: `StockHealth.jsx/.module.css`, `ActivityLog.jsx/.module.css`, `ItemHistory.jsx/.module.css`

## Shared UI components
- Error states → `ErrorState` (`src/components/ErrorState.jsx`): `variant="banner"` (red inline, e.g. InventoryList) or default centered (e.g. MembersPage, Locations)
- Empty/no-data states → `EmptyState` (`src/components/EmptyState.jsx`): pass `icon`, `title`, optional `body`/`hint`/`action`; use `iconCircle` for prominent full-page empty states, `fill` for full-height centering
- Inline delete/revoke/remove confirmations → `ConfirmBlock` (`src/components/ConfirmBlock.jsx`): pass `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `onCancel`, `busy`, `error`
- Never re-implement these patterns inline in a page — always use the shared component

## Routing + deploy
- HashRouter links always — never BrowserRouter
- Base: /clean-inventory/ · npm run deploy → GitHub Pages

## Env vars (all VITE_ = safe to expose, baked into build)
- VITE_GOOGLE_CLIENT_ID · VITE_APPS_SCRIPT_URL · VITE_SUPER_ADMIN_EMAIL
- True secrets → Apps Script Properties Service only

## Barcode lookup order
1. Org's own inventory sheet → 2. product_cache (master sheet) → 3. UPCitemdb proxy → 4. Open Food Facts → 5. Manual entry

## See also
- .claude/STRUCTURE.md — full file-by-file navigation map (start here)
- .claude/ARCHITECTURE.md — stack details, evolution plan
- .claude/AUTH.md — roles, permissions, invite system  
- .claude/SCHEMA.md — all Sheet tab column definitions
- .claude/ROADMAP.md — current status, future features