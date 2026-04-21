import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import styles from './StockAdjuster.module.css'

const UNITS = ['each', 'bottle', 'box', 'case', 'gallon', 'liter', 'kg', 'lb']

export default function StockAdjuster({
  baseQty,
  unit,
  adjustMode,
  delta,
  quantity,
  onModeToggle,
  onDeltaChange,
  onQuantityChange,
  onUnitChange,
  autoFocus = false,
}) {
  const { t } = useTranslation()
  const deltaNum = Number(delta) || 0
  const newTotal = adjustMode
    ? Math.max(0, baseQty + deltaNum)
    : Math.max(0, Number(quantity ?? 0))

  return (
    <section className={styles.section}>
      <div className={styles.qtyHeader}>
        <h2 className={styles.sectionTitle}>{t('quantity')}</h2>
        <button
          type="button"
          className={`${styles.modeToggle} ${adjustMode ? styles.modeToggleActive : ''}`}
          onClick={onModeToggle}
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
              <span className={styles.currentStockUnit}> {unit || 'ea'}</span>
            </span>
          </div>

          <div className={styles.adjustSection}>
            <label className={styles.label} htmlFor="delta">{t('add_qty_label')}</label>
            <div className={styles.adjustRow}>
              <button
                type="button"
                className={styles.stepper}
                onClick={() => onDeltaChange(String((Number(delta) || 0) - 1))}
                aria-label="-1"
              >
                <FontAwesomeIcon icon={faMinus} aria-hidden="true" />
              </button>
              <input
                id="delta"
                type="number"
                className={`${styles.input} ${styles.deltaInput}`}
                value={delta}
                onChange={(e) => onDeltaChange(e.target.value)}
                placeholder="0"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus={autoFocus || undefined}
              />
              <button
                type="button"
                className={styles.stepper}
                onClick={() => onDeltaChange(String((Number(delta) || 0) + 1))}
                aria-label="+1"
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
              </button>
            </div>

            {delta !== '' && delta !== '0' && (
              <div className={styles.newTotalPreview}>
                {t('new_total')}:{' '}
                <strong>{newTotal} {unit || 'ea'}</strong>
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
              value={quantity ?? ''}
              onChange={(e) => onQuantityChange(e.target.value)}
              required
            />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.label} htmlFor="unit">{t('unit')}</label>
            <select
              id="unit"
              name="unit"
              className={styles.select}
              value={unit ?? 'each'}
              onChange={(e) => onUnitChange(e.target.value)}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
      )}
    </section>
  )
}
