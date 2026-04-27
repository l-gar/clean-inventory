import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useStore } from '../store'
import styles from './TransferSheet.module.css'

export default function TransferSheet({ item, destinations, dest, qty, maxQty, transferring, error, onDestChange, onQtyChange, onClose, onConfirm }) {
  const { t } = useTranslation()
  const getLocationName = useStore((s) => s.getLocationName)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      <div className={styles.modalBackdrop} onClick={onClose} />
      <div className={styles.transferSheet} role="dialog" aria-modal="true">
        <div className={styles.transferHeader}>
          <h2 className={styles.transferTitle}>{t('inventory.transferTitle')}</h2>
          <button type="button" className={styles.transferClose} onClick={onClose} aria-label={t('cancel')}>
            <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.transferBody}>
          <p className={styles.transferItemName}>{item.itemName}</p>
          <div className={styles.transferField}>
            <span className={styles.transferLabel}>{t('inventory.transferFrom')}</span>
            <div className={styles.transferReadOnly}>{getLocationName(item.location_id, item.location_name)}</div>
          </div>
          <div className={styles.transferField}>
            <label className={styles.transferLabel} htmlFor="xferDest">{t('inventory.transferTo')}</label>
            <select id="xferDest" className={styles.transferSelect} value={dest} onChange={(e) => onDestChange(e.target.value)}>
              {destinations.map((loc) => (
                <option key={loc.location_id} value={loc.location_id}>{loc.location_name}</option>
              ))}
            </select>
          </div>
          <div className={styles.transferField}>
            <label className={styles.transferLabel} htmlFor="xferQty">
              {t('inventory.transferQty')}
              {maxQty > 0 && <span className={styles.transferMax}> ({t('inventory.transferMax', { max: maxQty })})</span>}
            </label>
            <input
              id="xferQty"
              type="number"
              min="1"
              max={maxQty}
              className={styles.transferInput}
              value={qty}
              onChange={(e) => onQtyChange(e.target.value)}
            />
          </div>
          {error && <p className={styles.transferError}>{error}</p>}
        </div>
        <div className={styles.transferFooter}>
          <button type="button" className={styles.transferCancelBtn} onClick={onClose} disabled={transferring}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={styles.transferSubmitBtn}
            onClick={onConfirm}
            disabled={transferring || !dest || qty < 1 || qty > maxQty}
          >
            {transferring ? t('inventory.transferring') : t('inventory.transferConfirm')}
          </button>
        </div>
      </div>
    </>
  )
}
