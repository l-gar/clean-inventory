# Architecture

## Stack
React + Vite · GitHub Pages · HashRouter · react-i18next · Zustand · Google OAuth · Sheets API · Apps Script

## Apps Script responsibilities
- Auth middleware: validate login → return role + org_id + sheet_id + location_ids
- Barcode proxy: forward UPC requests to UPCitemdb (avoids CORS)
- Low stock alerts: monitor inventory sheet · send email when below threshold
- Invite validation: token + expiry + seat limit + role
- Activity logging: append to activity_log on every write
- Location management: create · assign · filter
- All code generated here · deployed manually from finsightlatino account

## ConnectSheet safeguards
- Detect duplicate sheet_id before creating a new one
- Warn: "You already have a connected Sheet. Creating a new one will disconnect the old one. Your old data will not be deleted."

## Evolution plan
### Stage 1 — now
Google Sheets + Apps Script + GitHub Pages. Goal: validate with real users.

### Stage 2 — growth
Replace Sheets with Supabase/PostgreSQL · replace Apps Script with proper API.
Frontend only needs VITE_APPS_SCRIPT_URL updated. Migrate Sheet data.

### Stage 3 — scale
Add Apple + email/password login · custom domain · enterprise infra.
Google OAuth users never disrupted.

## Key design constraint
Frontend never talks directly to Sheets — all calls go through VITE_APPS_SCRIPT_URL.
Swapping the backend = updating one env var. No business logic in the frontend.