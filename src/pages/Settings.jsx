import { useState } from 'react'
import styles from './Settings.module.css'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`${styles.toggle} ${checked ? styles.toggleOn : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}

function SettingsRow({ label, description, children }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowText}>
        <span className={styles.rowLabel}>{label}</span>
        {description && <span className={styles.rowDesc}>{description}</span>}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const [prefs, setPrefs] = useState({
    lowStockAlerts: true,
    outOfStockAlerts: true,
    pushNotifications: false,
    darkMode: false,
    compactView: false,
    defaultLocation: 'Truck 1',
    businessName: 'Sparkle Clean Co.',
    lowStockThreshold: '20',
  })

  function set(key) {
    return (val) => setPrefs((p) => ({ ...p, [key]: val }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Configure your preferences</p>
      </div>

      <div className={styles.sections}>

        {/* Business */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Business</h2>
          <div className={styles.card}>
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="bizName">Business Name</label>
              </div>
              <input
                id="bizName"
                className={styles.textInput}
                value={prefs.businessName}
                onChange={(e) => set('businessName')(e.target.value)}
              />
            </div>
            <div className={styles.divider} />
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="defaultLoc">Default Location</label>
                <span className={styles.rowDesc}>Pre-selected when adding items</span>
              </div>
              <select
                id="defaultLoc"
                className={styles.selectInput}
                value={prefs.defaultLocation}
                onChange={(e) => set('defaultLocation')(e.target.value)}
              >
                {['Truck 1', 'Truck 2', 'Warehouse', 'Office', 'Site A', 'Site B'].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Alerts</h2>
          <div className={styles.card}>
            <SettingsRow
              label="Low Stock Alerts"
              description="Notify when items fall below minimum"
            >
              <Toggle checked={prefs.lowStockAlerts} onChange={set('lowStockAlerts')} />
            </SettingsRow>
            <div className={styles.divider} />
            <SettingsRow
              label="Out of Stock Alerts"
              description="Notify when items reach zero"
            >
              <Toggle checked={prefs.outOfStockAlerts} onChange={set('outOfStockAlerts')} />
            </SettingsRow>
            <div className={styles.divider} />
            {/* <SettingsRow
              label="Push Notifications"
              description="Receive alerts even when app is closed"
            >
              <Toggle checked={prefs.pushNotifications} onChange={set('pushNotifications')} />
            </SettingsRow> */}
            <div className={styles.divider} />
            <div className={styles.row}>
              <div className={styles.rowText}>
                <label className={styles.rowLabel} htmlFor="threshold">Low Stock Threshold</label>
                <span className={styles.rowDesc}>Warn when quantity is at or below this %</span>
              </div>
              <div className={styles.numericInput}>
                <input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  className={styles.numberField}
                  value={prefs.lowStockThreshold}
                  onChange={(e) => set('lowStockThreshold')(e.target.value)}
                />
                <span className={styles.numberSuffix}>%</span>
              </div>
            </div>
          </div>
        </section>

        {/* Display */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Display</h2>
          <div className={styles.card}>
            <SettingsRow label="Dark Mode" description="Coming soon">
              <Toggle checked={prefs.darkMode} onChange={set('darkMode')} />
            </SettingsRow>
            <div className={styles.divider} />
            <SettingsRow label="Compact View" description="Show more items on screen">
              <Toggle checked={prefs.compactView} onChange={set('compactView')} />
            </SettingsRow>
          </div>
        </section>

        {/* Data */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Data</h2>
          <div className={styles.card}>
            <button className={styles.actionRow} type="button">
              <span>Export Inventory (CSV)</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {/* <div className={styles.divider} />
            <button className={styles.actionRow} type="button">
              <span>Import from CSV</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button> */}
            <div className={styles.divider} />
            <button className={`${styles.actionRow} ${styles.actionDanger}`} type="button">
              <span>Clear All Inventory</span>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </div>
        </section>

        <p className={styles.version}>CleanInv v0.1.0 · No backend connected</p>
      </div>
    </div>
  )
}
