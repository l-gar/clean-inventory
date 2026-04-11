import { useTranslation } from 'react-i18next'
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
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  low: {
    label: 'Low Stock',
    className: 'alertLow',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
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
