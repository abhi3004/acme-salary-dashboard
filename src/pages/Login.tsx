import { useState, type FormEvent } from 'react'
import { login } from '../api'

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('admin@acme.test')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await login(email, password); onSuccess() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  return <main className="auth-shell">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand auth-brand"><span className="brand-mark">A</span><span>acme<span className="brand-dot">.</span></span></div>
      <div><div className="eyebrow">SALARY MANAGEMENT</div><h1>Welcome back</h1><p>Sign in with your ACME administrator account.</p></div>
      <label>Work email<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button button-dark" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="auth-note">Accounts are created by an ACME administrator. Public sign-up is disabled.</p>
    </form>
  </main>
}
