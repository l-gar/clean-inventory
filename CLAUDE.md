# Project: Clean Inventory App

## Stack
- React + Vite, deployed to GitHub Pages
- React Router with HashRouter (GitHub Pages requirement)
- react-i18next for internationalization
- Google OAuth for authentication
- Google Sheets API for data storage
- Apps Script for barcode proxy and low stock alerts

## Internationalization rules
- All user-facing text must use the t() hook from react-i18next
- Never hardcode English strings directly in components
- Always add both English and Spanish translations to 
  src/locales/en.json and src/locales/es.json when adding 
  new text
- English key format: descriptive snake_case 
  e.g. t('scan_barcode'), t('item_name'), t('save_item')
- If you are unsure of the Spanish translation use a 
  placeholder like "ES: scan barcode" so it can be reviewed
  and corrected later

## Dark mode
- Use CSS variables for theming — follow existing patterns
- Never hardcode colors directly in components
- Always test that new components work in both light and dark

## Routing
- Always use HashRouter links — never assume BrowserRouter

## Deployment
- Base path is /clean-inventory/
- Run npm run deploy to push to GitHub Pages

## Current status
- Barcode scanning: done (Open Food Facts temporary)
- i18n setup: done
- Dark mode toggle: UI exists, not wired up yet
- Google OAuth: pending
- Google Sheets: pending
- Apps Script proxy: pending