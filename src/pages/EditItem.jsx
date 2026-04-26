import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { apiUpdateCatalogItem, apiUpdateStock, apiDeductItem, apiRestockItem, apiAdjustItem } from '../store/api'
import { parseTrackStock } from '../domain/normalize'
import { useStore } from '../store'
import LocationSelect from '../components/LocationSelect'
import CategoryInput from '../components/CategoryInput'
import StockAdjuster from '../components/StockAdjuster'
import StockSettings from '../components/StockSettings'
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
    itemLowStockThreshold: String(item.item_low_stock_threshold ?? item.itemLowStockThreshold ?? item.minQuantity ?? item.min_quantity ?? ''),
    costPerUnit:          String(item.cost_per_unit ?? item.costPerUnit    ?? ''),
    costPerUnitOverride:  String(item.cost_per_unit_override ?? item.costPerUnitOverride ?? ''),
    expectedJobs:         String(item.expected_jobs ?? item.expectedJobs   ?? ''),
    trackStock: parseTrackStock(item.track_stock ?? item.trackStock),
    description:          item.description         ?? '',
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

  // Resolve item: router state (scan redirect) → store cache → not found
  const resolvedItem =
    routeState?.item ??
    storeInventory.find((i) => String(i.itemId) === String(itemId)) ??
    null

  const [form,        setForm]        = useState(() => resolvedItem ? itemToForm(resolvedItem) : null)
  const [adjustMode,  setAdjustMode]  = useState(true)   // default on for scan flow
  const [delta,       setDelta]       = useState('')
  const [saving,      setSaving]      = useState(false)
  const [saveError,   setSaveError]   = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

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
          await apiDeductItem({ email: user.email, orgId: user.orgId, stockId, quantity: Math.abs(deltaNum) })
        }
      } else {
        await apiAdjustItem({
          email: user.email, orgId: user.orgId, stockId,
          quantity: newTotal,
          notes: form.description || 'Manual stock adjustment',
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
        })
      }

      invalidateInventory()
      if (canEditAll) invalidateCatalog()
      // Prime fresh data into store + sessionStorage during the splash delay
      fetchInventory(user.email, user.orgId, inventoryLocationId ?? 'all')
      if (canEditAll) fetchCatalog(user.email, user.orgId)
      setSaveSuccess(true)
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
        <h1 className={styles.title}>{t('edit_item')}</h1>
        <p className={styles.itemSubtitle}>{form?.name || resolvedItem?.itemName}</p>
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

        {/* ── Quantity — all roles ─────────────────────────────── */}
        <StockAdjuster
          baseQty={baseQty}
          unit={form?.unit}
          adjustMode={adjustMode}
          delta={delta}
          quantity={form?.quantity}
          onModeToggle={() => { setAdjustMode((m) => !m); setDelta('') }}
          onDeltaChange={setDelta}
          onQuantityChange={(val) => setForm((prev) => ({ ...prev, quantity: val }))}
          onUnitChange={(val) => setForm((prev) => ({ ...prev, unit: val }))}
          autoFocus
        />

        {/* ── Stock settings — owner / manager only ───────────── */}
        {canEditAll && form && (
          <StockSettings
            form={form}
            onChange={handleChange}
            showCatalogCost
            showCostOverride
          />
        )}

        {/* ── Description — owner / manager only ─────────────── */}
        {canEditAll && form && (
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
