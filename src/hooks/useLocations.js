/**
 * useLocations — returns the locations accessible to the current user.
 *
 * Role behaviour:
 *   org_owner / manager  — reads from the Zustand store (fetches via
 *                          getLocations if the cache is empty or expired).
 *                          All components that call useLocations() on the
 *                          same page load share one API call and the same
 *                          array reference.
 *   org_member           — reads assignedLocations directly from AuthContext
 *                          (already present from checkAuth) — no API call.
 *
 * Returns: { locations, loading, error }
 *   locations — [{location_id, location_name}] (empty array before ready)
 *   loading   — true while the API call is in flight (or before first fetch)
 *   error     — true if the call failed
 */

import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import { normalizeLocation } from '../domain/normalize'

export function useLocations() {
  const { user } = useAuth()

  // Always call store selectors unconditionally (hooks rules).
  const locations        = useStore((s) => s.locations)
  const locationsLoading = useStore((s) => s.locationsLoading)
  const locationsError   = useStore((s) => s.locationsError)
  const locationsFetched = useStore((s) => s.locationsFetched)
  const fetchLocations   = useStore((s) => s.fetchLocations)

  const isMember = user?.role === 'org_member'

  useEffect(() => {
    if (!isMember && user?.email && user?.orgId) {
      // fetchLocations is a no-op when the cache is still warm.
      fetchLocations(user.email, user.orgId).catch(() => {
        // Error is already reflected via locationsError in the store.
      })
    }
  }, [isMember, user?.email, user?.orgId, fetchLocations])

  // org_member: derive from context — no API call ever needed.
  if (isMember) {
    return {
      locations: (user?.assignedLocations ?? []).map(normalizeLocation),
      loading:   false,
      error:     false,
    }
  }

  // Before the first fetch resolves, show a loading state so components
  // don't flash an empty / "no locations" state for one render cycle.
  const loading = locationsLoading || (!locationsFetched && !locationsError)

  return { locations, loading, error: locationsError }
}
