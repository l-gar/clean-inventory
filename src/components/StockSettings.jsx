import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import styles from './StockSettings.module.css'

/**
 * Reusable stock-settings form section.
 *
 * Props:
 *   form             — { itemLowStockThreshold, costPerUnit, costPerUnitOverride, expectedJobs, trackStock }
 *   onChange         — standard input event handler; must handle type="checkbox" (e.target.checked)
 *   readOnly         — show values as read-only display instead of inputs
 *   showCatalogCost  — show the costPerUnit (catalog-level default) field
 *   showCostOverride — show the costPerUnitOverride (per-location override) field
 *
 * Visibility (canEditAll gate) is the parent's responsibility — this component
 * always renders when mounted.
 */
export default function StockSettings({
  form,
  onChange,
  readOnly = false,
  showCatalogCost = true,
  showCostOverride = false,
}) {
  const { t } = useTranslation()
  const [openTip, setOpenTip] = useState(null)
  const tooltipRef = useRef(null)

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
    const el = tooltipRef.current
    if (!el) return
    el.style.left = '0'
    const { left, right } = el.getBoundingClientRect()
    const rightOverflow = right - window.innerWidth + 8
    const leftOverflow = 8 - left
    if (rightOverflow > 0) el.style.left = `${-rightOverflow}px`
    else if (leftOverflow > 0) el.style.left = `${leftOverflow}px`
  }, [openTip])

  if (readOnly) {
    const hasAny =
      form.itemLowStockThreshold || form.costPerUnit ||
      form.costPerUnitOverride   || form.expectedJobs
    if (!hasAny) return null

    return (
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <FontAwesomeIcon icon={faTriangleExclamation} className={styles.headerIcon} aria-hidden="true" />
          <span className={styles.headerTitle}>{t('stock_settings')}</span>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.fieldRow}>
            {form.itemLowStockThreshold ? (
              <div className={styles.field}>
                <span className={styles.label}>{t('alert_below')}</span>
                <span className={styles.readonlyValue}>{form.itemLowStockThreshold}</span>
              </div>
            ) : null}
            {showCatalogCost && form.costPerUnit ? (
              <div className={styles.field}>
                <span className={styles.label}>{t('cost_per_unit')}</span>
                <span className={styles.readonlyValue}>{form.costPerUnit}</span>
              </div>
            ) : null}
            {showCostOverride && form.costPerUnitOverride ? (
              <div className={styles.field}>
                <span className={styles.label}>{t('cost_per_unit_override')}</span>
                <span className={styles.readonlyValue}>{form.costPerUnitOverride}</span>
              </div>
            ) : null}
            {form.expectedJobs ? (
              <div className={styles.field}>
                <span className={styles.label}>{t('expected_jobs')}</span>
                <span className={styles.readonlyValue}>{form.expectedJobs}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <FontAwesomeIcon icon={faTriangleExclamation} className={styles.headerIcon} aria-hidden="true" />
        <span className={styles.headerTitle}>{t('stock_settings')}</span>
      </div>
      <div className={styles.cardBody}>

        {/* Row 1: Alert Below + Cost Per Unit */}
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="itemLowStockThreshold">{t('alert_below')}</label>
              <span className={styles.tipWrap}>
                <button
                  type="button"
                  className={styles.infoBtn}
                  onClick={(e) => toggleTip('alertBelow', e)}
                  aria-expanded={openTip === 'alertBelow'}
                  aria-label={t('more_info')}
                >
                  i
                </button>
                {openTip === 'alertBelow' && (
                  <div ref={tooltipRef} className={styles.tooltip} role="tooltip">
                    {t('alert_below_tip')}
                  </div>
                )}
              </span>
            </div>
            <input
              id="itemLowStockThreshold"
              name="itemLowStockThreshold"
              type="number"
              min="0"
              className={styles.input}
              placeholder="0"
              value={form.itemLowStockThreshold}
              onChange={onChange}
            />
          </div>

          {showCatalogCost && (
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="costPerUnit">{t('cost_per_unit')}</label>
              </div>
              <input
                id="costPerUnit"
                name="costPerUnit"
                type="number"
                min="0"
                step="0.01"
                className={styles.input}
                placeholder={t('cost_per_unit_placeholder')}
                value={form.costPerUnit}
                onChange={onChange}
              />
            </div>
          )}
        </div>

        {/* Row 2: Cost Override + Expected Jobs */}
        <div className={styles.fieldRow}>
          {showCostOverride && (
            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor="costPerUnitOverride">{t('cost_per_unit_override')}</label>
              </div>
              <input
                id="costPerUnitOverride"
                name="costPerUnitOverride"
                type="number"
                min="0"
                step="0.01"
                className={styles.input}
                placeholder="—"
                value={form.costPerUnitOverride}
                onChange={onChange}
              />
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="expectedJobs">{t('expected_jobs')}</label>
              <span className={styles.tipWrap}>
                <button
                  type="button"
                  className={styles.infoBtn}
                  onClick={(e) => toggleTip('expectedJobs', e)}
                  aria-expanded={openTip === 'expectedJobs'}
                  aria-label={t('more_info')}
                >
                  i
                </button>
                {openTip === 'expectedJobs' && (
                  <div ref={tooltipRef} className={styles.tooltip} role="tooltip">
                    {t('expected_jobs_tip')}
                  </div>
                )}
              </span>
            </div>
            <input
              id="expectedJobs"
              name="expectedJobs"
              type="number"
              min="0"
              step="any"
              className={styles.input}
              placeholder={t('expected_jobs_placeholder')}
              value={form.expectedJobs}
              onChange={onChange}
            />
          </div>
        </div>

        {/* Track Stock */}
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
              onChange={onChange}
              className={styles.switchInput}
            />
            <span className={styles.switchThumb} />
          </span>
        </label>

      </div>
    </div>
  )
}
