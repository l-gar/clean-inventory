import styles from './ErrorState.module.css'

export default function ErrorState({ message, onRetry, retryLabel, variant = 'centered' }) {
  const isBanner = variant === 'banner'
  return (
    <div className={isBanner ? styles.banner : styles.centered}>
      <span className={styles.message}>{message}</span>
      {onRetry && retryLabel && (
        <button
          type="button"
          className={isBanner ? styles.retryBanner : styles.retryCentered}
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
