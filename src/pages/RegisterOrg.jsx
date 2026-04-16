import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { callAppsScript } from '../utils/appsScript'
import LangToggle from '../components/LangToggle'
import styles from './Auth.module.css'

export default function RegisterOrg() {
  const { t } = useTranslation()
  const { user, logout, setUserRole } = useAuth()
  const navigate = useNavigate()
  const [orgName, setOrgName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!orgName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const data = await callAppsScript('registerOrg', {
        email: user.email,
        orgName: orgName.trim(),
      })

      if (data.success === false) {
        setError(data.error ?? t('register_org.error_server'))
        return
      }

      // Update role in context immediately so routing guards reflect the
      // new state before the next checkAuth call on re-login.
      setUserRole('pending')
      navigate('/pending', { replace: true })
    } catch {
      setError(t('register_org.error_generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <LangToggle />
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg
            className={styles.logoIcon}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 3h7v7H3z" />
            <path d="M14 3h7v7h-7z" />
            <path d="M14 14h7v7h-7z" />
            <path d="M3 14h7v7H3z" />
          </svg>
          <span className={styles.logoText}>CleanInv</span>
        </div>

        <h1 className={styles.title}>{t('register_org.title')}</h1>
        <p className={styles.subtitle}>{t('register_org.subtitle')}</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="orgName">
              {t('register_org.org_name_label')}
            </label>
            <input
              id="orgName"
              className={styles.input}
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder={t('register_org.org_name_placeholder')}
              required
              autoFocus
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.btnPrimary}
            type="submit"
            disabled={submitting || !orgName.trim()}
          >
            {submitting && <span className={styles.spinner} aria-hidden="true" />}
            {submitting ? t('register_org.submitting') : t('register_org.submit')}
          </button>

          <button
            className={styles.btnSecondary}
            type="button"
            onClick={logout}
          >
            {t('pending_approval.sign_out')}
          </button>
        </form>
      </div>
    </div>
  )
}
