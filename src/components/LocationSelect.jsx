/**
 * LocationSelect — a location dropdown that reads from the useLocations hook.
 *
 * Handles four rendering states automatically:
 *   loading           — disabled select showing "Loading locations…"
 *   error / empty     — disabled select showing "No locations found" + hint
 *   org_member (1 loc)— plain text span (no choice to make)
 *   normal            — a real <select> with location options
 *
 * Props mirror a standard <select> so it can drop in anywhere a select lives:
 *   value, onChange, id, name, required, className, style
 */

import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useLocations } from '../hooks/useLocations'
import styles from './LocationSelect.module.css'

export default function LocationSelect({
  value,
  onChange,
  id,
  name,
  required,
  className,         // applied to both the select and the plain-text span
  style,
  selectClassName,   // extra class for the select element only
}) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { locations, loading, error } = useLocations()

  const isMember = user?.role === 'org_member'

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <select
        id={id}
        className={`${className ?? ''} ${selectClassName ?? ''}`}
        style={style}
        disabled
      >
        <option>{t('location_select.loading')}</option>
      </select>
    )
  }

  // ── Empty / error ─────────────────────────────────────────────────────────
  if (error || locations.length === 0) {
    return (
      <div className={styles.emptyWrap}>
        <select
          id={id}
          className={`${className ?? ''} ${selectClassName ?? ''}`}
          style={style}
          disabled
        >
          <option>{t('location_select.empty')}</option>
        </select>
        <p className={styles.emptyHint}>{t('location_select.empty_hint')}</p>
      </div>
    )
  }

  // ── org_member with a single location — no choice to make ────────────────
  if (isMember && locations.length === 1) {
    return (
      <span
        className={`${styles.singleLocation} ${className ?? ''}`}
        style={style}
      >
        {locations[0].location_name}
      </span>
    )
  }

  // ── Normal select ─────────────────────────────────────────────────────────
  return (
    <select
      id={id}
      name={name}
      className={`${className ?? ''} ${selectClassName ?? ''}`}
      style={style}
      value={value}
      onChange={onChange}
      required={required}
    >
      <option value="">{t('location_select.placeholder')}</option>
      {locations.map((loc) => (
        <option key={loc.location_id} value={loc.location_id}>
          {loc.location_name}
        </option>
      ))}
    </select>
  )
}
