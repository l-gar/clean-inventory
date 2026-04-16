import { useTranslation } from 'react-i18next'
import styles from './LoadingScreen.module.css'

export default function LoadingScreen({ message }) {
  const { t } = useTranslation()

  return (
    <div className={styles.screen}>
      <div className={styles.icon} aria-hidden="true">
        <span className={styles.sqTl} />
        <span className={styles.sqTr} />
        <span className={styles.sqBl} />
        <span className={styles.sqBr} />
      </div>
      <p className={styles.message}>{message ?? t('loading.checking')}</p>
    </div>
  )
}
