import { Cloud, CloudOff, LoaderCircle, LogOut, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { isCloudConfigured, listCloudProjects, signIn, signUp, storeSession, type CloudProject, type CloudSession } from '../lib/supabaseApi'

type CloudPanelProps = {
  open: boolean
  onClose: () => void
  session: CloudSession | null
  onSessionChange: (session: CloudSession | null) => void
  onLoadProject: (project: CloudProject) => void
}

export function CloudPanel({ open, onClose, session, onSessionChange, onLoadProject }: CloudPanelProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open || !session) return
    setBusy(true)
    listCloudProjects(session).then(setProjects).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false))
  }, [open, session])

  if (!open) return null
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'signin') {
        const next = await signIn(email, password); onSessionChange(next)
      } else {
        const response = await signUp(email, password)
        if (response.access_token) { storeSession(response); onSessionChange(response) }
        else setMessage('Account created. Confirm your email, then sign in.')
      }
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Authentication failed') }
    finally { setBusy(false) }
  }
  const logout = () => { storeSession(null); onSessionChange(null); setProjects([]) }

  return <div className="cloud-overlay" onMouseDown={onClose}><aside className="cloud-panel" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><Cloud size={18} /><span>VenueTwin Cloud</span></div><button onClick={onClose}><X /></button></header>
    {!isCloudConfigured ? <div className="cloud-empty"><CloudOff /><h2>Cloud mode is not connected</h2><p>The app is still saving safely in this browser. To enable accounts and cloud projects, add your free Supabase project values to <code>.env.local</code>.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase dashboard</a><small>No payment details are required by VenueTwin.</small></div>
      : session ? <div className="cloud-account"><div className="account-line"><div><small>SIGNED IN AS</small><strong>{session.user.email}</strong></div><button onClick={logout}><LogOut size={14} /> Sign out</button></div><div className="cloud-project-heading"><h2>Your cloud projects</h2><span>{projects.length}</span></div>{busy ? <LoaderCircle className="spin-icon" /> : projects.length ? <div className="cloud-project-list">{projects.map((project) => <button key={project.id} onClick={() => { onLoadProject(project); onClose() }}><div><strong>{project.name}</strong><span>Updated {new Date(project.updated_at).toLocaleDateString()}</span></div><b>Open</b></button>)}</div> : <div className="no-cloud-projects"><Cloud /><p>No cloud projects yet.</p><span>Close this panel and use “Save project” to upload the current venue.</span></div>}</div>
        : <div className="cloud-auth"><div className="auth-switch"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div><h2>{mode === 'signin' ? 'Continue your venue' : 'Create your cloud workspace'}</h2><p>Synchronise venue projects across devices while keeping the editor local-first.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <div className="auth-message">{message}</div>}<button className="button button-primary" disabled={busy}>{busy && <LoaderCircle className="spin-icon" />} {mode === 'signin' ? 'Sign in' : 'Create account'}</button></form></div>}
  </aside></div>
}
