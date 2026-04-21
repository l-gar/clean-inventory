# Members Page & Invite System — Build Context

## Auth
- Access user with `const { user } = useAuth()` from `'../context/AuthContext'`
- User fields: `email`, `role`, `orgId`, `orgName`, `sheetId`, `status`, `orgStatus`
- Role values: `'org_owner' | 'manager' | 'org_member' | 'pending' | 'new_user' | 'super_admin'`

## Routing (App.jsx)
- Protected routes live inside the Layout wrapper
- Pattern: `<Route path="members" element={<MembersPage />} />`
- Public routes live outside the Layout wrapper
- `JoinPage` at path `"join"` must be public (pre-auth)

## API layer (api.js)
- All calls go through `callAppsScript(action, params)`
- Always check `if (data.success === false) throw new Error(data.error ?? 'failed')`
- New functions needed: `apiGetActiveInvites`, `apiGenerateInvite`, `apiRevokeInvite`,
  `apiRemoveMember`, `apiAssignLocation`, `apiRemoveLocationAssignment`,
  `apiValidateInvite`, `apiJoinOrg`

## Backend (Google Apps Script — already deployed, do not generate Apps Script code)
- `getOrgMembers(email, orgId)` → `{ members: [{email, role, joinedDate}], memberCount, memberLimit }`
- `getActiveInvites(email, orgId)` → `{ invites: [{token, expiresDate, createdBy}] }`
- `generateInvite(email, orgId, role)` → `{ token, expiresDate, role }`
  - org_owner can generate 'org_member' or 'manager' invites
  - manager can only generate 'org_member' invites
- `revokeInvite(email, token)` → `{ success }`
- `removeMember(email, targetEmail, orgId)` → `{ success }`
- `getLocations(email, orgId)` → `{ locations: [{locationId, locationName}] }`
- `assignLocation(email, targetEmail, orgId, locationId)` → `{ success }`
- `removeLocationAssignment(email, targetEmail, orgId, locationId)` → `{ success }`
- `validateInvite(token, email)` → `{ orgId, orgName }` or error
- `joinOrg(token, email)` → `{ orgId, orgName }` or error

## Invite deep link format
- Construct as: `window.location.origin + '/join?token=' + token`
- Do not hardcode the domain

## MembersPage structure
- Route: `"members"` — org_owner only
- Two tabs: Team and Invites
- Team tab: member list with remove + location assign/unassign per member
- Invites tab: active invite list with revoke + generate new link

## JoinPage structure  
- Route: `"join"` — public, no auth required
- Reads `?token=` from URL
- If user has no email yet, show email input first
- Call validateInvite → show org name → confirm → joinOrg → redirect to "/"
- Error states: expired, revoked, member limit, already in org, invalid token

## Known backend limitations (do not design around these yet)
- Multiple active invite tokens can exist simultaneously
- 'used' column is never set — backend relies on revoked flag and member limit