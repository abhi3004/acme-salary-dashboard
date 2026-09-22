import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { acceptInvitation } from '../api'

export default function AcceptInvitation() {
  const { token = '' } = useParams()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    try { await acceptInvitation(token, password); setDone(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to accept invitation.') }
  }
  return <main className="auth-shell"><form className="auth-card" onSubmit={submit}>
    <h1>{done ? 'Account ready' : 'Accept invitation'}</h1>
    {done ? <><p>Your password has been set. You can now sign in.</p><Link className="button button-dark" to="/">Go to sign in</Link></> : <>
      <p>Create a password of at least 12 characters.</p><label>Password<input type="password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}<button className="button button-dark">Activate account</button>
    </>}
  </form></main>
}
