import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import styles from './EmptyState.module.css'

export default function EmptyState({ icon, title, body, hint, action, iconCircle = false, fill = false }) {
  const rootClass = [styles.root, fill ? styles.fill : ''].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      <div className={iconCircle ? styles.iconCircle : styles.iconWrap} aria-hidden="true">
        <FontAwesomeIcon icon={icon} aria-hidden="true" />
      </div>
      <p className={iconCircle ? styles.titleLarge : styles.title}>{title}</p>
      {body && <p className={styles.body}>{body}</p>}
      {hint && <span className={styles.hint}>{hint}</span>}
      {action && (
        action.to
          ? <Link to={action.to} className={styles.actionBtn}>{action.label}</Link>
          : <button type="button" className={styles.actionBtn} onClick={action.onClick}>{action.label}</button>
      )}
    </div>
  )
}
