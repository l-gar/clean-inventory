import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileLines } from '@fortawesome/free-solid-svg-icons'
import styles from './NotesSection.module.css'

export default function NotesSection({ value, onChange, id = 'description', name = 'description' }) {
  const { t } = useTranslation()
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <FontAwesomeIcon icon={faFileLines} className={styles.headerIcon} aria-hidden="true" />
        <span className={styles.headerTitle}>{t('notes')}</span>
      </div>
      <div className={styles.cardBody}>
        <textarea
          id={id}
          name={name}
          className={styles.textarea}
          placeholder={t('description_placeholder')}
          rows={3}
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
