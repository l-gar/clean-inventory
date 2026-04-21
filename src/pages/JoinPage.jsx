import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleExclamation,
  faUserPlus,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { apiValidateInvite, apiJoinOrg } from '../store/api'
import LangToggle from '../components/LangToggle'
import styles from './JoinPage.module.css'

function mapError(err) {
  const msg = (err?.message ?? '').toLowerCase()
  if (msg.includes('expir'))   return 'join.error_expired'
  if (msg.includes('revok'))   return 'join.error_revoked'
  if (msg.includes('limit'))   return 'join.error_limit'
  if (msg.includes('already')) return 'join.error_already_member'
  return 'join.error_invalid'
}

export default function JoinPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const token      = searchParams.get('token') ?? ''
  const knownEmail = user?.email ?? ''

  const [email, setEmail]               = useState(knownEmail)
  const [emailSubmitted, setEmailSubmitted] = useState(!!knownEmail)
  const [emailError, setEmailError]     = useState('')

  const [validating, setValidating]     = useState(false)
  const [orgName, setOrgName]           = useState(null)
  const [validateError, setValidateError] = useState(null)

  const [joining, setJoining]           = useState(false)
  const [joinError, setJoinError]       = useState(null)

  // Validate as soon as we have token + email
  useEffect(() => {
    if (!token || !emailSubmitted || !email) return

    let cancelled = false
    setValidating(true)
    setValidateError(null)
    setOrgName(null)

    apiValidateInvite({ token, email })
      .then(data => { if (!cancelled) setOrgName(data.orgName) })
      .catch(err  => { if (!cancelled) setValidateError(t(mapError(err))) })
      .finally(()  => { if (!cancelled) setValidating(false) })

    return () => { cancelled = true }
  }, [token, email, emailSubmitted, t])

  function handleEmailSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setEmailError(t('join.email_required'))
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError(t('join.email_invalid'))
      return
    }
    setEmail(trimmed)
    setEmailSubmitted(true)
    setEmailError('')
  }

  async function handleJoin() {
    setJoining(true)
    setJoinError(null)
    try {
      await apiJoinOrg({ token, email })
      navigate('/', { replace: true })
    } catch (err) {
      setJoinError(t(mapError(err)))
    } finally {
      setJoining(false)
    }
  }

  // ── No token — dead link ────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className={styles.page}>
        <LangToggle />
        <div className={styles.card}>
          <div className={`${styles.iconWrap} ${styles.iconError}`}>
            <FontAwesomeIcon icon={faCircleExclamation} aria-hidden="true" />
          </div>
          <h1 className={styles.title}>{t('join.invalid_title')}</h1>
          <p className={styles.subtitle}>{t('join.invalid_body')}</p>
        </div>
      </div>
    )
  }

  // ── Active invite flow ──────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <LangToggle />
      <div className={styles.card}>

        <div className={`${styles.iconWrap} ${styles.iconInvite}`}>
          <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
        </div>
        <h1 className={styles.title}>{t('join.title')}</h1>

        {/* Step 1 — collect email if not known from auth context */}
        {!emailSubmitted && (
          <form className={styles.form} onSubmit={handleEmailSubmit}>
            <p className={styles.subtitle}>{t('join.email_prompt')}</p>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="joinEmail">
                {t('join.email_label')}
              </label>
              <input
                id="joinEmail"
                type="email"
                className={`${styles.input}${emailError ? ` ${styles.inputError}` : ''}`}
                value={email}
                autoFocus
                autoComplete="email"
                placeholder={t('join.email_placeholder')}
                onChange={e => { setEmail(e.target.value); setEmailError('') }}
              />
              {emailError && <p className={styles.fieldError}>{emailError}</p>}
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={!email.trim()}>
              {t('join.continue')}
            </button>
          </form>
        )}

        {/* Step 2 — validating */}
        {emailSubmitted && validating && (
          <div className={styles.spinnerState}>
            <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
            <p>{t('join.validating')}</p>
          </div>
        )}

        {/* Step 2 error — validation failed */}
        {emailSubmitted && !validating && validateError && (
          <div className={styles.errorState}>
            <p className={styles.errorMsg}>{validateError}</p>
            {!knownEmail && (
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => { setEmailSubmitted(false); setValidateError(null) }}
              >
                {t('join.try_different_email')}
              </button>
            )}
          </div>
        )}

        {/* Step 3 — valid invite: show org + confirm */}
        {emailSubmitted && !validating && orgName && (
          <div className={styles.confirmState}>
            <p className={styles.inviteLabel}>{t('join.you_are_invited_to')}</p>
            <p className={styles.orgName}>{orgName}</p>
            {joinError && <p className={styles.errorMsg}>{joinError}</p>}
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleJoin}
              disabled={joining}
            >
              {joining
                ? <><FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" /> {t('join.joining')}</>
                : t('join.confirm', { orgName })}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
