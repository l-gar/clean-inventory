import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faCircleCheck,
  faMinus,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { updateItem } from '../utils/appsScript'
import { useStore } from '../store'
import LocationSelect from '../components/LocationSelect'
import styles from './EditItem.module.css'

const CATEGORIES = ['Chemicals', 'Equipment', 'PPE', 'Consumables', 'Tools']
const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

// Normalise whatever shape the item arrives in (store vs. Apps Script response)
function itemToForm(item) {
  return {
    name:         item.itemName       ?? item.name            ?? '',
    brand:        item.brand          ?? '',
    sku:          item.barcode        ?? '',
    category:     item.category       ?? '',
    location:     item.location_id    ?? item.locationId      ?? '',
    quantity:     String(item.quantity      ?? ''),
    unit:         item.unit           ?? 'each',
    minQuantity:  String(item.minQuantity   ?? item.min_quantity   ?? ''),
    costPerUnit:  String(item.costPerUnit   ?? item.cost_per_unit  ?? ''),
    expectedJobs: String(item.expectedJobs  ?? item.expected_jobs  ?? ''),
    notes:        item.notes          ?? '',
  }
}

export default function EditItem() {
  const { t }               = useTranslation()
  const { itemId }          = useParams()
  const { state: routeState } = useLocation()
  const navigate            = useNavigate()
  const { user }            = useAuth()
  const storeInventory      = useStore((s) => s.inventory)
  const invalidateInventory = useStore((s) => s.invalidateInventory)

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
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function stepDelta(dir) {
    setDelta((d) => String((Number(d) || 0) + dir))
  }

  const baseQty  = Number(resolvedItem?.quantity ?? form?.quantity ?? 0)
  const deltaNum = Number(delta) || 0
  const newTotal = adjustMode
    ? Math.max(0, baseQty + deltaNum)
    : Math.max(0, Number(form?.quantity ?? 0))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setSaveError('')

    try {
      const updates = { quantity: newTotal }

      if (canEditAll) {
        Object.assign(updates, {
          itemName:     form.name,
          brand:        form.brand,
          barcode:      form.sku,
          category:     form.category,
          locationId:   form.location,
          unit:         form.unit,
          minQuantity:  form.minQuantity,
          costPerUnit:  form.costPerUnit,
          expectedJobs: form.expectedJobs,
          notes:        form.notes,
        })
      }

      await updateItem(user.email, user.orgId, itemId, updates)
      invalidateInventory()
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

      <form className={styles.form} onSubmit={handleSubmit}>

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
        )}

        {/* ── Quantity — all roles ─────────────────────────────── */}
        <section className={styles.formSection}>

          <div className={styles.qtyHeader}>
            <h2 className={styles.sectionTitle}>{t('quantity')}</h2>
            <button
              type="button"
              className={`${styles.modeToggle} ${adjustMode ? styles.modeToggleActive : ''}`}
              onClick={() => { setAdjustMode((m) => !m); setDelta('') }}
            >
              {adjustMode ? t('set_exact') : t('adjust_qty')}
            </button>
          </div>

          {adjustMode ? (
            <>
              <div className={styles.currentStockRow}>
                <span className={styles.currentStockLabel}>{t('current_stock')}</span>
                <span className={styles.currentStockValue}>
                  {baseQty}
                  <span className={styles.currentStockUnit}> {form?.unit || 'ea'}</span>
                </span>
              </div>

              <div className={styles.adjustSection}>
                <label className={styles.label} htmlFor="delta">
                  {t('add_qty_label')}
                </label>
                <div className={styles.adjustRow}>
                  <button
                    type="button"
                    className={styles.stepper}
                    onClick={() => stepDelta(-1)}
                    aria-label="-1"
                  >
                    <FontAwesomeIcon icon={faMinus} aria-hidden="true" />
                  </button>
                  <input
                    id="delta"
                    type="number"
                    className={`${styles.input} ${styles.deltaInput}`}
                    value={delta}
                    onChange={(e) => setDelta(e.target.value)}
                    placeholder="0"
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                  />
                  <button
                    type="button"
                    className={styles.stepper}
                    onClick={() => stepDelta(1)}
                    aria-label="+1"
                  >
                    <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
                  </button>
                </div>

                {delta !== '' && delta !== '0' && (
                  <div className={styles.newTotalPreview}>
                    {t('new_total')}:{' '}
                    <strong>{newTotal} {form?.unit || 'ea'}</strong>
                    <span className={styles.calcNote}>
                      {' '}({baseQty} {deltaNum >= 0 ? '+' : '−'} {Math.abs(deltaNum)})
                    </span>
                  </div>
                )}
              </div>
            </>
          ) : (
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
                  value={form?.quantity ?? ''}
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
                  value={form?.unit ?? 'each'}
                  onChange={handleChange}
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Alert / cost rows — owner / manager only, inside quantity section */}
          {canEditAll && form && (
            <>
              <div className={styles.fieldRow} style={{ marginTop: 8 }}>
                <div className={styles.field}>
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
            </>
          )}
        </section>

        {/* ── Notes — owner / manager only ────────────────────── */}
        {canEditAll && form && (
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
        )}

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
            onClick={() => navigate(-1)}
            disabled={saving}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={saving || (adjustMode && delta === '')}
          >
            {saving ? t('saving') : t('save_changes')}
          </button>
        </div>

        {saveError && (
          <p className={styles.saveError} role="alert">{saveError}</p>
        )}

      </form>
    </div>
  )
}
