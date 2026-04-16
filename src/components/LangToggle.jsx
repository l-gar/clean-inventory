import { useTranslation } from 'react-i18next'
import styles from './LangToggle.module.css'

const LANG_KEY = 'cleaninv_language'

export default function LangToggle() {
  const { i18n } = useTranslation()
  const isEn = i18n.language === 'en'
  const next = isEn ? 'es' : 'en'
  const label = isEn ? 'ES' : 'EN'

  function handleToggle() {
    i18n.changeLanguage(next)
    localStorage.setItem(LANG_KEY, next)
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={handleToggle}
      aria-label={isEn ? 'Switch to Spanish' : 'Cambiar a inglés'}
    >
      {label}
    </button>
  )
}
