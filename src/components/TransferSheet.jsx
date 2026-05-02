import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faXmark } from '@fortawesome/free-solid-svg-icons'
import { useStore } from '../store'
import TransferPanel from './TransferPanel'
import styles from './TransferSheet.module.css'

export default function TransferSheet({ item, destinations, dest, qty, maxQty, transferring, error, onDestChange, onQtyChange, onClose, onConfirm }) {
  const { t } = useTranslation()
  const getLocationName = useStore((s) => s.getLocationName)
  const [note, setNote] = useState('')

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
          <TransferPanel
            destinations={destinations}
            dest={dest}
            onDestChange={onDestChange}
            qty={qty}
            onQtyChange={onQtyChange}
            maxQty={maxQty}
            note={note}
            onNoteChange={setNote}
            error={error}
            transferring={transferring}
            onCancel={onClose}
            onConfirm={onConfirm}
          />
        </div>
      </div>
    </>
  )
}
