const PALETTES = [
  { background: '#ede9fe', color: '#6d28d9' },
  { background: '#d1fae5', color: '#065f46' },
  { background: '#fee2e2', color: '#b91c1c' },
  { background: '#dbeafe', color: '#1e40af' },
  { background: '#fef3c7', color: '#92400e' },
  { background: '#fce7f3', color: '#9d174d' },
]

export function getAvatarColors(email) {
  const hash = (email ?? '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTES[hash % PALETTES.length]
}

export function getInitials(email) {
  const local = (email ?? '').split('@')[0]
  const parts = local.split(/[._+\-]/).filter(Boolean)
  if (!parts.length) return '?'
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : local.slice(0, 2).toUpperCase()
}
