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

## State + caching
- Components never call callAppsScript directly for data fetching — use Zustand store
- Write ops (add/edit/remove) may call directly but must invalidate store after
- Cache TTLs: locations 5m · inventory 2m · members 5m · auth 10m · activity_log 1m
- Store clears on logout and page refresh

## Routing + deploy
- HashRouter links always — never BrowserRouter
- Base: /clean-inventory/ · npm run deploy → GitHub Pages

## Env vars (all VITE_ = safe to expose, baked into build)
- VITE_GOOGLE_CLIENT_ID · VITE_APPS_SCRIPT_URL · VITE_SUPER_ADMIN_EMAIL
- True secrets → Apps Script Properties Service only

## Barcode lookup order
1. Org's own inventory sheet → 2. product_cache (master sheet) → 3. UPCitemdb proxy → 4. Open Food Facts → 5. Manual entry

## See also
- .claude/ARCHITECTURE.md — stack details, evolution plan
- .claude/AUTH.md — roles, permissions, invite system  
- .claude/SCHEMA.md — all Sheet tab column definitions
- .claude/ROADMAP.md — current status, future features