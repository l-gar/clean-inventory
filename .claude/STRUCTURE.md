# Project Structure — Clean Inventory

React 19 + Vite SPA. Backend is Google Apps Script (external). State is Zustand with TTL caching. Auth is Google OAuth with role-based routing.

---

## Top-Level

```
clean-inventory/
├── index.html          # HTML entry; sets dark mode from localStorage, loads font, mounts React
├── vite.config.js      # Vite + React plugin; base path /clean-inventory/
├── package.json        # Dependencies: React 19, Zustand, i18next, vite-plugin-pwa, QR scanning
├── eslint.config.js    # ESLint rules for JSX/React hooks
├── .env                # VITE_GOOGLE_CLIENT_ID, VITE_APPS_SCRIPT_URL, VITE_SUPER_ADMIN_EMAIL
├── CLAUDE.md           # Project rules and conventions for Claude Code
└── .claude/            # Claude Code session docs (see below)
```

---

## src/

### Entry & Routing

| File | Role |
|------|------|
| `src/main.jsx` | Mounts app: HashRouter → AuthProvider → App |
| `src/App.jsx` | Role-based route guards: pending / new_user / org_owner / manager / org_member; feature gates: needsSheet, needsLocations |
| `src/i18n.js` | i18next setup; loads en/es from locales/, falls back to localStorage lang pref |
| `src/index.css` | Global CSS variables — color palette, semantic tokens, dark mode; never hardcode colors outside here |
| `src/App.css` | Minimal app-level styles (most styling is CSS Modules per component) |

---

### src/pages/ — Full-page views

Auth / onboarding (unauthenticated or role-gated):

| File | Route / purpose |
|------|----------------|
| `Login.jsx` | Google OAuth sign-in; reads/writes localStorage user |
| `PendingApproval.jsx` | Waiting screen for users awaiting admin approval |
| `RegisterOrg.jsx` | New org registration form (org_owner first-run) |
| `ConnectSheet.jsx` | Google Sheets linking (org_owner after registration) |
| `Locations.jsx` | Create/edit/delete locations (org_owner, manager) |
| `JoinPage.jsx` | Public invite acceptance via token (unauthenticated) |

Main app (authenticated):

| File | Route / purpose |
|------|----------------|
| `ScanUpdate.jsx` | Barcode scanner — primary stock entry; follows barcode lookup order in CLAUDE.md |
| `InventoryList.jsx` + `.module.css` | Tabular inventory; search, location filter, transfer, sessionStorage seeding |
| `StockHealth.jsx` + `.module.css` | Org-wide low-stock view and supply chain health metrics |
| `EditItem.jsx` + `.module.css` | Single-item detail/edit: notes, history, location-specific thresholds |
| `ItemHistory.jsx` + `.module.css` | Transaction history for one stock record |
| `ActivityLog.jsx` + `.module.css` | Full audit trail; filterable by user and date |
| `MembersPage.jsx` + `.module.css` | Member list, invite, and remove (org_owner, manager) |
| `Alerts.jsx` + `.module.css` | Low-stock alert notifications and resolution |
| `Settings.jsx` + `.module.css` | Dark mode, language, alert prefs, org name, location management |

---

### src/components/ — Reusable UI

Layout / chrome:

| File | Role |
|------|------|
| `Layout.jsx` + `.module.css` | App shell: pull-to-refresh gesture, header, bottom nav, child routes. Header logout button opens a bottom-sheet confirmation (shows signed-in email; Sign Out / Cancel). Onboarding-flow logouts bypass this sheet. |
| `BottomNav.jsx` + `.module.css` | Tab bar: scan-update, inventory, stock-health, settings, activity-log, members (role-gated) |
| `LocationSelect.jsx` + `.module.css` | Location dropdown — switches active location |
| `LangToggle.jsx` + `.module.css` | EN/ES switcher; persists to localStorage |

Shared UI patterns (use these — never re-implement inline):

| File | When to use |
|------|------------|
| `LoadingScreen.jsx` + `.module.css` | Full-screen load — only when zero stale data exists |
| `InlineLoader.jsx` + `.module.css` | 3px bar for background refreshes over existing content |
| `ErrorState.jsx` + `.module.css` | `variant="banner"` (inline red) or default centered; never custom error UI |
| `EmptyState.jsx` + `.module.css` | Empty/no-data states; props: icon, title, body, hint, action, iconCircle, fill |
| `ConfirmBlock.jsx` + `.module.css` | Inline delete/revoke/remove confirmations; props: message, confirmLabel, cancelLabel, onConfirm, onCancel, busy, error |
| `SaveSuccessSplash.jsx` + `.module.css` | Auto-dismissing success toast (2 s) |

Form / input widgets:

| File | Role |
|------|------|
| `CategoryInput.jsx` + `.module.css` | Category field with suggestions |
| `StockAdjuster.jsx` + `.module.css` | ± spinner for quantity adjustments |
| `StockSettings.jsx` + `.module.css` | Low-stock alert threshold form; **canonical tooltip implementation** |
| `NotesSection.jsx` + `.module.css` | Textarea for item notes |
| `TransferSheet.jsx` + `.module.css` | Bottom-sheet modal for stock transfers |
| `TransferPanel.jsx` + `.module.css` | Content inside TransferSheet |

---

### src/store/ — Zustand state

| File | Role |
|------|------|
| `index.js` | Single store (425+ lines). Slices: locations (5 m TTL), catalog (5 m), inventory (2 m), stockTransactions (1 m), itemTransactions, members (5 m), invites (5 m), activityLog (1 m). Manages sessionStorage seeding and `clearStore()` on logout. |
| `api.js` | Domain API layer — wraps all `callAppsScript` actions. Exports `api*` write functions (apiAddStock, apiUpdateCatalogItem, apiTransferItem, …). **Components must call store write wrappers here, never callAppsScript directly.** After a write, call `invalidate*()` then the fetch action — never patch local state. |

---

### src/context/ — React contexts

| File | Role |
|------|------|
| `AuthContext.jsx` | User state (email, role, orgId, orgStatus, hasLocations), access token, background revalidation. Persists to `cleaninv_user` / `cleaninv_access_token` in localStorage. Exports `useAuth()`. |
| `PullToRefreshContext.jsx` | Gesture context wired into Layout; pages register a refresh callback via `usePullToRefresh`. |

---

### src/hooks/ — Custom hooks

| File | Role |
|------|------|
| `useLocations.js` | Fetches location list from store; returns loading/error state |
| `usePullToRefresh.js` | Registers a page's refresh callback with PullToRefreshContext |

---

### src/utils/ — Utilities

| File | Role |
|------|------|
| `appsScript.js` | HTTP transport for all Apps Script calls. Documents 30+ actions. GET-only, all params URL-encoded. |
| `date.js` | `formatDate(value, lang)` — always use this; never render raw date strings |
| `avatar.js` | Generates initials/color from email |
| `stockHealth.js` | `computeStockHealth` (metrics from a normalized item) · `classifyItem` (returns `'out'`/`'low'`/`'reorder'`/`null`) · `effectiveThreshold` (item-level threshold with org-% fallback). Used by StockHealth page and BottomNav badge. |

---

### src/domain/ — Domain logic

| File | Role |
|------|------|
| `normalize.js` | **All** field-name coercion lives here. Exports: `normalizeLocation`, `normalizeItem`, `normalizeActivityEntry`, `parseTrackStock`, `nullableNum`. Never inline normalization in a page or hook. |

---

### src/locales/ — i18n translations

| File | Role |
|------|------|
| `en.json` | English strings (keys: snake_case) |
| `es.json` | Spanish strings (uncertain translations marked "ES: …") |

---

### src/assets/ — Static images

| File | Role |
|------|------|
| `hero.png` | Onboarding hero image |
| `react.svg`, `vite.svg` | Template assets (unused in production UI) |

---

## public/

| File | Role |
|------|------|
| `favicon.svg` | Browser favicon |
| `icons.svg` | Inline SVG sprite used by components |

---

## .claude/ — Session docs (not shipped)

| File | Role |
|------|------|
| `STRUCTURE.md` | This file — navigation map |
| `ARCHITECTURE.md` | Stack details, component hierarchy, data-flow diagrams |
| `AUTH.md` | Auth flow, roles, invite system, routing guards |
| `SCHEMA.md` | All Sheet tab column definitions and API payload shapes |
| `ROADMAP.md` | Feature status and planned work |
| `STOCK_HEALTH_BRIEF.md` | Stock health metric calculations |
| `OPTIMIZATION_CHECKLIST.md` | Performance tasks |
| `MEMBERS_INVITE_CONTEXT.md` | Member invite feature context |
| `inventory-refactor.md` | Notes from inventory data structure refactor |
| `CHANGELOG_SESSION_2026-05-02.md` | May 2 session work log |

---

## Data flow summary

```
User action
  → Component (reads from store slice, never callAppsScript directly)
  → store/api.js api* write function
  → utils/appsScript.js callAppsScript (GET, URL-encoded params)
  → Google Apps Script backend
  → invalidate*() + fetch action (store refreshes from source)
  → Component re-renders from store
```

Auth state lives in `AuthContext`; all other remote data lives in the Zustand store.
