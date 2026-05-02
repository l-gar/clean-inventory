import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons'
import styles from './TransferPanel.module.css'

export default function TransferPanel({
  destinations,
  dest, onDestChange,
  qty, onQtyChange,
  maxQty,
  note, onNoteChange,
  error,
  transferring,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="tpDest">
          {t('inventory.transferTo')}
        </label>
        <select id="tpDest" className={styles.select} value={dest} onChange={(e) => onDestChange(e.target.value)}>
          {destinations.map((l) => (
            <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="tpQty">
          {t('inventory.transferQty')}
          {maxQty > 0 && <span className={styles.maxHint}> ({t('inventory.transferMax', { max: maxQty })})</span>}
        </label>
        <div className={styles.stepperRow}>
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => onQtyChange(Math.max(1, qty - 1))}
            disabled={qty <= 1}
          >
            <FontAwesomeIcon icon={faMinus} aria-hidden="true" />
          </button>
          <input
            id="tpQty"
            type="number"
            className={styles.stepperInput}
            value={qty}
            min={1}
            max={maxQty || undefined}
            onChange={(e) => onQtyChange(Math.max(1, Number(e.target.value)))}
          />
          <button
            type="button"
            className={styles.stepperBtn}
            onClick={() => onQtyChange(Math.min(maxQty, qty + 1))}
            disabled={maxQty > 0 && qty >= maxQty}
          >
            <FontAwesomeIcon icon={faPlus} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="tpNote">{t('note_label')}</label>
        <input
          id="tpNote"
          type="text"
          className={styles.input}
          placeholder={t('note_placeholder')}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          maxLength={200}
        />
      </div>

      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.actionBar}>
        <button type="button" className={styles.btnSecondary} onClick={onCancel} disabled={transferring}>
          {t('cancel')}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={onConfirm}
          disabled={transferring || !dest || qty < 1 || (maxQty > 0 && qty > maxQty)}
        >
          {transferring ? t('inventory.transferring') : t('inventory.transferConfirm')}
        </button>
      </div>
    </>
  )
}
