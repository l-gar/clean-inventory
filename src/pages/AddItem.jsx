import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBarcode,
  faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../hooks/useLocations'
import { callAppsScript, addItem } from '../utils/appsScript'
import { useStore } from '../store'
import LocationSelect from '../components/LocationSelect'
import styles from './AddItem.module.css'

const CATEGORIES = ['Chemicals', 'Equipment', 'PPE', 'Consumables', 'Tools']
const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

const EMPTY_FORM = {
  name: '', brand: '', sku: '', category: '',
  location: '', quantity: '', unit: 'each',
  minQuantity: '', costPerUnit: '', expectedJobs: '', notes: '',
}

export default function AddItem() {
  const { t }       = useTranslation()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { locations } = useLocations()
  const invalidateInventory = useStore((s) => s.invalidateInventory)
  const storeInventory      = useStore((s) => s.inventory)
  const storeFetchInventory = useStore((s) => s.fetchInventory)

  const isMember = user?.role === 'org_member'

  // 'lookup' → scan / type SKU
  // 'new_item' → not in org → full add form
  const [phase,      setPhase]      = useState('lookup')
  const [scanStatus, setScanStatus] = useState('idle') // 'idle' | 'scanning' | 'found'
  const [skuInput,   setSkuInput]   = useState('')
  const [lookingUp,  setLookingUp]  = useState(false)

  const [form,        setForm]        = useState({ ...EMPTY_FORM })
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const videoRef        = useRef(null)
  const readerRef       = useRef(null)
  const successTimerRef = useRef(null)

  useEffect(() => {
    setForm((prev) => {
      if (prev.location || locations.length === 0) return prev
      if (isMember && locations.length !== 1) return prev
      return { ...prev, location: locations[0].location_id }
    })
  }, [isMember, locations])

  useEffect(() => {
    return () => {
      readerRef.current?.reset()
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  function getDefaultLocation() {
    if (locations.length === 0) return ''
    if (isMember && locations.length !== 1) return ''
    return locations[0].location_id
  }

  function resetToLookup() {
    readerRef.current?.reset()
    readerRef.current = null
    setScanStatus('idle')
    setPhase('lookup')
    setSkuInput('')
    setSaveError('')
    setSaveSuccess(false)
    setForm({ ...EMPTY_FORM, location: getDefaultLocation() })
  }

  // ── Core lookup ───────────────────────────────────────────────────────────
  // 1. Fetch org inventory via store ('all' locations — always, so no location
  //    is missed; the store cache makes repeat calls instant).
  // 2. If a barcode match is found client-side, redirect to EditItem.
  // 3. Call lookupBarcode.  Apps Script now returns existsInInventory + full
  //    item data when found — redirect to EditItem for those too.
  // 4. Otherwise pre-fill the new-item form with any product info found.
  async function runLookup(rawCode) {
    const code = rawCode.trim()
    if (!code) return
    setLookingUp(true)

    const padded = code.padStart(12, '0')

    // Step 1 — client-side store check (fast path)
    let inventory = storeInventory
    try {
      inventory = await storeFetchInventory(user.email, user.orgId, 'all')
    } catch { /* fall through with cached data */ }

    const storeMatch = inventory.find((item) => {
      if (!item.barcode) return false
      const b = String(item.barcode)
      return b === code || b === padded
    })

    if (storeMatch) {
      setLookingUp(false)
      navigate(`/edit/${storeMatch.itemId}`, { state: { item: storeMatch } })
      return
    }

    // Step 2 — Apps Script lookup chain (org sheet → cache → UPCitemdb → OFN)
    try {
      const data = await callAppsScript('lookupBarcode', { upc: padded })

      if (data?.existsInInventory && data?.itemId) {
        // Apps Script found the item in the org's inventory sheet
        setLookingUp(false)
        navigate(`/edit/${data.itemId}`, { state: { item: data } })
        return
      }

      // Product info found from an external source — pre-fill the new-item form
      const title = data?.title ?? data?.name ?? data?.product_name ?? ''
      const brand  = data?.brand ?? ''
      setForm((prev) => ({
        ...prev,
        sku:   code,
        name:  title,
        brand: brand || prev.brand,
      }))
    } catch {
      setForm((prev) => ({ ...prev, sku: code }))
    } finally {
      setLookingUp(false)
    }

    setPhase('new_item')
  }

  // ── Camera scanner ────────────────────────────────────────────────────────
  async function startScan() {
    setScanStatus('scanning')
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    try {
      await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: 'environment' } } },
        videoRef.current,
        async (result, err) => {
          if (err && !(err instanceof NotFoundException)) console.warn('Scanner error:', err)
          if (!result || !readerRef.current) return
          const code = result.getText()
          readerRef.current.reset()
          readerRef.current = null
          setScanStatus('found')
          setSkuInput(code)
          await runLookup(code)
        },
      )
    } catch {
      setScanStatus('idle')
      readerRef.current = null
    }
  }

  function stopScan() {
    readerRef.current?.reset()
    readerRef.current = null
    setScanStatus('idle')
  }

  // ── Save new item ─────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)

    try {
      await addItem(user.email, user.orgId, {
        itemName:     form.name,
        brand:        form.brand,
        barcode:      form.sku,
        quantity:     form.quantity,
        unit:         form.unit,
        category:     form.category,
        locationId:   form.location,
        costPerUnit:  form.costPerUnit,
        expectedJobs: form.expectedJobs,
        trackStock:   true,
      })
      invalidateInventory()
      setSaveSuccess(true)
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false)
        resetToLookup()
      }, 4000)
    } catch (err) {
      const raw = err?.message ?? ''
      const isGenericAppsScriptError = raw.startsWith('Apps Script action')
      setSaveError(isGenericAppsScriptError ? t('add_item_save_error') : raw || t('add_item_save_error'))
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const scanning  = scanStatus === 'scanning'
  const scanFound = scanStatus === 'found'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('add_item')}</h1>
        <p className={styles.subtitle}>{t('add_item_subtitle')}</p>
      </div>

      {/* ── Phase: lookup ─────────────────────────────────────── */}
      {phase === 'lookup' && (
        <section className={styles.scanSection}>

          <div className={styles.scanCard}>
            <div
              className={`${styles.scanViewfinder} ${scanning ? styles.scanActive : ''} ${scanFound ? styles.scanDone : ''}`}
            >
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
                  <p className={styles.scanHint}>{t('point_camera_at_barcode')}</p>
                </>
              )}

              {scanFound && (
                <div className={styles.scanSuccess}>
                  <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                  <span className={styles.scanSuccessCode}>{skuInput}</span>
                  {lookingUp && (
                    <span className={styles.scanLookup}>{t('looking_up_product')}</span>
                  )}
                </div>
              )}

              {!scanning && !scanFound && (
                <div className={styles.scanIdle}>
                  <FontAwesomeIcon icon={faBarcode} aria-hidden="true" />
                  <span>{t('tap_to_scan')}</span>
                </div>
              )}
            </div>

            {scanning ? (
              <button
                type="button"
                className={`${styles.scanBtn} ${styles.scanBtnStop}`}
                onClick={stopScan}
              >
                {t('stop_scanning')}
              </button>
            ) : (
              <button
                type="button"
                className={styles.scanBtn}
                onClick={startScan}
                disabled={lookingUp}
              >
                {t('start_camera_scan')}
              </button>
            )}
          </div>

          <div className={styles.orDivider}>
            <span>{t('or_enter_sku')}</span>
          </div>

          <div className={styles.skuRow}>
            <input
              className={styles.skuInput}
              type="text"
              placeholder={t('sku_lookup_placeholder')}
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runLookup(skuInput)}
            />
            <button
              type="button"
              className={styles.skuBtn}
              onClick={() => runLookup(skuInput)}
              disabled={!skuInput.trim() || lookingUp}
            >
              {lookingUp ? t('looking_up_product') : t('look_up')}
            </button>
          </div>

          <button
            type="button"
            className={styles.addManuallyBtn}
            onClick={() => setPhase('new_item')}
          >
            {t('add_without_scan')}
          </button>

        </section>
      )}

      {/* ── Phase: new item form ───────────────────────────────── */}
      {phase === 'new_item' && (
        <form className={styles.form} onSubmit={handleSubmit}>

          <button type="button" className={styles.backBtn} onClick={resetToLookup}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            {t('back_to_lookup')}
          </button>

          <section className={styles.formSection}>
            <h2 className={styles.sectionTitle}>{t('item_details')}</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="name">
                {t('item_name')} <span className={styles.required}>*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className={styles.input}
                placeholder={t('item_name_placeholder')}
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="brand">
                {t('brand')}
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                className={styles.input}
                placeholder={t('brand_placeholder')}
                value={form.brand}
                onChange={handleChange}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="sku">
                {t('sku_barcode')}
              </label>
              <input
                id="sku"
                name="sku"
                type="text"
                className={styles.input}
                placeholder={t('sku_placeholder')}
                value={form.sku}
                onChange={handleChange}
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="category">
                  {t('category')}
                </label>
                <select
                  id="category"
                  name="category"
                  className={styles.select}
                  value={form.category}
                  onChange={handleChange}
                >
                  <option value="">{t('select_placeholder')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="location">
                  {t('location')} <span className={styles.required}>*</span>
                </label>
                <LocationSelect
                  id="location"
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  required
                  className={styles.select}
                />
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2 className={styles.sectionTitle}>{t('quantity')}</h2>

            <div className={styles.fieldRow}>
              <div className={styles.field} style={{ flex: 2 }}>
                <label className={styles.label} htmlFor="quantity">
                  {t('current_qty')} <span className={styles.required}>*</span>
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
                  {t('unit')}
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
                  {t('alert_below')}
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

            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="costPerUnit">
                  {t('cost_per_unit')}
                </label>
                <input
                  id="costPerUnit"
                  name="costPerUnit"
                  type="number"
                  min="0"
                  step="0.01"
                  className={styles.input}
                  placeholder={t('cost_per_unit_placeholder')}
                  value={form.costPerUnit}
                  onChange={handleChange}
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="expectedJobs">
                  {t('expected_jobs')}
                </label>
                <input
                  id="expectedJobs"
                  name="expectedJobs"
                  type="number"
                  min="0"
                  className={styles.input}
                  placeholder={t('expected_jobs_placeholder')}
                  value={form.expectedJobs}
                  onChange={handleChange}
                />
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2 className={styles.sectionTitle}>{t('notes')}</h2>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="notes">
                {t('additional_notes')}
              </label>
              <textarea
                id="notes"
                name="notes"
                className={styles.textarea}
                placeholder={t('notes_placeholder')}
                rows={3}
                value={form.notes}
                onChange={handleChange}
              />
            </div>
          </section>

          {saveSuccess && (
            <div className={styles.saveSuccessBanner} role="status">
              <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
              {t('item_saved_success')}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={resetToLookup}
              disabled={saving}
            >
              {t('clear')}
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={saving}
            >
              {saving ? t('saving') : t('save_item')}
            </button>
          </div>

          {saveError && (
            <p className={styles.saveError} role="alert">{saveError}</p>
          )}

        </form>
      )}

    </div>
  )
}
