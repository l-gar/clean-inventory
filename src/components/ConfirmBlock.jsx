import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import styles from './ConfirmBlock.module.css'

export default function ConfirmBlock({ message, confirmLabel, cancelLabel, onConfirm, onCancel, busy, error }) {
  return (
    <div className={styles.root}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.btnConfirm}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy
            ? <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
            : confirmLabel}
        </button>
        <button
          type="button"
          className={styles.btnCancel}
          onClick={onCancel}
          disabled={busy}
        >
          {cancelLabel}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
