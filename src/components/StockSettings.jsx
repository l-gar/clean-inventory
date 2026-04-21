import { useTranslation } from 'react-i18next'
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

  if (readOnly) {
    const hasAny =
      form.itemLowStockThreshold || form.costPerUnit ||
      form.costPerUnitOverride   || form.expectedJobs
    if (!hasAny) return null

    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('stock_settings')}</h2>
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
      </section>
    )
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('stock_settings')}</h2>

      <div className={styles.fieldRow}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="itemLowStockThreshold">
            {t('alert_below')}
          </label>
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
              onChange={onChange}
            />
          </div>
        )}

        {showCostOverride && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="costPerUnitOverride">
              {t('cost_per_unit_override')}
            </label>
            <input
              id="costPerUnitOverride"
              name="costPerUnitOverride"
              type="number"
              min="0"
              step="0.01"
              className={styles.input}
              placeholder={t('cost_per_unit_placeholder')}
              value={form.costPerUnitOverride}
              onChange={onChange}
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="expectedJobs">
            {t('expected_jobs')}
          </label>
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

      <label className={styles.trackStockLabel}>
        {t('track_stock')}
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
    </section>
  )
}
