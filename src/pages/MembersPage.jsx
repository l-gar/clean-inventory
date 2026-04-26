import { useState, useEffect } from 'react'
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
  faCheck,
  faPlus,
} from '@fortawesome/free-solid-svg-icons'
import { useAuth } from '../context/AuthContext'
import { useStore } from '../store'
import {
  apiGenerateInvite,
  apiRevokeInvite,
  apiRemoveMember,
  apiAssignLocation,
  apiRemoveLocationAssignment,
} from '../store/api'
import InlineLoader from '../components/InlineLoader'
import ErrorState from '../components/ErrorState'
import EmptyState from '../components/EmptyState'
import ConfirmBlock from '../components/ConfirmBlock'
import { formatDate } from '../utils/date'
import styles from './MembersPage.module.css'

const ROLE_KEYS = {
  org_owner:  'members.role_org_owner',
  manager:    'members.role_manager',
  org_member: 'members.role_org_member',
}

export default function MembersPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'org_owner'

  const fetchLocations   = useStore(s => s.fetchLocations)
  const locations        = useStore(s => s.locations)

  const members          = useStore(s => s.members)
  const membersLoading   = useStore(s => s.membersLoading)
  const membersError     = useStore(s => s.membersError)
  const fetchMembers     = useStore(s => s.fetchMembers)
  const invalidateMembers = useStore(s => s.invalidateMembers)

  const invites          = useStore(s => s.invites)
  const invitesLoading   = useStore(s => s.invitesLoading)
  const invitesError     = useStore(s => s.invitesError)
  const fetchInvites     = useStore(s => s.fetchInvites)
  const invalidateInvites = useStore(s => s.invalidateInvites)

  const [tab, setTab] = useState('team')

  // Location sheet
  const [locationTarget, setLocationTarget] = useState(null)
  const [busyLocIds, setBusyLocIds]         = useState(new Set())
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

  useEffect(() => {
    fetchMembers(user.email, user.orgId).catch(() => {})
    fetchInvites(user.email, user.orgId).catch(() => {})
    fetchLocations(user.email, user.orgId).catch(() => {})
  }, [fetchMembers, fetchInvites, fetchLocations, user.email, user.orgId])

  // ── Location sheet ──────────────────────────────────────────────────────────

  function openLocationSheet(member) {
    setLocationTarget(member)
    setLocationError(null)
  }

  function closeLocationSheet() {
    if (busyLocIds.size > 0) return
    setLocationTarget(null)
    setLocationError(null)
  }

  async function handleToggleLocation(locId, isAssigned) {
    setBusyLocIds(prev => new Set([...prev, locId]))
    setLocationError(null)
    try {
      if (isAssigned) {
        await apiRemoveLocationAssignment({ email: user.email, targetEmail: locationTarget.email, orgId: user.orgId, locationId: locId })
      } else {
        await apiAssignLocation({ email: user.email, targetEmail: locationTarget.email, orgId: user.orgId, locationId: locId })
      }
      invalidateMembers()
      const updated = await fetchMembers(user.email, user.orgId)
      const fresh = updated.find(m => m.email === locationTarget.email)
      if (fresh) setLocationTarget(fresh)
    } catch {
      setLocationError(t('members.assign_error'))
    } finally {
      setBusyLocIds(prev => { const s = new Set(prev); s.delete(locId); return s })
    }
  }

  // ── Remove member ───────────────────────────────────────────────────────────

  async function handleRemoveMember(targetEmail) {
    setRemoving(true)
    setRemoveError(null)
    try {
      await apiRemoveMember({ email: user.email, targetEmail, orgId: user.orgId })
      setConfirmRemove(null)
      invalidateMembers()
      await fetchMembers(user.email, user.orgId)
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
      invalidateInvites()
      await fetchInvites(user.email, user.orgId)
    } catch {
      setRevokeError(t('members.revoke_error'))
    } finally {
      setRevoking(false)
    }
  }

  // ── Generate invite ─────────────────────────────────────────────────────────

  async function handleGenerateInvite() {
    const roleToSend = isOwner ? inviteRole : 'org_member'
    console.log('[generateInvite] sending role:', roleToSend)
    setGenerating(true)
    setGenerateError(null)
    try {
      await apiGenerateInvite({
        email: user.email,
        orgId: user.orgId,
        role: roleToSend,
      })
      invalidateInvites()
      await fetchInvites(user.email, user.orgId)
    } catch (e) {
      console.error('generateInvite failed:', e)
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
            <InlineLoader />
          ) : membersError ? (
            <ErrorState
              message={membersError}
              onRetry={() => { invalidateMembers(); fetchMembers(user.email, user.orgId) }}
              retryLabel={t('members.retry')}
            />
          ) : members.length === 0 ? (
            <EmptyState icon={faUserGroup} title={t('members.empty_team')} />
          ) : (
            <ul className={styles.list}>
              {members.map(member => (
                <li key={member.email} className={styles.card}>
                  {confirmRemove === member.email ? (
                    <ConfirmBlock
                      message={t('members.remove_confirm', { email: member.email })}
                      confirmLabel={t('members.remove_confirm_yes')}
                      cancelLabel={t('members.remove_confirm_no')}
                      onConfirm={() => handleRemoveMember(member.email)}
                      onCancel={() => { setConfirmRemove(null); setRemoveError(null) }}
                      busy={removing}
                      error={removeError}
                    />
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
                                {t('members.joined', { date: formatDate(member.joinedDate, i18n.language) })}
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
              <div className={styles.roleField}>
                <span className={styles.roleLabel}>{t('members.invite_role_label')}</span>
                <div className={styles.roleToggle} role="group" aria-label={t('members.invite_role_label')}>
                  <button
                    type="button"
                    className={`${styles.roleToggleBtn} ${inviteRole === 'org_member' ? styles.roleToggleBtnActive : ''}`}
                    onClick={() => setInviteRole('org_member')}
                  >
                    {t('members.invite_role_member')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.roleToggleBtn} ${inviteRole === 'manager' ? styles.roleToggleBtnActive : ''}`}
                    onClick={() => setInviteRole('manager')}
                  >
                    {t('members.invite_role_manager')}
                  </button>
                </div>
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
            <InlineLoader />
          ) : invitesError ? (
            <ErrorState
              message={invitesError}
              onRetry={() => { invalidateInvites(); fetchInvites(user.email, user.orgId) }}
              retryLabel={t('members.retry')}
            />
          ) : invites.length === 0 ? (
            <EmptyState
              icon={faLink}
              title={t('members.empty_invites')}
              hint={t('members.empty_invites_hint')}
            />
          ) : (
            <ul className={styles.list}>
              {invites.map(invite => (
                <li key={invite.token} className={styles.card}>
                  {confirmRevoke === invite.token ? (
                    <ConfirmBlock
                      message={t('members.revoke_confirm')}
                      confirmLabel={t('members.revoke_confirm_yes')}
                      cancelLabel={t('members.revoke_confirm_no')}
                      onConfirm={() => handleRevokeInvite(invite.token)}
                      onCancel={() => { setConfirmRevoke(null); setRevokeError(null) }}
                      busy={revoking}
                      error={revokeError}
                    />
                  ) : (
                    <>
                      <div className={styles.inviteInfo}>
                        <div className={styles.inviteTokenRow}>
                          <span className={styles.inviteToken}>{invite.token.slice(0, 10)}…</span>
                          <span className={`${styles.roleBadge} ${styles[`role_${invite.role ?? 'org_member'}`] ?? ''}`}>
                            {t(ROLE_KEYS[invite.role] ?? 'members.role_org_member')}
                          </span>
                        </div>
                        <div className={styles.inviteMeta}>
                          {invite.expiresDate && (
                            <span className={styles.inviteExpiry}>
                              {t('members.expires', { date: formatDate(invite.expiresDate, i18n.language) })}
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
          <ul className={styles.locationList}>
            {locations.map(loc => {
              const id       = loc.location_id ?? loc.locationId ?? ''
              const name     = loc.location_name ?? loc.locationName ?? id
              const assigned = locationTarget?.locationIds?.includes(id) ?? false
              const isBusy   = busyLocIds.has(id)
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`${styles.locationToggleRow} ${assigned ? styles.locationToggleRowOn : ''}`}
                    onClick={() => handleToggleLocation(id, assigned)}
                    disabled={isBusy}
                    aria-pressed={assigned}
                  >
                    <span className={styles.locationToggleName}>{name}</span>
                    <span className={styles.locationToggleIcon}>
                      {isBusy
                        ? <FontAwesomeIcon icon={faSpinner} spin aria-hidden="true" />
                        : assigned
                          ? <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
                          : <FontAwesomeIcon icon={faPlus} aria-hidden="true" />}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {locationError && <p className={styles.fieldError}>{locationError}</p>}
          <div className={styles.sheetButtons}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={closeLocationSheet}
              disabled={busyLocIds.size > 0}
            >
              {t('done')}
            </button>
          </div>
        </div>
      </div>

    </div>
  )
}
