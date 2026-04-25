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
import { callAppsScript } from '../utils/appsScript'
import { apiAddCatalogItem, apiAddStock, apiUpdateStock, apiDeductItem, apiRestockItem, apiAdjustItem } from '../store/api'
import { useStore } from '../store'
import LocationSelect from '../components/LocationSelect'
import StockAdjuster from '../components/StockAdjuster'
import CategoryInput from '../components/CategoryInput'
import SaveSuccessSplash from '../components/SaveSuccessSplash'
import StockSettings from '../components/StockSettings'
import styles from './ScanUpdate.module.css'

const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

const EMPTY_FORM = {
  name: '', brand: '', supplier: '', sku: '', category: '',
  location: '', quantity: '', unit: 'each',
  itemLowStockThreshold: '', costPerUnit: '', costPerUnitOverride: '',
  expectedJobs: '', trackStock: true, description: '',
}

export default function AddItem() {
  const { t }       = useTranslation()
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const { locations } = useLocations()
  const invalidateInventory = useStore((s) => s.invalidateInventory)
  const invalidateCatalog   = useStore((s) => s.invalidateCatalog)
  const storeFetchInventory = useStore((s) => s.fetchInventory)
  const lookupByBarcode     = useStore((s) => s.lookupByBarcode)

  const isMember    = user?.role === 'org_member'
  const canEditAll  = user?.role === 'org_owner' || user?.role === 'manager'

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
  const [lookupLocation, setLookupLocation] = useState('')
  const [isKnownItem,    setIsKnownItem]    = useState(false)
  const [adjustMode,     setAdjustMode]     = useState(true)
  const [delta,          setDelta]          = useState('')
  const [baseQty,          setBaseQty]          = useState(0)
  const [matchedItemId,    setMatchedItemId]    = useState(null)
  const [matchedCatalogId, setMatchedCatalogId] = useState(null)

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
    setLookupLocation((prev) => {
      if (prev || locations.length === 0) return prev
      if (isMember && locations.length !== 1) return prev
      return locations[0].location_id
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

  function handleLookupLocationChange(e) {
    const locId = e.target.value
    setLookupLocation(locId)
    setForm((prev) => ({ ...prev, location: locId }))
  }

  function resetToLookup() {
    readerRef.current?.reset()
    readerRef.current = null
    setScanStatus('idle')
    setPhase('lookup')
    setSkuInput('')
    setSaveError('')
    setSaveSuccess(false)
    setIsKnownItem(false)
    setAdjustMode(true)
    setDelta('')
    setBaseQty(0)
    setMatchedItemId(null)
    setMatchedCatalogId(null)
    setForm({ ...EMPTY_FORM, location: lookupLocation || getDefaultLocation() })
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

    // Step 1 — client-side index check (fast path)
    // fetchInventory is TTL-cached; on cache hit it returns immediately and the
    // barcodeIndex is already built, so lookupByBarcode below is O(1).
    try {
      await storeFetchInventory(user.email, user.orgId, 'all')
    } catch { /* fall through — lookupByBarcode will use whatever is cached */ }

    const allBarcodeMatches = lookupByBarcode(code)

    const locationMatch = lookupLocation
      ? allBarcodeMatches.find((item) => (item.location_id ?? item.locationId) === lookupLocation)
      : allBarcodeMatches[0]

    if (locationMatch) {
      const qty = Number(locationMatch.quantity ?? 0)
      setForm((prev) => ({
        ...prev,
        sku:                  locationMatch.barcode ?? '',
        name:                 locationMatch.itemName ?? '',
        brand:                locationMatch.brand ?? '',
        category:             locationMatch.category ?? prev.category,
        unit:                 locationMatch.unit ?? prev.unit,
        location:             locationMatch.location_id ?? (lookupLocation || prev.location),
        itemLowStockThreshold: String(locationMatch.item_low_stock_threshold ?? locationMatch.itemLowStockThreshold ?? locationMatch.minQuantity ?? ''),
        costPerUnit:          String(locationMatch.cost_per_unit ?? locationMatch.costPerUnit ?? ''),
        costPerUnitOverride:  String(locationMatch.cost_per_unit_override ?? locationMatch.costPerUnitOverride ?? ''),
        expectedJobs:         String(locationMatch.expected_jobs ?? locationMatch.expectedJobs ?? ''),
        trackStock:           locationMatch.track_stock ?? locationMatch.trackStock ?? true,
      }))
      setBaseQty(qty)
      setMatchedItemId(locationMatch.stock_id ?? locationMatch.stockId ?? locationMatch.itemId)
      setMatchedCatalogId(locationMatch.catalog_id ?? locationMatch.catalogId ?? null)
      setIsKnownItem(true)
      setLookingUp(false)
      setPhase('new_item')
      return
    }

    // Item exists in another location — pre-fill everything from it, only ask for quantity
    if (allBarcodeMatches.length > 0) {
      const ref = allBarcodeMatches[0]
      setMatchedCatalogId(ref.catalog_id ?? ref.catalogId ?? null)
      setForm((prev) => ({
        ...prev,
        sku:                  code,
        name:                 ref.itemName ?? '',
        brand:                ref.brand ?? '',
        category:             ref.category ?? prev.category,
        unit:                 ref.unit ?? prev.unit,
        location:             lookupLocation || prev.location,
        itemLowStockThreshold: String(ref.item_low_stock_threshold ?? ref.itemLowStockThreshold ?? ref.minQuantity ?? ''),
        costPerUnit:          String(ref.cost_per_unit ?? ref.costPerUnit ?? ''),
        costPerUnitOverride:  String(ref.cost_per_unit_override ?? ref.costPerUnitOverride ?? ''),
        expectedJobs:         String(ref.expected_jobs ?? ref.expectedJobs ?? ''),
        trackStock:           ref.track_stock ?? ref.trackStock ?? true,
      }))
      setIsKnownItem(true)
      setLookingUp(false)
      setPhase('new_item')
      return
    }

    // Step 2 — Apps Script lookup chain (org sheet → cache → UPCitemdb → OFN)
    try {
      const data = await callAppsScript('lookupBarcode', { upc: padded })

      if (data?.existsInInventory && data?.itemId) {
        const inSelectedLoc = !lookupLocation || !data.location_id || data.location_id === lookupLocation
        if (inSelectedLoc) {
          setLookingUp(false)
          navigate(`/edit/${data.itemId}`, { state: { item: data } })
          return
        }
        setForm((prev) => ({
          ...prev,
          sku:      code,
          name:     data.itemName ?? data.title ?? '',
          brand:    data.brand ?? '',
          category: data.category ?? prev.category,
          unit:     data.unit ?? prev.unit,
          location: lookupLocation || prev.location,
        }))
        setIsKnownItem(true)
        setLookingUp(false)
        setPhase('new_item')
        return
      }

      // Product info found from an external source — pre-fill the new-item form
      const title = data?.title ?? data?.name ?? data?.product_name ?? ''
      const brand  = data?.brand ?? ''
      setForm((prev) => ({
        ...prev,
        sku:      code,
        name:     title,
        brand:    brand || prev.brand,
        location: lookupLocation || prev.location,
      }))
    } catch {
      setForm((prev) => ({ ...prev, sku: code, location: lookupLocation || prev.location }))
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

  const deltaNum = Number(delta) || 0
  const newTotal = adjustMode
    ? Math.max(0, baseQty + deltaNum)
    : Math.max(0, Number(form.quantity ?? 0))

  // ── Save ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)

    try {
      const submitQty = isKnownItem
        ? (adjustMode ? newTotal : Number(form.quantity))
        : Number(form.quantity)

      if (matchedItemId) {
        // Existing stock at this location — adjust quantity
        if (adjustMode) {
          if (deltaNum > 0) {
            await apiRestockItem({ email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: deltaNum })
          } else if (deltaNum < 0) {
            await apiDeductItem({ email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: Math.abs(deltaNum) })
          }
        } else {
          await apiAdjustItem({ email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: submitQty, notes: 'Manual stock adjustment' })
        }
        // Update stock metadata if manager/owner made changes
        if (canEditAll) {
          await apiUpdateStock({
            email: user.email, orgId: user.orgId, stockId: matchedItemId,
            itemLowStockThreshold: form.itemLowStockThreshold,
            costPerUnitOverride:   form.costPerUnitOverride,
            expectedJobs:          form.expectedJobs,
          })
        }
      } else if (matchedCatalogId) {
        // Item exists at another location — add a stock record here
        await apiAddStock({
          email: user.email, orgId: user.orgId,
          catalogId:             matchedCatalogId,
          locationId:            form.location,
          quantity:              submitQty,
          itemLowStockThreshold: form.itemLowStockThreshold,
          costPerUnitOverride:   form.costPerUnitOverride,
          expectedJobs:          form.expectedJobs,
        })
      } else {
        // Brand new item — create catalog entry then stock record
        const catalogRes = await apiAddCatalogItem({
          email: user.email, orgId: user.orgId,
          itemName:     form.name,
          brand:        form.brand,
          supplier:     form.supplier,
          barcode:      form.sku,
          description:  form.description,
          unit:         form.unit,
          category:     form.category,
          costPerUnit:  form.costPerUnit,
          trackStock:   form.trackStock,
        })
        await apiAddStock({
          email: user.email, orgId: user.orgId,
          catalogId:             catalogRes.catalogId,
          locationId:            form.location,
          quantity:              submitQty,
          itemLowStockThreshold: form.itemLowStockThreshold,
          costPerUnitOverride:   form.costPerUnitOverride,
          expectedJobs:          form.expectedJobs,
        })
        invalidateCatalog()
      }

      invalidateInventory()
      setSaveSuccess(true)
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false)
        resetToLookup()
      }, 4000)
    } catch (err) {
      const raw = err?.message ?? ''
      const isGenericAppsScriptError = raw.startsWith('Apps Script action')
      setSaveError(isGenericAppsScriptError ? t('scan_update_save_error') : raw || t('scan_update_save_error'))
    } finally {
      setSaving(false)
    }
  }

  function handleChange(e) {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: value }))
  }

  const scanning  = scanStatus === 'scanning'
  const scanFound = scanStatus === 'found'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('scan_update')}</h1>
        <p className={styles.subtitle}>{t('scan_update_subtitle')}</p>
      </div>

      {/* ── Phase: lookup ─────────────────────────────────────── */}
      {phase === 'lookup' && (
        <section className={styles.scanSection}>

          <div className={styles.lookupLocationRow}>
            <label className={styles.lookupLocationLabel} htmlFor="lookupLocation">
              {t('location')}
            </label>
            <LocationSelect
              id="lookupLocation"
              name="lookupLocation"
              value={lookupLocation}
              onChange={handleLookupLocationChange}
              className={styles.select}
            />
          </div>

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

      {/* ── Phase: new item — success splash ─────────────────── */}
      {phase === 'new_item' && saveSuccess && (
        <SaveSuccessSplash message={t('item_saved_success')} detail={form.name} />
      )}

      {/* ── Phase: new item form ───────────────────────────────── */}
      {phase === 'new_item' && !saveSuccess && (
        <form className={styles.form} onSubmit={handleSubmit}>

          <button type="button" className={styles.backBtn} onClick={resetToLookup}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            {t('back_to_lookup')}
          </button>

          {/* Known item: show a read-only info card instead of full detail fields */}
          {isKnownItem ? (
            <div className={styles.knownItemCard}>
              <span className={styles.knownItemName}>{form.name}</span>
              <div className={styles.knownItemMeta}>
                {form.brand && <span>{form.brand}</span>}
                {form.category && <span>{form.category}</span>}
                {form.sku && <span className={styles.knownItemSku}>{form.sku}</span>}
              </div>
            </div>
          ) : (
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

              <div className={styles.fieldRow}>
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
                  <label className={styles.label} htmlFor="supplier">
                    {t('supplier')}
                  </label>
                  <input
                    id="supplier"
                    name="supplier"
                    type="text"
                    className={styles.input}
                    placeholder={t('supplier_placeholder')}
                    value={form.supplier}
                    onChange={handleChange}
                  />
                </div>
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
                  <CategoryInput
                    value={form.category}
                    onChange={handleChange}
                    className={styles.input}
                  />
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
          )}

          {/* Quantity — all roles */}
          {isKnownItem ? (
            <StockAdjuster
              baseQty={baseQty}
              unit={form.unit}
              adjustMode={adjustMode}
              delta={delta}
              quantity={form.quantity}
              onModeToggle={() => { setAdjustMode((m) => !m); setDelta('') }}
              onDeltaChange={setDelta}
              onQuantityChange={(val) => setForm((prev) => ({ ...prev, quantity: val }))}
              onUnitChange={(val) => setForm((prev) => ({ ...prev, unit: val }))}
            />
          ) : (
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
                  <label className={styles.label} htmlFor="unit">{t('unit')}</label>
                  <select id="unit" name="unit" className={styles.select} value={form.unit} onChange={handleChange}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </section>
          )}

          {/* Stock settings — manager/owner only */}
          {canEditAll && (
            <StockSettings
              form={form}
              onChange={handleChange}
              readOnly={isKnownItem && !!matchedItemId && !canEditAll}
              showCatalogCost={!isKnownItem}
              showCostOverride={isKnownItem}
            />
          )}

          {/* Description — only for genuinely new items */}
          {!isKnownItem && (
            <section className={styles.formSection}>
              <h2 className={styles.sectionTitle}>{t('description_label')}</h2>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="description">
                  {t('description_label')}
                </label>
                <textarea
                  id="description"
                  name="description"
                  className={styles.textarea}
                  placeholder={t('description_placeholder')}
                  rows={3}
                  value={form.description}
                  onChange={handleChange}
                />
              </div>
            </section>
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
              disabled={saving || (isKnownItem && adjustMode && delta === '')}
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
