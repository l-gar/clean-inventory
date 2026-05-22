import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faBarcode,
  faCircleCheck,
  faBoxOpen,
  faRightLeft,
  faLocationDot,
  faCamera,
  faXmark,
  faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../hooks/useLocations'
import { callAppsScript } from '../utils/appsScript'
import { apiAddCatalogItem, apiAddStock, apiUpdateStock, apiDeductItem, apiRestockItem, apiAdjustItem, apiTransferItem } from '../store/api'
import { useStore } from '../store'
import LocationSelect from '../components/LocationSelect'
import StockAdjuster from '../components/StockAdjuster'
import TransferPanel from '../components/TransferPanel'
import NotesSection from '../components/NotesSection'
import CategoryInput from '../components/CategoryInput'
import SaveSuccessSplash from '../components/SaveSuccessSplash'
import StockSettings from '../components/StockSettings'
import styles from './ScanUpdate.module.css'

const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

function searchByName(query, catalog) {
  const q = query.trim().toLowerCase()
  const seen = new Set()
  const results = []
  for (const item of catalog) {
    const name = (item.itemName ?? item.item_name ?? '').toLowerCase()
    if (!name.includes(q)) continue
    const key = item.catalog_id ?? item.catalogId ?? name
    if (seen.has(key)) continue
    seen.add(key)
    results.push(item)
    if (results.length === 8) break
  }
  return results
}

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
  const catalog             = useStore((s) => s.catalog)
  const fetchCatalog        = useStore((s) => s.fetchCatalog)

  const isMember    = user?.role === 'org_member'
  const canEditAll  = user?.role === 'org_owner' || user?.role === 'manager'

  const [phase,      setPhase]      = useState('lookup')
  const [scanStatus, setScanStatus] = useState('idle')
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

  const [nameQuery,     setNameQuery]     = useState('')
  const [adjustNote,    setAdjustNote]    = useState('')
  const [activeTab,     setActiveTab]     = useState('update')
  const [transferDest,  setTransferDest]  = useState('')
  const [transferQty,   setTransferQty]   = useState(1)
  const [transferNote,  setTransferNote]  = useState('')
  const [transferring,  setTransferring]  = useState(false)
  const [transferError, setTransferError] = useState('')

  const videoRef        = useRef(null)
  const readerRef       = useRef(null)
  const successTimerRef = useRef(null)

  useEffect(() => {
    setForm((prev) => {
      if (prev.location || locations.length === 0) return prev
      if (isMember && locations.length !== 1) return prev
      return { ...prev, location: getDefaultLocation() }
    })
  }, [isMember, locations])

  useEffect(() => {
    setLookupLocation((prev) => {
      if (prev || locations.length === 0) return prev
      if (isMember && locations.length !== 1) return prev
      return getDefaultLocation()
    })
  }, [isMember, locations])

  useEffect(() => {
    if (user?.email && user?.orgId) fetchCatalog(user.email, user.orgId).catch(() => {})
  }, [user?.email, user?.orgId])

  useEffect(() => {
    return () => {
      readerRef.current?.reset()
      if (successTimerRef.current) clearTimeout(successTimerRef.current)
    }
  }, [])

  function getDefaultLocation() {
    if (locations.length === 0) return ''
    if (isMember && locations.length !== 1) return ''
    const saved = user?.email ? localStorage.getItem(`cleaninv_default_location_${user.email}`) : null
    const isValid = saved && locations.some((l) => l.location_id === saved)
    return isValid ? saved : locations[0].location_id
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
    setAdjustNote('')
    setNameQuery('')
    setActiveTab('update')
    setTransferError('')
    setTransferNote('')
    setForm({ ...EMPTY_FORM, location: lookupLocation || getDefaultLocation() })
  }

  async function runLookup(rawCode) {
    const code = rawCode.trim()
    if (!code) return
    setLookingUp(true)

    const padded = code.padStart(12, '0')

    try {
      await storeFetchInventory(user.email, user.orgId, 'all')
    } catch { /* fall through */ }

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

    try {
      const data = await callAppsScript('lookupBarcode', { upc: padded, email: user.email, orgId: user.orgId, locationId: lookupLocation || '' })

      if (data?.existsInInventory) {
        const stockId = data.stockId ?? data.itemId ?? null
        const inSelectedLoc = !lookupLocation || !data.locationId || data.locationId === lookupLocation
        if (inSelectedLoc && stockId) {
          setLookingUp(false)
          navigate(`/edit/${stockId}`, { state: { item: data } })
          return
        }
        setForm((prev) => ({
          ...prev,
          sku:         code,
          name:        data.name ?? data.itemName ?? data.title ?? '',
          brand:       data.brand ?? '',
          category:    data.category ?? prev.category,
          unit:        data.unit ?? prev.unit,
          location:    lookupLocation || prev.location,
          costPerUnit: String(data.costPerUnit ?? ''),
        }))
        setBaseQty(Number(data.quantity ?? 0))
        setMatchedItemId(stockId)
        setMatchedCatalogId(data.catalogId ?? null)
        setIsKnownItem(true)
        setLookingUp(false)
        setPhase('new_item')
        return
      }

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

  async function startScan() {
    setScanStatus('scanning')
    const { BrowserMultiFormatReader, NotFoundException } = await import('@zxing/library')
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

  function openTransferTab() {
    const dests = locations.filter((l) => l.location_id !== form.location)
    setTransferDest(dests[0]?.location_id ?? '')
    setTransferQty(1)
    setTransferNote('')
    setTransferError('')
    setActiveTab('transfer')
  }

  async function handleTransferSubmit() {
    if (!matchedItemId || !transferDest || transferQty < 1) return
    setTransferring(true)
    setTransferError('')
    try {
      await apiTransferItem({
        email: user.email,
        orgId: user.orgId,
        fromStockId: matchedItemId,
        catalogId: String(matchedCatalogId ?? ''),
        toLocationId: transferDest,
        quantity: String(transferQty),
        notes: transferNote.trim() || 'Scan & Update: transfer',
      })
      invalidateInventory()
      setActiveTab('update')
      setSaveSuccess(true)
      successTimerRef.current = setTimeout(() => {
        setSaveSuccess(false)
        resetToLookup()
      }, 4000)
    } catch {
      setTransferError(t('inventory.transferError'))
    } finally {
      setTransferring(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (activeTab === 'transfer') return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    if (successTimerRef.current) clearTimeout(successTimerRef.current)

    try {
      const submitQty = isKnownItem
        ? (adjustMode ? newTotal : Number(form.quantity))
        : Number(form.quantity)

      if (matchedItemId) {
        if (adjustMode) {
          if (deltaNum > 0) {
            await apiRestockItem({ email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: deltaNum, notes: adjustNote.trim() || 'Scan & Update: restock' })
          } else if (deltaNum < 0) {
            // TODO: add UI selector for transaction_type (job_usage vs sale)
            const deductParams = { email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: Math.abs(deltaNum), transactionType: 'job_usage', notes: adjustNote.trim() || 'Scan & Update: usage deduction' }
            await apiDeductItem(deductParams)
          }
        } else {
          if (!canEditAll) throw new Error(t('scan_update_save_error'))
          await apiAdjustItem({ email: user.email, orgId: user.orgId, stockId: matchedItemId, quantity: submitQty, notes: adjustNote.trim() || 'Scan & Update: manual quantity correction' })
        }
      } else if (matchedCatalogId) {
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
          catalogId:             catalogRes.catalogId ?? catalogRes.catalog_id,
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

  function handleCatalogSelect(catalogItem) {
    const barcode = String(catalogItem.barcode ?? catalogItem.sku ?? '').trim()
    if (barcode) {
      const itemName = catalogItem.itemName ?? catalogItem.item_name ?? ''
      setNameQuery(itemName)
      setSkuInput(barcode)
      setScanStatus('found')
      runLookup(barcode)
      return
    }
    setNameQuery('')
    // No barcode — populate form directly and let user add to current location
    setForm((prev) => ({
      ...prev,
      sku:      '',
      name:     catalogItem.itemName ?? catalogItem.item_name ?? '',
      brand:    catalogItem.brand ?? '',
      category: catalogItem.category ?? prev.category,
      unit:     catalogItem.unit ?? prev.unit,
      location: lookupLocation || prev.location,
      itemLowStockThreshold: String(catalogItem.reorder_point ?? catalogItem.reorderPoint ?? ''),
      costPerUnit:           String(catalogItem.cost_per_unit ?? catalogItem.costPerUnit ?? ''),
      trackStock:            catalogItem.track_stock ?? catalogItem.trackStock ?? true,
    }))
    setMatchedItemId(null)
    setMatchedCatalogId(catalogItem.catalog_id ?? catalogItem.catalogId ?? null)
    setIsKnownItem(true)
    setPhase('new_item')
  }

  const scanning  = scanStatus === 'scanning'
  const scanFound = scanStatus === 'found'

  const nameResults = nameQuery.trim().length >= 2 ? searchByName(nameQuery, catalog) : []
  const locationName = locations.find((l) => l.location_id === form.location)?.location_name ?? form.location
  const transferDests = locations.filter((l) => l.location_id !== form.location)
  const allMatches = isKnownItem && form.sku ? lookupByBarcode(form.sku) : []
  const itemAtCurrentLoc = matchedItemId !== null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* ── Phase: lookup ─────────────────────────────────────────────── */}
      {phase === 'lookup' && (
        <>
          <div className={styles.pageHeader}>
            <h1 className={styles.title}>{t('scan_update')}</h1>
            <p className={styles.subtitle}>{t('scan_update_subtitle')}</p>
          </div>

          <div className={styles.lookupContent}>

            <div className={styles.locationField}>
              <label className={styles.fieldLabel} htmlFor="lookupLocation">
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
              <div className={`${styles.scanViewfinder} ${scanning ? styles.scanActive : ''} ${scanFound ? styles.scanDone : ''}`}>
                <video
                  ref={videoRef}
                  className={styles.scanVideo}
                  style={{ display: scanning ? 'block' : 'none' }}
                  playsInline
                  muted
                />

                {scanning && (
                  <>
                    <div className={styles.scanLine} />
                    <div className={styles.scanCorner} data-pos="tl" />
                    <div className={styles.scanCorner} data-pos="tr" />
                    <div className={styles.scanCorner} data-pos="bl" />
                    <div className={styles.scanCorner} data-pos="br" />
                    <p className={styles.scanHint}>{t('point_camera_at_barcode')}</p>
                    <p className={styles.scanHintSub}>{t('scan_hold_steady')}</p>
                  </>
                )}

                {scanFound && (
                  <div className={styles.scanSuccess}>
                    <FontAwesomeIcon icon={faCircleCheck} className={styles.scanSuccessIcon} aria-hidden="true" />
                    <span className={styles.scanSuccessCode}>{skuInput}</span>
                    {lookingUp && <span className={styles.scanLookup}>{t('looking_up_product')}</span>}
                  </div>
                )}

                {!scanning && !scanFound && (
                  <div className={styles.scanIdle}>
                    <FontAwesomeIcon icon={faBarcode} className={styles.scanIdleIcon} aria-hidden="true" />
                    <span>{t('tap_to_scan')}</span>
                  </div>
                )}
              </div>

              {scanning ? (
                <button type="button" className={`${styles.scanBtn} ${styles.scanBtnStop}`} onClick={stopScan}>
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                  {t('stop_scanning')}
                </button>
              ) : scanFound ? (
                <button
                  type="button"
                  className={styles.scanBtn}
                  onClick={() => runLookup(skuInput)}
                  disabled={lookingUp}
                >
                  <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
                  {t('barcode_found_continue')}
                </button>
              ) : (
                <button type="button" className={styles.scanBtn} onClick={startScan} disabled={lookingUp}>
                  <FontAwesomeIcon icon={faCamera} aria-hidden="true" />
                  {t('start_camera_scan')}
                </button>
              )}
            </div>

            <div className={styles.orDivider}>
              <div className={styles.orLine} />
              <span className={styles.orText}>{t('or_enter_sku')}</span>
              <div className={styles.orLine} />
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

            <div className={styles.orDivider}>
              <div className={styles.orLine} />
              <span className={styles.orText}>{t('or_search_name')}</span>
              <div className={styles.orLine} />
            </div>

            <input
              className={styles.nameInput}
              type="text"
              placeholder={t('name_search_placeholder')}
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              disabled={lookingUp}
            />

            {nameResults.length > 0 && !lookingUp && (
              <div className={styles.nameResultsList}>
                {nameResults.map((item) => {
                  const key = item.catalog_id ?? item.catalogId ?? item.itemName
                  return (
                    <button
                      key={key}
                      type="button"
                      className={styles.nameResultItem}
                      onClick={() => handleCatalogSelect(item)}
                    >
                      <span className={styles.nameResultName}>{item.itemName ?? item.item_name}</span>
                      {(item.brand || item.category) && (
                        <span className={styles.nameResultMeta}>
                          {[item.brand, item.category].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <button type="button" className={styles.addManuallyBtn} onClick={() => setPhase('new_item')}>
              {t('add_without_scan')}
            </button>
          </div>
        </>
      )}

      {/* ── Phase: new item — success splash ──────────────────────────── */}
      {phase === 'new_item' && saveSuccess && (
        <SaveSuccessSplash message={t('item_saved_success')} detail={form.name} />
      )}

      {/* ── Phase: new item form ───────────────────────────────────────── */}
      {phase === 'new_item' && !saveSuccess && (
        <form className={styles.form} onSubmit={handleSubmit}>

          <div className={styles.backNav}>
            <button type="button" className={styles.backBtn} onClick={resetToLookup}>
              <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
              {t('back_to_lookup')}
            </button>
          </div>

          <div className={styles.formContent}>

            {isKnownItem ? (
              <>
                {/* ── Found item card ─────────────────────────────── */}
                <div className={styles.foundItemCard}>
                  <div className={styles.foundBadgeRow}>
                    <FontAwesomeIcon icon={faCircleCheck} className={styles.foundBadgeIcon} aria-hidden="true" />
                    <span className={styles.foundBadgeText}>{t('item_found_in_inventory')}</span>
                  </div>
                  <div className={styles.foundItemName}>{form.name}</div>
                  <div className={styles.foundItemMeta}>
                    {form.brand && <span className={styles.foundItemBrand}>{form.brand}</span>}
                    {form.category && <span className={styles.categoryChip}>{form.category}</span>}
                    {form.sku && <span className={styles.foundItemSku}>{form.sku}</span>}
                  </div>
                  <div className={styles.foundLocations}>
                    {allMatches.map((m) => {
                      const lid = m.location_id ?? m.locationId
                      const lname = locations.find((l) => l.location_id === lid)?.location_name ?? lid
                      const isCurrent = lid === lookupLocation
                      return (
                        <div key={lid} className={`${styles.foundLocationRow}${isCurrent ? ` ${styles.foundLocationCurrent}` : ''}`}>
                          <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                          <span>{lname}</span>
                          {isCurrent && <span className={styles.foundLocBadge}>{t('here')}</span>}
                        </div>
                      )
                    })}
                    {!itemAtCurrentLoc && lookupLocation && (
                      <div className={`${styles.foundLocationRow} ${styles.foundLocationAbsent}`}>
                        <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                        <span>{locations.find((l) => l.location_id === lookupLocation)?.location_name ?? lookupLocation}</span>
                        <span className={`${styles.foundLocBadge} ${styles.foundLocBadgeAbsent}`}>{t('not_present_here')}</span>
                      </div>
                    )}
                    {allMatches.length === 0 && (itemAtCurrentLoc || !lookupLocation) && form.location && (
                      <div className={styles.foundLocationRow}>
                        <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                        <span>{locationName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Update / Transfer tab toggle ─────────────────── */}
                {matchedItemId && (
                  <div className={styles.tabToggle}>
                    <button
                      type="button"
                      className={`${styles.tabBtn} ${activeTab === 'update' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('update')}
                    >
                      <FontAwesomeIcon icon={faBoxOpen} aria-hidden="true" />
                      {t('update_stock')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.tabBtn} ${activeTab === 'transfer' ? styles.tabBtnActive : ''}`}
                      onClick={openTransferTab}
                      disabled={transferDests.length === 0}
                    >
                      <FontAwesomeIcon icon={faRightLeft} aria-hidden="true" />
                      {t('inventory.transfer')}
                    </button>
                  </div>
                )}

                {/* ── Update tab ───────────────────────────────────── */}
                {activeTab === 'update' && (
                  <>
                    <StockAdjuster
                      baseQty={baseQty}
                      unit={form.unit}
                      adjustMode={adjustMode}
                      delta={delta}
                      quantity={form.quantity}
                      onModeToggle={() => { setAdjustMode((m) => !m); setDelta(''); setAdjustNote('') }}
                      onDeltaChange={setDelta}
                      onQuantityChange={(val) => setForm((prev) => ({ ...prev, quantity: val }))}
                      onUnitChange={(val) => setForm((prev) => ({ ...prev, unit: val }))}
                      showModeToggle={canEditAll}
                      correctionNote={adjustNote}
                      onCorrectionNoteChange={setAdjustNote}
                    />
                    <div className={styles.actionBar}>
                      <button type="button" className={styles.btnSecondary} onClick={resetToLookup} disabled={saving}>
                        {t('clear')}
                      </button>
                      <button
                        type="submit"
                        className={styles.btnPrimary}
                        disabled={saving || (adjustMode && delta === '')}
                      >
                        {saving ? t('saving') : t('save_changes')}
                      </button>
                    </div>
                  </>
                )}

                {/* ── Transfer tab (inline) ────────────────────────── */}
                {activeTab === 'transfer' && (
                  <div className={styles.transferPanel}>
                    <TransferPanel
                      destinations={transferDests}
                      dest={transferDest}
                      onDestChange={setTransferDest}
                      qty={transferQty}
                      onQtyChange={setTransferQty}
                      maxQty={baseQty}
                      note={transferNote}
                      onNoteChange={setTransferNote}
                      error={transferError}
                      transferring={transferring}
                      onCancel={() => setActiveTab('update')}
                      onConfirm={handleTransferSubmit}
                    />
                  </div>
                )}
              </>
            ) : (
              <>
                {/* ── New item badge ───────────────────────────────── */}
                <div className={styles.newItemBadge}>
                  {t('new_item_badge')}
                </div>

                {/* ── Item details ─────────────────────────────────── */}
                <div className={styles.detailsCard}>
                  <div className={styles.detailsHeader}>
                    <FontAwesomeIcon icon={faPenToSquare} className={styles.detailsIcon} aria-hidden="true" />
                    <span className={styles.detailsTitle}>{t('item_details')}</span>
                  </div>
                  <div className={styles.detailsBody}>
                    <div className={styles.formField}>
                      <label className={styles.label} htmlFor="name">
                        {t('item_name')} <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="name" name="name" type="text"
                        className={styles.input}
                        placeholder={t('item_name_placeholder')}
                        value={form.name}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.formField}>
                        <label className={styles.label} htmlFor="brand">{t('brand')}</label>
                        <input id="brand" name="brand" type="text" className={styles.input} placeholder={t('brand_placeholder')} value={form.brand} onChange={handleChange} />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.label} htmlFor="supplier">{t('supplier')}</label>
                        <input id="supplier" name="supplier" type="text" className={styles.input} placeholder={t('supplier_placeholder')} value={form.supplier} onChange={handleChange} />
                      </div>
                    </div>

                    <div className={styles.fieldRow}>
                      <div className={styles.formField}>
                        <label className={styles.label} htmlFor="category">{t('category')}</label>
                        <CategoryInput value={form.category} onChange={handleChange} className={styles.input} />
                      </div>
                      <div className={styles.formField}>
                        <label className={styles.label} htmlFor="location">{t('location')} <span className={styles.required}>*</span></label>
                        <LocationSelect id="location" name="location" value={form.location} onChange={handleChange} required className={styles.select} />
                      </div>
                    </div>

                    <div className={styles.formField}>
                      <label className={styles.label} htmlFor="sku">{t('sku_barcode')}</label>
                      <input id="sku" name="sku" type="text" className={styles.input} placeholder={t('sku_placeholder')} value={form.sku} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                {/* ── Starting quantity ────────────────────────────── */}
                <section className={styles.formSection}>
                  <h2 className={styles.sectionTitle}>{t('starting_qty')}</h2>
                  <div className={styles.fieldRow}>
                    <div className={styles.formField} style={{ flex: 2 }}>
                      <label className={styles.label} htmlFor="quantity">
                        {t('quantity')} <span className={styles.required}>*</span>
                      </label>
                      <input
                        id="quantity" name="quantity" type="number" min="0"
                        className={`${styles.input} ${styles.inputLarge}`}
                        placeholder="0"
                        value={form.quantity}
                        onChange={handleChange}
                        required
                      />
                    </div>
                    <div className={styles.formField} style={{ flex: 1 }}>
                      <label className={styles.label} htmlFor="unit">{t('unit')}</label>
                      <select id="unit" name="unit" className={styles.select} value={form.unit} onChange={handleChange}>
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                {/* ── Stock settings — manager/owner only ──────────── */}
                {canEditAll && (
                  <StockSettings
                    form={form}
                    onChange={handleChange}
                    showCatalogCost
                    showCostOverride={false}
                  />
                )}

                <NotesSection value={form.description} onChange={handleChange} />

                <div className={styles.actionBar}>
                  <button type="button" className={styles.btnSecondary} onClick={resetToLookup} disabled={saving}>
                    {t('clear')}
                  </button>
                  <button type="submit" className={styles.btnPrimary} disabled={saving}>
                    {saving ? t('saving') : t('add_item')}
                  </button>
                </div>
              </>
            )}

            {saveError && (
              <p className={styles.saveError} role="alert">{saveError}</p>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
