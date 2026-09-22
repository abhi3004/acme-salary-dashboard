import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchUsers, inviteUser } from '../api'
import { PERMISSIONS, type Permission } from '../types'

const label = (permission: string) => permission.split('.').map((part) => part[0]!.toUpperCase() + part.slice(1)).join(' · ')

export default function Users() {
  const client = useQueryClient()
  const users = useQuery({ queryKey: ['users'], queryFn: fetchUsers })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selected, setSelected] = useState<Permission[]>(['employee.read', 'salary.read'])
  const [inviteLink, setInviteLink] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const toggle = (permission: Permission) => setSelected((current) => current.includes(permission)
    ? current.filter((value) => value !== permission) : [...current, permission])
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError(''); setInviteLink('')
    try {
      const result = await inviteUser({ name, email, permissions: selected })
      setInviteLink(`${window.location.origin}${result.invitation.accept_url}`)
      setName(''); setEmail(''); setSelected(['employee.read', 'salary.read'])
      await client.invalidateQueries({ queryKey: ['users'] })
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to create invitation.') }
    finally { setBusy(false) }
  }
  return <section className="users-page">
    <div className="page-heading"><div><div className="eyebrow">ACCESS CONTROL</div><h1>Users</h1><p>Invite teammates and give them only the access they need.</p></div></div>
    <div className="users-grid">
      <form className="panel invite-card" onSubmit={submit}>
        <h2>Invite a user</h2>
        <label>Name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Work email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <fieldset><legend>Permissions</legend><div className="permission-checks">
          {PERMISSIONS.map((permission) => <label key={permission}><input type="checkbox"
            checked={selected.includes(permission)} onChange={() => toggle(permission)} /><span>{label(permission)}</span></label>)}
        </div></fieldset>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button button-dark" disabled={busy || !selected.length}>{busy ? 'Creating…' : 'Create invitation'}</button>
        {inviteLink && <div className="invite-result" role="status"><strong>Invitation created</strong><p>Email delivery is out of scope for this demo. Share this one-time link:</p><input readOnly aria-label="Invitation link" value={inviteLink} onFocus={(e) => e.currentTarget.select()} /></div>}
      </form>
      <section className="panel user-list"><h2>Workspace users</h2>
        {users.isPending ? <p>Loading users…</p> : users.isError ? <p className="error">{users.error.message}</p> :
          users.data.users.map((user) => <article key={user.id}><div className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><span>{user.email}</span><small>{user.is_admin ? 'Administrator · All permissions' : `${user.permissions.length} permissions`}</small></div><span className={`status-pill ${user.status}`}>{user.status}</span></article>)}
      </section>
    </div>
  </section>
}
