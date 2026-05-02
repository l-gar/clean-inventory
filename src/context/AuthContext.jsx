import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { GoogleOAuthProvider, googleLogout } from '@react-oauth/google'
import { useStore } from '../store'

const AuthContext = createContext(null)

const STORAGE_KEY = 'cleaninv_user'
const TOKEN_STORAGE_KEY = 'cleaninv_access_token'

// ── Helpers ──────────────────────────────────────────────────────────────────

// Reads and validates the cached user from localStorage.
// Returns null on any failure so callers never receive malformed data.
function readCachedUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Require at minimum an email and role — anything less is not usable.
    if (!parsed?.email || !parsed?.role) return null
    return parsed
  } catch {
    return null
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  // Lazy initializer: reads localStorage synchronously on the very first render
  // so the app can show the correct page immediately without an extra render or
  // a flash of the wrong state.
  //
  // User object shape: { email, role, orgId, orgName, sheetId, status, orgStatus }
  //   status    — the user's own row status from the users tab
  //   orgStatus — the org's status from the organizations tab
  //               (routing checks orgStatus, e.g. 'approved_no_sheet' → ConnectSheet)
  // Both fields arrive via { email, ...data } in login and are merged automatically
  // in background revalidation — no extra handling needed here.
  const [user, setUser] = useState(readCachedUser)
  const [accessToken, setAccessToken] = useState(
    () => localStorage.getItem(TOKEN_STORAGE_KEY) ?? null,
  )
  const [loading, setLoading] = useState(false)

  // Tracks whether the org has at least one location. Starts null (unknown)
  // and is resolved by App.jsx after login for org_owner and manager roles.
  // Not persisted — re-checked every session so deletions are caught.
  const [hasLocations, setHasLocations] = useState(null)

  // ── Persist user to localStorage ──────────────────────────────────────────
  // Runs after every user state change. A single effect covers login,
  // setUserRole, and updateUser — no need to call setItem in each function.
  // Skips writing when user is null (logout already calls removeItem).
  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    }
  }, [user])

  // Persist access token separately — cleared on logout via removeItem.
  useEffect(() => {
    if (accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, accessToken)
    }
  }, [accessToken])

  // ── Background revalidation on mount ──────────────────────────────────────
  // If a cached user was found, silently re-check with Apps Script to catch
  // status changes (e.g. pending → approved, new sheetId) without blocking
  // the UI. Reads directly from localStorage rather than closing over the
  // user state so this effect correctly has empty deps and runs once only.
  useEffect(() => {
    const cached = readCachedUser()
    if (!cached?.email) return

    const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL
    const url =
      `${appsScriptUrl}` +
      `?action=checkAuth` +
      `&email=${encodeURIComponent(cached.email)}`

    async function revalidate() {
      try {
        const res = await fetch(url)
        const text = await res.text()
        const data = JSON.parse(text)
        // console.log('[Auth] Background revalidation result:', data)
        // Merge fresh data — only update if we still have a user in context
        // (guards against a logout happening during the async call).
        setUser((prev) => (prev ? { ...prev, ...data } : null))
      } catch {
        // Revalidation failure is silent — network may be down or Apps Script
        // temporarily unavailable. Keep the cached session; do not log out.
        console.warn('[Auth] Background revalidation failed — keeping cached session')
      }
    }

    revalidate()
  }, []) // Mount-only: intentional. readCachedUser and setUser are both stable.

  // ── Login ─────────────────────────────────────────────────────────────────
  // Called after useGoogleLogin({ flow: 'implicit' }) succeeds.
  // tokenResponse contains access_token (and scope, expires_in, etc.) but
  // NOT a decoded email — we fetch that from the Google userinfo endpoint.
  // The persist effects above will write user + token to localStorage.
  const login = useCallback(async (tokenResponse) => {
    setLoading(true)
    try {
      // 1. Token response received from Google implicit flow
      // console.log('[Auth] 1. Google token response received:', tokenResponse)

      const token = tokenResponse.access_token
      setAccessToken(token)

      // 2. Fetch email from Google userinfo endpoint using the access token
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const userInfo = await userInfoRes.json()
      const email = userInfo.email

      // console.log('[Auth] 2. Email from userinfo endpoint:', email)
      // console.log('[Auth]    Full userinfo response:', userInfo)

      const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL
      const url =
        `${appsScriptUrl}` +
        `?action=checkAuth` +
        `&email=${encodeURIComponent(email)}`

      // 3. Full request being sent to Apps Script
      // console.log('[Auth] 3. Sending GET to Apps Script URL:', url)
      // console.log('[Auth]    VITE_APPS_SCRIPT_URL value:', appsScriptUrl)

      const res = await fetch(url)

      // 4. Raw response from Apps Script
      const text = await res.text()
      // console.log('[Auth] 4. Raw Apps Script response — status:', res.status, '| body:', text)

      let data
      try {
        data = JSON.parse(text)
      } catch {
        console.error('[Auth]    Response body is not valid JSON — cannot parse role')
        throw new Error('Apps Script response was not JSON')
      }

      // 5a. Full parsed response object — check role AND status before setUser
      // console.log('[Auth] 5a. Parsed Apps Script response object:', data)
      // console.log('[Auth] 5a.   role   →', data.role)
      // console.log('[Auth] 5a.   status →', data.status)

      const nextUser = { email, ...data }

      // 5b. Exact object being written to context (and to localStorage via effect)
      // console.log('[Auth] 5b. User object being stored in context:', nextUser)
      // console.log('[Auth] 5b.   role   →', nextUser.role)
      // console.log('[Auth] 5b.   status →', nextUser.status)

      setUser(nextUser)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    // Revoke the Google session in the browser (clears Google auth cookies).
    googleLogout()

    // Clear the persisted session and any old key names from earlier versions.
    // UI preferences (language, darkMode) are intentionally left intact.
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    localStorage.removeItem('authUser')
    localStorage.removeItem('userRole')
    localStorage.removeItem('orgId')

    setAccessToken(null)

    // Reset the locations check so it runs fresh on the next login.
    setHasLocations(null)

    // Clear all cached remote data and per-user localStorage preferences
    // (e.g. cleaninv_default_location_<email>). Read the cached user's email
    // before STORAGE_KEY is removed so the key is always scoped correctly.
    const cachedEmail = readCachedUser()?.email
    useStore.getState().clearStore(cachedEmail)

    // Clearing user triggers the routing guards in App.jsx which redirect
    // to /login automatically — no explicit navigate() call needed.
    setUser(null)
  }, [])

  // ── Partial updaters ──────────────────────────────────────────────────────
  // Both use the functional form of setUser so they work correctly without
  // closing over the current user value, and both trigger the persist effect.

  // Updates only the role field — used by RegisterOrg after a successful
  // registerOrg call so routing guards see 'pending' immediately.
  const setUserRole = useCallback((role) => {
    setUser((prev) => (prev ? { ...prev, role } : null))
  }, [])

  // General-purpose merge — used by ConnectSheet to write back
  // { status: 'active', sheetId } after a successful connectSheet call.
  const updateUser = useCallback((fields) => {
    setUser((prev) => (prev ? { ...prev, ...fields } : null))
  }, [])

  // ── Context value ─────────────────────────────────────────────────────────
  const value = useMemo(
    () => ({ user, accessToken, login, logout, loading, setUserRole, updateUser, hasLocations, setHasLocations }),
    [user, accessToken, login, logout, loading, setUserRole, updateUser, hasLocations, setHasLocations],
  )

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <AuthContext.Provider value={value}>
        {children}
      </AuthContext.Provider>
    </GoogleOAuthProvider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
