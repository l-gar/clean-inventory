import { useContext, useEffect } from 'react'
import { PullToRefreshContext } from '../context/PullToRefreshContext'

/** Register a refresh callback for the pull-to-refresh gesture on the page scroll container. */
export function usePullToRefresh(onRefresh) {
  const { register } = useContext(PullToRefreshContext)
  useEffect(() => {
    register(onRefresh)
    return () => register(null)
  }, [register, onRefresh])
}
