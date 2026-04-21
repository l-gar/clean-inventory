import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faUserGroup,
  faUserPlus,
  faCircleUser,
  faLink,
  faTrashCan,
  faLocationDot,
  faSpinner,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import {
  apiGetOrgMembers,
  apiGetActiveInvites,
  apiGenerateInvite,
  apiRevokeInvite,
  apiRemoveMember,
  apiAssignLocation,
  apiRemoveLocationAssignment,
} from '../store/api'
import styles from './MembersPage.module.css'

const ROLE_KEYS = {
  org_owner:  'members.role_org_owner',
  manager:    'members.role_manager',
  org_member: 'members.role_org_member',
}

export default function MembersPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'org_owner'

  const fetchLocations = useStore(s => s.fetchLocations)

  const [tab, setTab] = useState('team')

  const [members, setMembers]             = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [membersError, setMembersError]   = useState(null)

  const [invites, setInvites]             = useState([])
  const [invitesLoading, setInvitesLoading] = useState(true)
  const [invitesError, setInvitesError]   = useState(null)

  const [locations, setLocations] = useState([])

  // Location sheet
  const [locationTarget, setLocationTarget] = useState(null)
  const [selectedLocId, setSelectedLocId]   = useState('')
  const [locationBusy, setLocationBusy]     = useState(false)
  const [locationError, setLocationError]   = useState(null)

  // Remove member
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [removing, setRemoving]           = useState(false)
  const [removeError, setRemoveError]     = useState(null)

  // Revoke invite
  const [confirmRevoke, setConfirmRevoke] = useState(null)
  const [revoking, setRevoking]           = useState(false)
  const [revokeError, setRevokeError]     = useState(null)

  // Generate invite
  const [inviteRole, setInviteRole]   = useState('org_member')
  const [generating, setGenerating]   = useState(false)
  const [generateError, setGenerateError] = useState(null)

  const [copiedToken, setCopiedToken] = useState(null)

  const loadMembers = useCallback(async () => {
    setMembersLoading(true)
    setMembersError(null)
    try {
      setMembers(await apiGetOrgMembers({ email: user.email, orgId: user.orgId }))
    } catch {
      setMembersError(t('members.error_load'))
    } finally {
      setMembersLoading(false)
    }
  }, [user.email, user.orgId, t])

  const loadInvites = useCallback(async () => {
    setInvitesLoading(true)
    setInvitesError(null)
    try {
      setInvites(await apiGetActiveInvites({ email: user.email, orgId: user.orgId }))
    } catch {
      setInvitesError(t('members.error_load_invites'))
    } finally {
      setInvitesLoading(false)
    }
  }, [user.email, user.orgId, t])

  useEffect(() => {
    loadMembers()
    loadInvites()
    fetchLocations(user.email, user.orgId)
      .then(locs => {
        setLocations(locs)
        const firstId = locs[0]?.location_id ?? locs[0]?.locationId ?? ''
        if (firstId) setSelectedLocId(firstId)
      })
      .catch(() => {})
  }, [loadMembers, loadInvites, fetchLocations, user.email, user.orgId])

  // ── Location sheet ──────────────────────────────────────────────────────────

  function openLocationSheet(member) {
    setLocationTarget(member)
    setLocationError(null)
    const firstId = locations[0]?.location_id ?? locations[0]?.locationId ?? ''
    if (firstId) setSelectedLocId(firstId)
  }

  function closeLocationSheet() {
    if (locationBusy) return
    setLocationTarget(null)
    setLocationError(null)
  }

  async function handleAssignLocation() {
    if (!locationTarget || !selectedLocId) return
    setLocationBusy(true)
    setLocationError(null)
    try {
      await apiAssignLocation({ email: user.email, targetEmail: locationTarget.email, orgId: user.orgId, locationId: selectedLocId })
      closeLocationSheet()
    } catch {
      setLocationError(t('members.assign_error'))
    } finally {
      setLocationBusy(false)
    }
  }

  async function handleRemoveLocation() {
    if (!locationTarget || !selectedLocId) return
    setLocationBusy(true)
    setLocationError(null)
    try {
      await apiRemoveLocationAssignment({ email: user.email, targetEmail: locationTarget.email, orgId: user.orgId, locationId: selectedLocId })
      closeLocationSheet()
    } catch {
      setLocationError(t('members.assign_error'))
    } finally {
      setLocationBusy(false)
    }
  }

  // ── Remove member ───────────────────────────────────────────────────────────

  async function handleRemoveMember(targetEmail) {
    setRemoving(true)
    setRemoveError(null)
    try {
      await apiRemoveMember({ email: user.email, targetEmail, orgId: user.orgId })
      setConfirmRemove(null)
      setMembers(prev => prev.filter(m => m.email !== targetEmail))
    } catch {
      setRemoveError(t('members.remove_error'))
    } finally {
      setRemoving(false)
    }
  }

  // ── Revoke invite ───────────────────────────────────────────────────────────

  async function handleRevokeInvite(token) {
    setRevoking(true)
    setRevokeError(null)
    try {
      await apiRevokeInvite({ email: user.email, token })
      setConfirmRevoke(null)
      setInvites(prev => prev.filter(i => i.token !== token))
    } catch {
      setRevokeError(t('members.revoke_error'))
    } finally {
      setRevoking(false)
    }
  }

  // ── Generate invite ─────────────────────────────────────────────────────────

  async function handleGenerateInvite() {
    setGenerating(true)
    setGenerateError(null)
    try {
      const data = await apiGenerateInvite({
        email: user.email,
        orgId: user.orgId,
        role: isOwner ? inviteRole : 'org_member',
      })
      setInvites(prev => [
        { token: data.token, expiresDate: data.expiresDate, role: data.role, createdBy: user.email },
        ...prev,
      ])
    } catch {
      setGenerateError(t('members.generate_error'))
    } finally {
      setGenerating(false)
    }
  }

  // ── Copy invite link ────────────────────────────────────────────────────────

  function copyInviteLink(token) {
    const base = window.location.href.split('#')[0]
    const link = `${base}#/join?token=${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(t => (t === token ? null : t)), 2000)
    })
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>

      <div className={styles.pageHeader}>
        <h1 className={styles.title}>{t('members.title')}</h1>
      </div>

      <div className={styles.tabBar} role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'team'}
          className={`${styles.tab} ${tab === 'team' ? styles.tabActive : ''}`}
          onClick={() => setTab('team')}
        >
          <FontAwesomeIcon icon={faUserGroup} aria-hidden="true" />
          {t('members.tab_team')}
          {members.length > 0 && (
            <span className={styles.tabBadge}>{members.length}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'invites'}
          className={`${styles.tab} ${tab === 'invites' ? styles.tabActive : ''}`}
          onClick={() => setTab('invites')}
        >
          <FontAwesomeIcon icon={faUserPlus} aria-hidden="true" />
          {t('members.tab_invites')}
          {invites.length > 0 && (
            <span className={styles.tabBadge}>{invites.length}</span>
          )}
        </button>
      </div>

      {/* ── Team tab ──────────────────────────────────────────────────────── */}
      {tab === 'team' && (
        <div className={styles.tabContent}>
          {membersLoading ? (
            <div className={styles.spinnerWrap}>
              <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
            </div>
          ) : membersError ? (
            <div className={styles.errorState}>
              <p>{membersError}</p>
              <button type="button" className={styles.retryBtn} onClick={loadMembers}>
                {t('members.retry')}
              </button>
            </div>
          ) : members.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faUserGroup} aria-hidden="true" />
              <p>{t('members.empty_team')}</p>
            </div>
          ) : (
            <ul className={styles.list}>
              {members.map(member => (
                <li key={member.email} className={styles.card}>
                  {confirmRemove === member.email ? (
                    <div className={styles.confirmBlock}>
                      <p className={styles.confirmMsg}>
                        {t('members.remove_confirm', { email: member.email })}
                      </p>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => handleRemoveMember(member.email)}
                          disabled={removing}
                        >
                          {removing
                            ? <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                            : t('members.remove_confirm_yes')}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondaryInline}
                          onClick={() => { setConfirmRemove(null); setRemoveError(null) }}
                          disabled={removing}
                        >
                          {t('members.remove_confirm_no')}
                        </button>
                      </div>
                      {removeError && <p className={styles.inlineError}>{removeError}</p>}
                    </div>
                  ) : (
                    <>
                      <div className={styles.memberLeft}>
                        <span className={styles.memberIcon}>
                          <FontAwesomeIcon icon={faCircleUser} aria-hidden="true" />
                        </span>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberEmail}>{member.email}</span>
                          <div className={styles.memberMeta}>
                            <span className={`${styles.roleBadge} ${styles[`role_${member.role}`] ?? ''}`}>
                              {t(ROLE_KEYS[member.role] ?? 'members.role_org_member')}
                            </span>
                            {member.joinedDate && (
                              <span className={styles.joinedDate}>
                                {t('members.joined', { date: member.joinedDate })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.memberActions}>
                        {locations.length > 0 && (
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => openLocationSheet(member)}
                            aria-label={t('members.assign_location')}
                            title={t('members.assign_location')}
                          >
                            <FontAwesomeIcon icon={faLocationDot} aria-hidden="true" />
                          </button>
                        )}
                        {isOwner && member.role !== 'org_owner' && (
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            onClick={() => { setConfirmRemove(member.email); setRemoveError(null) }}
                            aria-label={t('members.remove_member')}
                            title={t('members.remove_member')}
                          >
                            <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Invites tab ───────────────────────────────────────────────────── */}
      {tab === 'invites' && (
        <div className={styles.tabContent}>

          <div className={styles.generateSection}>
            <h2 className={styles.sectionLabel}>{t('members.new_invite')}</h2>
            {isOwner && (
              <div className={styles.roleRow}>
                <label className={styles.roleLabel} htmlFor="inviteRole">
                  {t('members.invite_role_label')}
                </label>
                <select
                  id="inviteRole"
                  className={styles.roleSelect}
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                >
                  <option value="org_member">{t('members.invite_role_member')}</option>
                  <option value="manager">{t('members.invite_role_manager')}</option>
                </select>
              </div>
            )}
            {generateError && <p className={styles.generateError}>{generateError}</p>}
            <button
              type="button"
              className={styles.generateBtn}
              onClick={handleGenerateInvite}
              disabled={generating}
            >
              {generating
                ? <><FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" /> {t('members.generating')}</>
                : <><FontAwesomeIcon icon={faLink} aria-hidden="true" /> {t('members.generate_invite')}</>}
            </button>
          </div>

          {invitesLoading ? (
            <div className={styles.spinnerWrap}>
              <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
            </div>
          ) : invitesError ? (
            <div className={styles.errorState}>
              <p>{invitesError}</p>
              <button type="button" className={styles.retryBtn} onClick={loadInvites}>
                {t('members.retry')}
              </button>
            </div>
          ) : invites.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faLink} aria-hidden="true" />
              <p>{t('members.empty_invites')}</p>
              <span className={styles.emptyHint}>{t('members.empty_invites_hint')}</span>
            </div>
          ) : (
            <ul className={styles.list}>
              {invites.map(invite => (
                <li key={invite.token} className={styles.card}>
                  {confirmRevoke === invite.token ? (
                    <div className={styles.confirmBlock}>
                      <p className={styles.confirmMsg}>{t('members.revoke_confirm')}</p>
                      <div className={styles.confirmActions}>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          onClick={() => handleRevokeInvite(invite.token)}
                          disabled={revoking}
                        >
                          {revoking
                            ? <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                            : t('members.revoke_confirm_yes')}
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondaryInline}
                          onClick={() => { setConfirmRevoke(null); setRevokeError(null) }}
                          disabled={revoking}
                        >
                          {t('members.revoke_confirm_no')}
                        </button>
                      </div>
                      {revokeError && <p className={styles.inlineError}>{revokeError}</p>}
                    </div>
                  ) : (
                    <>
                      <div className={styles.inviteInfo}>
                        <span className={styles.inviteToken}>{invite.token.slice(0, 10)}…</span>
                        <div className={styles.inviteMeta}>
                          {invite.expiresDate && (
                            <span className={styles.inviteExpiry}>
                              {t('members.expires', { date: invite.expiresDate })}
                            </span>
                          )}
                          {invite.createdBy && (
                            <span className={styles.inviteCreatedBy}>
                              {t('members.created_by', { email: invite.createdBy })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.inviteActions}>
                        <button
                          type="button"
                          className={`${styles.copyBtn} ${copiedToken === invite.token ? styles.copyBtnSuccess : ''}`}
                          onClick={() => copyInviteLink(invite.token)}
                          aria-label={t('members.copy_link')}
                        >
                          <FontAwesomeIcon icon={faLink} aria-hidden="true" />
                          <span>{copiedToken === invite.token ? t('members.copied') : t('members.copy_link')}</span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={() => { setConfirmRevoke(invite.token); setRevokeError(null) }}
                          aria-label={t('members.revoke')}
                          title={t('members.revoke')}
                        >
                          <FontAwesomeIcon icon={faTrashCan} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Location assignment sheet ──────────────────────────────────────── */}
      <div
        className={`${styles.backdrop} ${locationTarget ? styles.backdropVisible : ''}`}
        onClick={closeLocationSheet}
      >
        <div
          className={`${styles.sheet} ${locationTarget ? styles.sheetOpen : ''}`}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.sheetHandle} />
          <h2 className={styles.sheetTitle}>{t('members.assign_title')}</h2>
          {locationTarget && (
            <p className={styles.sheetSubtitle}>{locationTarget.email}</p>
          )}
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="assignLoc">
              {t('members.location_label')}
            </label>
            <select
              id="assignLoc"
              className={styles.fieldSelect}
              value={selectedLocId}
              onChange={e => setSelectedLocId(e.target.value)}
            >
              {locations.map(loc => {
                const id   = loc.location_id ?? loc.locationId ?? ''
                const name = loc.location_name ?? loc.locationName ?? id
                return <option key={id} value={id}>{name}</option>
              })}
            </select>
          </div>
          {locationError && <p className={styles.fieldError}>{locationError}</p>}
          <div className={styles.sheetButtons}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleAssignLocation}
              disabled={locationBusy || !selectedLocId}
            >
              {locationBusy ? t('saving') : t('members.assign_btn')}
            </button>
            <button
              type="button"
              className={styles.btnRemove}
              onClick={handleRemoveLocation}
              disabled={locationBusy || !selectedLocId}
            >
              {t('members.remove_from_location')}
            </button>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={closeLocationSheet}
              disabled={locationBusy}
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
