import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import LangToggle from '../components/LangToggle'
import styles from './Auth.module.css'

export default function PendingApproval() {
  const { t } = useTranslation()
  const { logout } = useAuth()

  return (
    <div className={styles.page}>
      <LangToggle />
      <div className={styles.card}>
        <div className={styles.icon}>
          <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" />
        </div>

        <h1 className={styles.title}>{t('pending_approval.title')}</h1>
        <p className={styles.subtitle}>{t('pending_approval.message')}</p>
        <p className={styles.emailNote}>{t('pending_approval.email_note')}</p>

        <button className={styles.btnSecondary} type="button" onClick={logout}>
          {t('pending_approval.sign_out')}
        </button>
      </div>
    </div>
  )
}
