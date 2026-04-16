import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { callAppsScript } from './utils/appsScript'
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'
import AddItem from './pages/AddItem'
import InventoryList from './pages/InventoryList'
import Alerts from './pages/Alerts'
import Settings from './pages/Settings'
import Login from './pages/Login'
import PendingApproval from './pages/PendingApproval'
import RegisterOrg from './pages/RegisterOrg'
import ConnectSheet from './pages/ConnectSheet'
import Locations from './pages/Locations'
import EditItem from './pages/EditItem'

function App() {
  const { user, loading, hasLocations, setHasLocations } = useAuth()
  const [checkingLocations, setCheckingLocations] = useState(false)

  // After login, org_owner and manager roles need at least one location before
  // they can use the main app. Check once per session (hasLocations === null).
  useEffect(() => {
    const needsCheck =
      user &&
      (user.role === 'org_owner' || user.role === 'manager') &&
      hasLocations === null

    if (!needsCheck) return

    setCheckingLocations(true)
    callAppsScript('getLocations', { email: user.email, orgId: user.orgId })
      .then((data) => {
        const locs = data.locations ?? []
        setHasLocations(locs.length > 0)
      })
      .catch(() => {
        // Network failure — default to false so they can add a location.
        // The Locations page will retry on its own load.
        setHasLocations(false)
      })
      .finally(() => {
        setCheckingLocations(false)
      })
  }, [user, hasLocations, setHasLocations])

  if (loading || checkingLocations) return <LoadingScreen />

  // True when an approved org_owner hasn't yet linked their Google Sheet.
  const needsSheet =
    user?.role === 'org_owner' && user?.orgStatus === 'approved_no_sheet'

  // True when an org_owner or manager has no locations set up yet.
  const needsLocations =
    (user?.role === 'org_owner' || user?.role === 'manager') &&
    hasLocations === false

  // Routing diagnostic — fires on every render so you can see exactly what
  // values the guards are evaluating at the moment routing runs.
  console.log('[App] Routing evaluation:')
  console.log('[App]   user object      →', user)
  console.log('[App]   user.role        →', user?.role)
  console.log('[App]   user.status      →', user?.status)
  console.log('[App]   user.orgStatus   →', user?.orgStatus)
  console.log('[App]   needsSheet       →', needsSheet)
  console.log('[App]   hasLocations     →', hasLocations)
  console.log('[App]   needsLocations   →', needsLocations)

  return (
    <Routes>
      {/*
        /login — redirect away based on the user's exact state.
        Role-aware redirect prevents loops: see routing comments in App history.
      */}
      <Route
        path="/login"
        element={
          !user                        ? <Login /> :
          user.role === 'pending'      ? <Navigate to="/pending" replace /> :
          user.role === 'new_user'     ? <Navigate to="/register-org" replace /> :
          needsSheet                   ? <Navigate to="/connect-sheet" replace /> :
          needsLocations               ? <Navigate to="/locations" replace /> :
                                         <Navigate to="/add" replace />
        }
      />

      {/* Pending approval */}
      <Route
        path="/pending"
        element={
          !user                        ? <Navigate to="/login" replace /> :
          user.role !== 'pending'      ? <Navigate to="/add" replace /> :
                                         <PendingApproval />
        }
      />

      {/* New user — register org */}
      <Route
        path="/register-org"
        element={
          !user                        ? <Navigate to="/login" replace /> :
          user.role === 'pending'      ? <Navigate to="/pending" replace /> :
          user.role !== 'new_user'     ? <Navigate to="/add" replace /> :
                                         <RegisterOrg />
        }
      />

      {/* Approved org_owner — connect Google Sheet */}
      <Route
        path="/connect-sheet"
        element={
          !user                        ? <Navigate to="/login" replace /> :
          !needsSheet                  ? <Navigate to="/add" replace /> :
                                         <ConnectSheet />
        }
      />

      {/*
        Locations gate — only present when the user has no locations yet.
        Rendered outside Layout so it shows its own standalone header with
        no bottom navigation (the user can't use the app yet).
        Once the first location is saved hasLocations flips to true, this
        route unmounts, and /locations is served by the Layout child below.
      */}
      {needsLocations && (
        <Route path="/locations" element={<Locations />} />
      )}

      {/*
        Main app — any authenticated user whose role is not a holding state
        reaches Layout. The needsSheet and needsLocations guards intercept
        users who have outstanding setup steps.
      */}
      <Route
        path="/"
        element={
          !user                        ? <Navigate to="/login" replace /> :
          user.role === 'pending'      ? <Navigate to="/pending" replace /> :
          user.role === 'new_user'     ? <Navigate to="/register-org" replace /> :
          needsSheet                   ? <Navigate to="/connect-sheet" replace /> :
          needsLocations               ? <Navigate to="/locations" replace /> :
                                         <Layout />
        }
      >
        <Route index element={<Navigate to={needsLocations ? '/locations' : '/add'} replace />} />
        <Route path="add" element={needsLocations ? <Navigate to="/locations" replace /> : <AddItem />} />
        <Route path="edit/:itemId" element={needsLocations ? <Navigate to="/locations" replace /> : <EditItem />} />
        <Route path="inventory" element={needsLocations ? <Navigate to="/locations" replace /> : <InventoryList />} />
        <Route path="alerts" element={needsLocations ? <Navigate to="/locations" replace /> : <Alerts />} />
        <Route path="settings" element={<Settings />} />

        {/*
          Locations management — accessible from Settings once the user has
          locations. Rendered inside Layout so it shares the header and
          bottom navigation like every other app page.
          org_member is redirected away — they don't manage locations.
        */}
        <Route
          path="locations"
          element={
            (user?.role !== 'org_owner' && user?.role !== 'manager')
              ? <Navigate to="/add" replace />
              : <Locations />
          }
        />
      </Route>
    </Routes>
  )
}

export default App
