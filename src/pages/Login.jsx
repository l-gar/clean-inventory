import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGoogleLogin } from '@react-oauth/google'
import { useAuth } from '../context/AuthContext'
import LangToggle from '../components/LangToggle'
import styles from './Auth.module.css'

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

export default function Login() {
  const { t } = useTranslation()
  const { login, loading } = useAuth()
  const [error, setError] = useState(null)

  const handleSuccess = async (tokenResponse) => {
    setError(null)
    try {
      await login(tokenResponse)
    } catch {
      setError(t('login.error_generic'))
    }
  }

  const handleError = () => {
    setError(t('login.error_generic'))
  }

  const signIn = useGoogleLogin({
    flow: 'implicit',
    scope: SCOPES,
    onSuccess: handleSuccess,
    onError: handleError,
  })

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
          <span className={styles.logoText}>{t('login.app_name')}</span>
        </div>

        <h1 className={styles.title}>{t('login.sign_in_prompt')}</h1>
        <p className={styles.subtitle}>{t('login.tagline')}</p>

        <button
          type="button"
          className={styles.googleSignInBtn}
          onClick={() => signIn()}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className={styles.spinner} />
              {t('login.signing_in')}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20" height="20">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              {t('login.sign_in_with_google')}
            </>
          )}
        </button>

        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  )
}
