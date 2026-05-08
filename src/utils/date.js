/**
 * Format a date string or value for display using the user's locale.
 * Returns the original value if unparseable, empty string if falsy.
 */
export function formatDate(value, language) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(language, { year: 'numeric', month: 'short', day: 'numeric' })
}

/** Returns a stable 'YYYY-MM-DD' key for grouping entries by calendar day. */
export function dayKey(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Human-readable day label: "Today", "Yesterday", or a short locale date. */
export function dayLabel(ts, t, language) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  if (dDay.getTime() === today.getTime()) return t('activity_log.date_group_today')
  if (dDay.getTime() === yesterday.getTime()) return t('activity_log.date_group_yesterday')
  return d.toLocaleDateString(language, { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Returns true if the given timestamp falls on today's calendar date. */
export function isToday(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return false
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dDay = new Date(d); dDay.setHours(0, 0, 0, 0)
  return dDay.getTime() === today.getTime()
}

/**
 * Groups an array of entries (each with a `timestamp` field) into day buckets.
 * Returns [{ key, label, entries }] in the original sort order.
 */
export function groupByDay(entries, t, language) {
  const groups = []
  let curKey = null, curGroup = null
  for (const e of entries) {
    const key = dayKey(e.timestamp)
    if (key !== curKey) {
      curKey = key
      curGroup = { key, label: dayLabel(e.timestamp, t, language), entries: [] }
      groups.push(curGroup)
    }
    curGroup.entries.push(e)
  }
  return groups
}
