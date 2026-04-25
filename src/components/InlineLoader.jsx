import styles from './InlineLoader.module.css'

export default function InlineLoader() {
  return (
    <div className={styles.bar}>
      <div className={styles.fill} />
    </div>
  )
}
