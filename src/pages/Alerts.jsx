import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleExclamation,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import styles from './Alerts.module.css'

const ALERTS = [
  {
    id: 1,
    type: 'out',
    item: 'Disinfectant Spray',
    location: 'Office',
    current: 1,
    minimum: 4,
    unit: 'bottle',
    age: '2h ago',
  },
  {
    id: 2,
    type: 'low',
    item: 'Latex Gloves (M)',
    location: 'Truck 2',
    current: 2,
    minimum: 5,
    unit: 'box',
    age: '5h ago',
  },
  {
    id: 3,
    type: 'low',
    item: 'Trash Bags (HD)',
    location: 'Truck 1',
    current: 2,
    minimum: 3,
    unit: 'box',
    age: '1d ago',
  },
]

const TYPE_CONFIG = {
  out: {
    label: 'Out of Stock',
    className: 'alertOut',
    icon: <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" />,
  },
  low: {
    label: 'Low Stock',
    className: 'alertLow',
    icon: <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />,
  },
}

export default function Alerts() {
  const { t } = useTranslation()
  const outCount = ALERTS.filter((a) => a.type === 'out').length
  const lowCount = ALERTS.filter((a) => a.type === 'low').length

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('alerts.title')}</h1>
        <p className={styles.subtitle}>{t('alerts.subtitle')}</p>
      </div>

      <div className={styles.summary}>
        <div className={`${styles.summaryCard} ${styles.summaryOut}`}>
          <span className={styles.summaryNum}>{outCount}</span>
          <span className={styles.summaryLabel}>{t('alerts.outOfStock')}</span>
        </div>
        <div className={`${styles.summaryCard} ${styles.summaryLow}`}>
          <span className={styles.summaryNum}>{lowCount}</span>
          <span className={styles.summaryLabel}>{t('alerts.lowStock')}</span>
        </div>
      </div>

      <div className={styles.list}>
        {ALERTS.length === 0 ? (
          <div className={styles.empty}>
            <FontAwesomeIcon icon={faCircleCheck} aria-hidden="true" />
            <p>{t('alerts.emptyHint')}</p>
          </div>
        ) : (
          ALERTS.map((alert) => {
            const config = TYPE_CONFIG[alert.type]
            return (
              <div key={alert.id} className={`${styles.alertCard} ${styles[config.className]}`}>
                <div className={styles.alertIcon}>{config.icon}</div>
                <div className={styles.alertBody}>
                  <div className={styles.alertHeader}>
                    <span className={styles.alertItem}>{alert.item}</span>
                    <span className={styles.alertAge}>{alert.age}</span>
                  </div>
                  <div className={styles.alertDetail}>
                    <span className={styles.locationTag}>{alert.location}</span>
                    <span className={styles.alertQty}>
                      {alert.current} / {alert.minimum} {alert.unit}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{ width: `${Math.min((alert.current / alert.minimum) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                {/* <button className={styles.reorderBtn} type="button">
                  Reorder
                </button> */}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
