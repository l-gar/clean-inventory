import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus, faLayerGroup } from '@fortawesome/free-solid-svg-icons'
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
  showModeToggle = true,
  correctionNote = '',
  onCorrectionNoteChange,
}) {
  const { t } = useTranslation()
  const deltaNum = Number(delta) || 0
  const newTotal = adjustMode
    ? Math.max(0, baseQty + deltaNum)
    : Math.max(0, Number(quantity ?? 0))

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <FontAwesomeIcon icon={faLayerGroup} className={styles.headerIcon} aria-hidden="true" />
          <span className={styles.headerTitle}>{t('quantity')}</span>
        </div>
        {showModeToggle && (
          <button
            type="button"
            className={`${styles.modeToggle} ${adjustMode ? styles.modeToggleActive : ''}`}
            onClick={onModeToggle}
          >
            {adjustMode ? t('set_exact') : t('adjust_qty')}
          </button>
        )}
      </div>
      <div className={styles.cardBody}>

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
          {onCorrectionNoteChange && delta !== '' && delta !== '0' && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="adjustNote">{t('note_label')}</label>
              <input
                id="adjustNote"
                type="text"
                className={styles.input}
                placeholder={t('note_placeholder')}
                value={correctionNote}
                onChange={(e) => onCorrectionNoteChange(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </>
      ) : (
        <>
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
          {showModeToggle && onCorrectionNoteChange && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="correctionNote">
                {t('correction_note_label')}
              </label>
              <input
                id="correctionNote"
                type="text"
                className={styles.input}
                placeholder={t('correction_note_placeholder')}
                value={correctionNote}
                onChange={(e) => onCorrectionNoteChange(e.target.value)}
                maxLength={200}
              />
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
