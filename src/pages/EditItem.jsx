import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faPenToSquare, faHeartPulse, faTag, faLocationDot, faBarcode } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { apiUpdateCatalogItem, apiUpdateStock, apiDeductItem, apiRestockItem, apiAdjustItem } from '../store/api'
import { parseTrackStock } from '../domain/normalize'
import { useStore } from '../store'
import { useLocations } from '../hooks/useLocations'
import CategoryInput from '../components/CategoryInput'
import StockAdjuster from '../components/StockAdjuster'
import NotesSection from '../components/NotesSection'
import SaveSuccessSplash from '../components/SaveSuccessSplash'
import styles from './EditItem.module.css'


// Normalise whatever shape the item arrives in (store vs. Apps Script response)
function itemToForm(item) {
  return {
    name:                 item.itemName            ?? item.name            ?? '',
    brand:                item.brand               ?? '',
    supplier:             item.supplier            ?? '',
    sku:                  item.barcode             ?? '',
    category:             item.category            ?? '',
    location:             item.location_id         ?? item.locationId      ?? '',
    quantity:             String(item.quantity      ?? ''),
    unit:                 item.unit                ?? 'each',
    itemLowStockThreshold: String(item.item_low_stock_threshold ?? item.itemLowStockThreshold ?? item.minQuantity ?? item.min_quantity ?? (item.lowStockThreshold ?? '')),
    costPerUnit:          String(item.cost_per_unit ?? item.costPerUnit ?? item.resolvedCost ?? ''),
    costPerUnitOverride:  String(item.cost_per_unit_override ?? item.costPerUnitOverride ?? ''),
    expectedJobs:         String(item.expected_jobs ?? item.expectedJobs ?? ''),
    trackStock: parseTrackStock(item.track_stock ?? item.trackStock),
    description:          item.description         ?? '',
    targetQuantity:          String(item.target_quantity        ?? item.targetQuantity        ?? ''),
    restockCycleDays:        String(item.restock_cycle_days     ?? item.restockCycleDays      ?? ''),
    targetQuantityOverride:  String(item.target_quantity_override ?? item.targetQuantityOverride ?? ''),
    restockCycleDaysOverride:String(item.restock_cycle_days_override ?? item.restockCycleDaysOverride ?? ''),
    reorderPoint:            String(item.reorderPoint    ?? item.reorder_point    ?? ''),
    reorderQuantity:         String(item.reorder_quantity ?? item.reorderQuantity ?? ''),
  }
}

export default function EditItem() {
  const { t }               = useTranslation()
  const { itemId }          = useParams()
  const { state: routeState } = useLocation()
  const navigate            = useNavigate()
  const { user }            = useAuth()
  const storeInventory       = useStore((s) => s.inventory)
  const invalidateInventory  = useStore((s) => s.invalidateInventory)
  const invalidateCatalog    = useStore((s) => s.invalidateCatalog)
  const fetchInventory       = useStore((s) => s.fetchInventory)
  const fetchCatalog         = useStore((s) => s.fetchCatalog)
  const inventoryLocationId  = useStore((s) => s.inventoryLocationId)

  const isOwner    = user?.role === 'org_owner'
  const isManager  = user?.role === 'manager'
  const canEditAll = isOwner || isManager

  const { locations } = useLocations()

  // Resolve item: router state (scan redirect) → store cache → not found
  const resolvedItem =
    routeState?.item ??
    storeInventory.find((i) => String(i.itemId) === String(itemId)) ??
    null

  const [form,        setForm]        = useState(() => resolvedItem ? itemToForm(resolvedItem) : null)

  const locationName = locations.find(l => l.location_id === form?.location)?.location_name ?? ''
  const [adjustMode,  setAdjustMode]  = useState(true)   // default on for scan flow
  const [delta,       setDelta]       = useState('')
  const [adjustNote,  setAdjustNote]  = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const [openTip, setOpenTip] = useState(null)
  const tipRef = useRef(null)

  const toggleTip = (id, e) => {
    e.stopPropagation()
    setOpenTip((prev) => (prev === id ? null : id))
  }

  useEffect(() => {
    if (!openTip) return
    const close = () => setOpenTip(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [openTip])

  useLayoutEffect(() => {
    const el = tipRef.current
    if (!el) return
    el.style.left = '0'
    const { left, right } = el.getBoundingClientRect()
    const rightOverflow = right - window.innerWidth + 8
    const leftOverflow  = 8 - left
    if (rightOverflow > 0) el.style.left = `${-rightOverflow}px`
    else if (leftOverflow > 0) el.style.left = `${leftOverflow}px`
  }, [openTip])

  // If store was empty on mount but populates later, seed the form
  useEffect(() => {
    if (!form && resolvedItem) setForm(itemToForm(resolvedItem))
  }, [resolvedItem, form])

  function handleChange(e) {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({ ...prev, [e.target.name]: value }))
  }

  const baseQty  = Number(resolvedItem?.quantity ?? form?.quantity ?? 0)
  const deltaNum = Number(delta) || 0
  const newTotal = adjustMode
    ? Math.max(0, baseQty + deltaNum)
    : Math.max(0, Number(form?.quantity ?? 0))

  const stockId   = resolvedItem?.stock_id   ?? resolvedItem?.stockId   ?? null
  const catalogId = resolvedItem?.catalog_id ?? resolvedItem?.catalogId ?? null

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setSaveError('')

    try {
      // Quantity operation
      if (adjustMode) {
        if (deltaNum > 0) {
          await apiRestockItem({ email: user.email, orgId: user.orgId, stockId, quantity: deltaNum })
        } else if (deltaNum < 0) {
          // TODO: add UI selector for transaction_type (job_usage vs sale)
          const deductParams = { email: user.email, orgId: user.orgId, stockId, quantity: Math.abs(deltaNum), transactionType: 'job_usage', notes: adjustNote.trim() || 'Edit Item: manual stock reduction' }
          await apiDeductItem(deductParams)
        }
      } else {
        if (!canEditAll) throw new Error(t('edit_item_save_error'))
        await apiAdjustItem({
          email: user.email, orgId: user.orgId, stockId,
          quantity: newTotal,
          notes: adjustNote.trim() || 'Edit Item: manual quantity correction',
        })
      }

      // Catalog metadata — owner / manager only
      if (canEditAll && catalogId) {
        await apiUpdateCatalogItem({
          email: user.email, orgId: user.orgId, catalogId,
          itemName:    form.name,
          brand:       form.brand,
          supplier:    form.supplier,
          barcode:     form.sku,
          description: form.description,
          category:    form.category,
          unit:        form.unit,
          trackStock:  form.trackStock,
          ...(isOwner ? {
            targetQuantity:   form.targetQuantity,
            restockCycleDays: form.restockCycleDays,
            reorderPoint:     form.reorderPoint,
            reorderQuantity:  form.reorderQuantity,
          } : {}),
        })
      }

      // Stock metadata — owner / manager only
      if (canEditAll && stockId) {
        await apiUpdateStock({
          email: user.email, orgId: user.orgId, stockId,
          locationId:            form.location,
          itemLowStockThreshold: form.itemLowStockThreshold,
          costPerUnitOverride:   form.costPerUnitOverride,
          expectedJobs:          form.expectedJobs,
          targetQuantityOverride:   form.targetQuantityOverride,
          restockCycleDaysOverride: form.restockCycleDaysOverride,
        })
      }

      invalidateInventory()
      if (canEditAll) invalidateCatalog()
      setSaveSuccess(true)
      // Await fresh data so InventoryList doesn't seed from stale store on navigate
      await Promise.allSettled([
        fetchInventory(user.email, user.orgId, inventoryLocationId ?? 'all'),
        canEditAll ? fetchCatalog(user.email, user.orgId) : Promise.resolve(),
      ])
      setTimeout(() => navigate('/inventory'), 1500)
    } catch (err) {
      setSaveError(err?.message || t('edit_item_save_error'))
    } finally {
      setSaving(false)
    }
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!resolvedItem && !form) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            {t('back')}
          </button>
          <h1 className={styles.title}>{t('edit_item')}</h1>
        </div>
        <div className={styles.notFound}>
          <p>{t('edit_item_not_found')}</p>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => navigate('/inventory')}
          >
            {t('go_to_inventory')}
          </button>
        </div>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <button type="button" className={styles.backBtn} onClick={() => navigate(-1)}>
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          {t('back')}
        </button>
        <h1 className={styles.title}>{form?.name || resolvedItem?.itemName}</h1>
        <div className={styles.headerChips}>
          {form?.category && (
            <span className={`${styles.chip} ${styles.chipCategory}`}>
              <FontAwesomeIcon icon={faTag} aria-hidden="true" />
              {form.category}
            </span>
          )}
          {locationName && (
            <span className={`${styles.chip} ${styles.chipNeutral}`}>
              <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
              {locationName}
            </span>
          )}
          {form?.sku && (
            <span className={`${styles.chip} ${styles.chipSku}`}>
              <FontAwesomeIcon icon={faBarcode} aria-hidden="true" />
              {form.sku}
            </span>
          )}
        </div>
      </div>

      {saveSuccess && (
        <SaveSuccessSplash
          message={t('item_saved_success')}
          detail={form?.name || resolvedItem?.itemName}
        />
      )}

      {!saveSuccess && <form className={styles.form} onSubmit={handleSubmit}>

        {/* ── Item details — owner / manager only ─────────────── */}
        {canEditAll && form && (
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <FontAwesomeIcon icon={faPenToSquare} className={styles.detailsIcon} aria-hidden="true" />
              <span className={styles.detailsTitle}>{t('item_details')}</span>
            </div>
            <div className={styles.detailsBody}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="name">
                  {t('item_name')} <span className={styles.required}>*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className={styles.input}
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="brand">{t('brand')}</label>
                  <input id="brand" name="brand" type="text" className={styles.input} value={form.brand} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="supplier">{t('supplier')}</label>
                  <input id="supplier" name="supplier" type="text" className={styles.input} placeholder={t('supplier_placeholder')} value={form.supplier} onChange={handleChange} />
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="category">{t('category')}</label>
                <CategoryInput value={form.category} onChange={handleChange} className={styles.input} />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="sku">{t('sku_barcode')}</label>
                <input id="sku" name="sku" type="text" className={styles.input} value={form.sku} onChange={handleChange} />
              </div>
            </div>
          </div>
        )}

        {/* ── Quantity — all roles ─────────────────────────────── */}
        <StockAdjuster
          baseQty={baseQty}
          unit={form?.unit}
          adjustMode={adjustMode}
          delta={delta}
          quantity={form?.quantity}
          onModeToggle={() => { setAdjustMode((m) => !m); setDelta(''); setAdjustNote('') }}
          onDeltaChange={setDelta}
          onQuantityChange={(val) => setForm((prev) => ({ ...prev, quantity: val }))}
          onUnitChange={(val) => setForm((prev) => ({ ...prev, unit: val }))}
          autoFocus
          showModeToggle={canEditAll}
          correctionNote={adjustNote}
          onCorrectionNoteChange={setAdjustNote}
        />

        {/* ── Catalog — owner / manager only ─────────────────── */}
        {canEditAll && form && (
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <FontAwesomeIcon icon={faTag} className={styles.detailsIcon} aria-hidden="true" />
              <span className={styles.detailsTitle}>{t('catalog_settings')}</span>
            </div>
            <div className={styles.detailsBody}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="costPerUnit">{t('cost_per_unit')}</label>
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
              <label className={styles.trackRow}>
                <div className={styles.trackText}>
                  <span className={styles.trackLabel}>{t('track_stock')}</span>
                  <span className={styles.trackSub}>{t('track_stock_sub')}</span>
                </div>
                <span className={styles.switchTrack}>
                  <input
                    type="checkbox"
                    name="trackStock"
                    checked={!!form.trackStock}
                    onChange={handleChange}
                    className={styles.switchInput}
                  />
                  <span className={styles.switchThumb} />
                </span>
              </label>
            </div>
          </div>
        )}

        {/* ── Health targets — owner only ──────────────────────── */}
        {isOwner && form && (
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <FontAwesomeIcon icon={faHeartPulse} className={styles.detailsIcon} aria-hidden="true" />
              <span className={styles.detailsTitle}>{t('health_targets')}</span>
            </div>
            <div className={styles.detailsBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="targetQuantity">{t('target_qty')}</label>
                    <span className={styles.tipWrap}>
                      <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('targetQty', e)} aria-expanded={openTip === 'targetQty'} aria-label={t('more_info')}>i</button>
                      {openTip === 'targetQty' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('target_qty_tip')}</div>}
                    </span>
                  </div>
                  <input id="targetQuantity" name="targetQuantity" type="number" min="0" className={styles.input} placeholder="—" value={form.targetQuantity} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="restockCycleDays">{t('restock_cycle_days')}</label>
                    <span className={styles.tipWrap}>
                      <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('cycleDays', e)} aria-expanded={openTip === 'cycleDays'} aria-label={t('more_info')}>i</button>
                      {openTip === 'cycleDays' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('restock_cycle_days_tip')}</div>}
                    </span>
                  </div>
                  <input id="restockCycleDays" name="restockCycleDays" type="number" min="0" className={styles.input} placeholder="—" value={form.restockCycleDays} onChange={handleChange} />
                </div>
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="reorderPoint">{t('reorder_point')}</label>
                    <span className={styles.tipWrap}>
                      <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('reorderPoint', e)} aria-expanded={openTip === 'reorderPoint'} aria-label={t('more_info')}>i</button>
                      {openTip === 'reorderPoint' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('reorder_point_tip')}</div>}
                    </span>
                  </div>
                  <input id="reorderPoint" name="reorderPoint" type="number" min="0" className={styles.input} placeholder="—" value={form.reorderPoint} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="reorderQuantity">{t('reorder_quantity')}</label>
                    <span className={styles.tipWrap}>
                      <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('reorderQty', e)} aria-expanded={openTip === 'reorderQty'} aria-label={t('more_info')}>i</button>
                      {openTip === 'reorderQty' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('reorder_quantity_tip')}</div>}
                    </span>
                  </div>
                  <input id="reorderQuantity" name="reorderQuantity" type="number" min="0" className={styles.input} placeholder="—" value={form.reorderQuantity} onChange={handleChange} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── This location — owner / manager only ─────────────── */}
        {canEditAll && form && (
          <div className={styles.detailsCard}>
            <div className={styles.detailsHeader}>
              <FontAwesomeIcon icon={faLocationDot} className={styles.detailsIcon} aria-hidden="true" />
              <span className={styles.detailsTitle}>{t('this_location')}</span>
            </div>
            <div className={styles.detailsBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="itemLowStockThreshold">{t('alert_below')}</label>
                    <span className={styles.tipWrap}>
                      <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('alertBelow', e)} aria-expanded={openTip === 'alertBelow'} aria-label={t('more_info')}>i</button>
                      {openTip === 'alertBelow' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('alert_below_tip')}</div>}
                    </span>
                  </div>
                  <input id="itemLowStockThreshold" name="itemLowStockThreshold" type="number" min="0" className={styles.input} placeholder="0" value={form.itemLowStockThreshold} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="costPerUnitOverride">{t('cost_per_unit_override')}</label>
                  <input id="costPerUnitOverride" name="costPerUnitOverride" type="number" min="0" step="0.01" className={styles.input} placeholder="—" value={form.costPerUnitOverride} onChange={handleChange} />
                </div>
              </div>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="expectedJobs">{t('expected_jobs')}</label>
                  <span className={styles.tipWrap}>
                    <button type="button" className={styles.infoBtn} onClick={(e) => toggleTip('expectedJobs', e)} aria-expanded={openTip === 'expectedJobs'} aria-label={t('more_info')}>i</button>
                    {openTip === 'expectedJobs' && <div ref={tipRef} className={styles.tooltip} role="tooltip">{t('expected_jobs_tip')}</div>}
                  </span>
                </div>
                <input id="expectedJobs" name="expectedJobs" type="number" min="0" step="any" className={styles.input} placeholder={t('expected_jobs_placeholder')} value={form.expectedJobs} onChange={handleChange} />
              </div>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="targetQuantityOverride">{t('target_qty_override')}</label>
                  <input id="targetQuantityOverride" name="targetQuantityOverride" type="number" min="0" className={styles.input} placeholder={form.targetQuantity || '—'} value={form.targetQuantityOverride} onChange={handleChange} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="restockCycleDaysOverride">{t('restock_cycle_override')}</label>
                  <input id="restockCycleDaysOverride" name="restockCycleDaysOverride" type="number" min="0" className={styles.input} placeholder={form.restockCycleDays || '—'} value={form.restockCycleDaysOverride} onChange={handleChange} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Description — owner / manager only ─────────────── */}
        {canEditAll && form && (
          <NotesSection value={form.description} onChange={handleChange} />
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSecondary}
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || (!canEditAll && adjustMode && delta === '')}
          >
            {saving ? t('saving') : t('save_changes')}
          </button>

        </div>

        {saveError && (
          <p className={styles.saveError} role="alert">{saveError}</p>
        )}

      </form>}
    </div>
  )
}
