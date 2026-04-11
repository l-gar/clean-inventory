import { useState, useRef, useEffect } from 'react'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import styles from './AddItem.module.css'

const LOCATIONS = ['Truck 1', 'Truck 2', 'Warehouse', 'Office', 'Site A', 'Site B']
const CATEGORIES = ['Chemicals', 'Equipment', 'PPE', 'Consumables', 'Tools']
const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

export default function AddItem() {
  const [scanStatus, setScanStatus] = useState('idle') // 'idle' | 'scanning' | 'done'
  const [lookingUp, setLookingUp] = useState(false)
  const [testCode, setTestCode] = useState('')
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category: '',
    location: '',
    quantity: '',
    unit: 'each',
    minQuantity: '',
    notes: '',
  })
  const videoRef = useRef(null)
  const readerRef = useRef(null)

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      readerRef.current?.reset()
    }
  }, [])

  async function startScan() {
    setScanStatus('scanning')
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    try {
      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        async (result, err) => {
          // NotFoundException fires on every frame with no barcode — ignore it
          if (err && !(err instanceof NotFoundException)) {
            console.warn('Scanner error:', err)
          }
          if (!result || !readerRef.current) return

          const code = result.getText()

          // Stop camera immediately
          readerRef.current.reset()
          readerRef.current = null
          setScanStatus('done')
          setForm((prev) => ({ ...prev, sku: code }))

          // Look up product name from Open Food Facts
          setLookingUp(true)
          try {
            const res = await fetch(
              `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`
            )
            const data = await res.json()
            const title = data?.product?.product_name
            if (title) {
              setForm((prev) => ({ ...prev, name: title }))
            }
          } catch (_) {
            // API unavailable — leave name blank for manual entry
          } finally {
            setLookingUp(false)
          }
        }
      )
    } catch (_) {
      // Camera permission denied or no camera available
      setScanStatus('idle')
      readerRef.current = null
    }
  }

  function stopScan() {
    readerRef.current?.reset()
    readerRef.current = null
    setScanStatus('idle')
  }

  function handleScanAgain() {
    setForm((prev) => ({ ...prev, sku: '', name: '' }))
    startScan()
  }

  async function handleTestLookup() {
    const code = testCode.trim()
    if (!code) return

    console.group(`[UPC Test] Lookup for: ${code}`)
    console.log('1. Setting sku field →', code)
    setScanStatus('done')
    setForm((prev) => ({ ...prev, sku: code, name: '' }))
    setLookingUp(true)

    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`
    console.log('2. Fetching →', url)

    try {
      const res = await fetch(url)
      console.log('3. HTTP status →', res.status, res.statusText)

      const data = await res.json()
      console.log('4. Raw response →', data)

      const product = data?.product
      if (product) {
        console.log('5. Product object →', product)
        const title = product.product_name
        if (title) {
          console.log('6. Setting name field →', title)
          setForm((prev) => ({ ...prev, name: title }))
        } else {
          console.warn('6. Product found but product_name is empty — leaving name blank')
        }
      } else {
        console.warn('5. No product returned (status:', data?.status, ')— leaving name blank')
      }
    } catch (err) {
      console.error('3. Fetch failed →', err)
    } finally {
      setLookingUp(false)
      console.groupEnd()
    }
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    // TODO: save to backend
    alert(`Item "${form.name}" saved (backend not connected yet)`)
  }

  const scanning = scanStatus === 'scanning'
  const done = scanStatus === 'done'

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Add Item</h1>
        <p className={styles.subtitle}>Scan a barcode or fill in the details below</p>
      </div>

      {/* Barcode Scanner Section */}
      <section className={styles.scanSection}>
        <div className={styles.scanCard}>
          <div
            className={`${styles.scanViewfinder} ${scanning ? styles.scanActive : ''} ${done ? styles.scanDone : ''}`}
          >
            {/* Video element — rendered but hidden when not scanning */}
            <video
              ref={videoRef}
              className={styles.scanVideo}
              style={{ display: scanning ? 'block' : 'none' }}
              playsInline
              muted
            />

            {scanning && (
              <>
                <div className={styles.scanCorner} data-pos="tl" />
                <div className={styles.scanCorner} data-pos="tr" />
                <div className={styles.scanCorner} data-pos="bl" />
                <div className={styles.scanCorner} data-pos="br" />
                <p className={styles.scanHint}>Point camera at barcode</p>
              </>
            )}

            {done && (
              <div className={styles.scanSuccess}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className={styles.scanSuccessCode}>{form.sku}</span>
                {lookingUp && <span className={styles.scanLookup}>Looking up product…</span>}
              </div>
            )}

            {!scanning && !done && (
              <div className={styles.scanIdle}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="7" y2="12.01" strokeWidth={3} />
                  <line x1="10" y1="9" x2="10" y2="15" />
                  <line x1="13" y1="9" x2="13" y2="15" />
                  <line x1="16" y1="12" x2="16" y2="12.01" strokeWidth={3} />
                </svg>
                <span>Tap to scan barcode</span>
              </div>
            )}
          </div>

          {scanning && (
            <button
              type="button"
              className={`${styles.scanBtn} ${styles.scanBtnStop}`}
              onClick={stopScan}
            >
              Stop Scanning
            </button>
          )}
          {done && (
            <button type="button" className={styles.scanBtn} onClick={handleScanAgain}>
              Scan Again
            </button>
          )}
          {!scanning && !done && (
            <button type="button" className={styles.scanBtn} onClick={startScan}>
              Start Camera Scan
            </button>
          )}
        </div>

        <div className={styles.orDivider}>
          <span>or enter manually</span>
        </div>

        {import.meta.env.DEV && (
          <div className={styles.devPanel}>
            <p className={styles.devLabel}>DEV — Test API lookup</p>
            <div className={styles.devRow}>
              <input
                className={styles.devInput}
                type="text"
                placeholder="Enter UPC (e.g. 012345678905)"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTestLookup()}
              />
              <button
                type="button"
                className={styles.devBtn}
                onClick={handleTestLookup}
                disabled={!testCode.trim() || lookingUp}
              >
                {lookingUp ? 'Looking up…' : 'Test'}
              </button>
            </div>
            <p className={styles.devHint}>Results logged to console. Opens in &quot;done&quot; state.</p>
          </div>
        )}
      </section>

      {/* Manual Entry Form */}
      <form className={styles.form} onSubmit={handleSubmit}>
        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Item Details</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Item Name <span className={styles.required}>*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className={styles.input}
              placeholder="e.g. All-Purpose Cleaner"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="sku">
              SKU / Barcode
            </label>
            <input
              id="sku"
              name="sku"
              type="text"
              className={styles.input}
              placeholder="e.g. CLN-001"
              value={form.sku}
              onChange={handleChange}
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                className={styles.select}
                value={form.category}
                onChange={handleChange}
              >
                <option value="">Select…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="location">
                Location <span className={styles.required}>*</span>
              </label>
              <select
                id="location"
                name="location"
                className={styles.select}
                value={form.location}
                onChange={handleChange}
                required
              >
                <option value="">Select…</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Quantity</h2>

          <div className={styles.fieldRow}>
            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label} htmlFor="quantity">
                Current Qty <span className={styles.required}>*</span>
              </label>
              <input
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                className={styles.input}
                placeholder="0"
                value={form.quantity}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.field} style={{ flex: 1 }}>
              <label className={styles.label} htmlFor="unit">
                Unit
              </label>
              <select
                id="unit"
                name="unit"
                className={styles.select}
                value={form.unit}
                onChange={handleChange}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div className={styles.field} style={{ flex: 2 }}>
              <label className={styles.label} htmlFor="minQuantity">
                Alert Below
              </label>
              <input
                id="minQuantity"
                name="minQuantity"
                type="number"
                min="0"
                className={styles.input}
                placeholder="0"
                value={form.minQuantity}
                onChange={handleChange}
              />
            </div>
          </div>
        </section>

        <section className={styles.formSection}>
          <h2 className={styles.sectionTitle}>Notes</h2>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="notes">
              Additional notes
            </label>
            <textarea
              id="notes"
              name="notes"
              className={styles.textarea}
              placeholder="Storage instructions, supplier info…"
              rows={3}
              value={form.notes}
              onChange={handleChange}
            />
          </div>
        </section>

        <div className={styles.actions}>
          <button
            type="reset"
            className={styles.btnSecondary}
            onClick={() =>
              setForm({
                name: '',
                sku: '',
                category: '',
                location: '',
                quantity: '',
                unit: 'each',
                minQuantity: '',
                notes: '',
              })
            }
          >
            Clear
          </button>
          <button type="submit" className={styles.btnPrimary}>
            Save Item
          </button>
        </div>
      </form>
    </div>
  )
}
