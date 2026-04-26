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
