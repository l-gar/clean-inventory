import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import styles from './SaveSuccessSplash.module.css'

export default function SaveSuccessSplash({ message, detail }) {
  return (
    <div className={styles.splash} role="status">
      <FontAwesomeIcon icon={faCircleCheck} className={styles.icon} aria-hidden="true" />
      <p className={styles.message}>{message}</p>
      {detail && <p className={styles.detail}>{detail}</p>}
    </div>
  )
}
