import { Check, Cloud, CloudOff, Copy, LoaderCircle, LogOut, Pencil, Plus, Trash2, X } from 'lucide-react'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import {
  deleteCloudProject,
  ensureFreshSession,
  isCloudConfigured,
  listCloudProjects,
  renameCloudProject,
  saveCloudProject,
  signIn,
  signUp,
  storeSession,
  type CloudProject,
  type CloudSession,
} from '../lib/supabaseApi'

type CloudPanelProps = {
  open: boolean
  onClose: () => void
  session: CloudSession | null
  currentProjectId: string
  onSessionChange: (session: CloudSession | null) => void
  onLoadProject: (project: CloudProject) => void
  onNewProject: () => void
}

export function CloudPanel({ open, onClose, session, currentProjectId, onSessionChange, onLoadProject, onNewProject }: CloudPanelProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [projects, setProjects] = useState<CloudProject[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)

  const withSession = useCallback(async () => {
    if (!session) throw new Error('Sign in to manage cloud projects.')
    const next = await ensureFreshSession(session)
    if (next.access_token !== session.access_token) onSessionChange(next)
    return next
  }, [onSessionChange, session])

  const refreshProjects = useCallback(async () => {
    if (!session) return
    setBusy(true); setMessage('')
    try { setProjects(await listCloudProjects(await withSession())) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Projects could not be loaded.') }
    finally { setBusy(false) }
  }, [session, withSession])

  useEffect(() => { if (open && session) void refreshProjects() }, [open, session, refreshProjects])

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

  const duplicateProject = async (project: CloudProject) => {
    setBusy(true); setMessage('')
    try {
      const activeSession = await withSession()
      const [copy] = await saveCloudProject(activeSession, { id: crypto.randomUUID(), name: `${project.name} copy`, config: project.venue_data })
      if (copy) setProjects((items) => [copy, ...items])
      else await refreshProjects()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Project could not be duplicated.') }
    finally { setBusy(false) }
  }

  const saveName = async (project: CloudProject) => {
    const name = editingName.trim()
    if (!name || name === project.name) { setEditingId(null); return }
    setBusy(true); setMessage('')
    try {
      await renameCloudProject(await withSession(), project.id, name)
      setProjects((items) => items.map((item) => item.id === project.id ? { ...item, name, updated_at: new Date().toISOString() } : item))
      setEditingId(null)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Project could not be renamed.') }
    finally { setBusy(false) }
  }

  const removeProject = async (project: CloudProject) => {
    setBusy(true); setMessage('')
    try {
      await deleteCloudProject(await withSession(), project.id)
      setProjects((items) => items.filter((item) => item.id !== project.id))
      setConfirmingDeleteId(null)
      if (project.id === currentProjectId) onNewProject()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Project could not be deleted.') }
    finally { setBusy(false) }
  }

  const logout = () => { storeSession(null); onSessionChange(null); setProjects([]) }

  return <div className="cloud-overlay" onMouseDown={onClose}><aside className="cloud-panel" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><Cloud size={18} /><span>VenueTwin Cloud</span></div><button onClick={onClose} aria-label="Close cloud projects"><X /></button></header>
    {!isCloudConfigured ? <div className="cloud-empty"><CloudOff /><h2>Cloud mode is not connected</h2><p>The app is still saving safely in this browser. To enable accounts and cloud projects, add your free Supabase project values to <code>.env.local</code>.</p><a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Open Supabase dashboard</a><small>No payment details are required by VenueTwin.</small></div>
      : session ? <div className="cloud-account">
        <div className="account-line"><div><small>SIGNED IN AS</small><strong>{session.user.email}</strong></div><button onClick={logout}><LogOut size={14} /> Sign out</button></div>
        <button className="new-cloud-project" onClick={() => { onNewProject(); onClose() }}><Plus size={15} /> New project</button>
        <div className="cloud-project-heading"><h2>Your cloud projects</h2><span>{projects.length}</span></div>
        {message && <div className="auth-message cloud-message">{message}</div>}
        {busy && !projects.length ? <LoaderCircle className="spin-icon" /> : projects.length ? <div className="cloud-project-list">{projects.map((project) => <article key={project.id} className={project.id === currentProjectId ? 'current' : ''}>
          <button className="cloud-project-open" onClick={() => { onLoadProject(project); onClose() }}>
            <div>{editingId === project.id ? <input value={editingName} autoFocus maxLength={120} onClick={(event) => event.stopPropagation()} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void saveName(project) } if (event.key === 'Escape') setEditingId(null) }} /> : <strong>{project.name}</strong>}<span>Updated {new Date(project.updated_at).toLocaleDateString()}</span></div><b>{project.id === currentProjectId ? 'Current' : 'Open'}</b>
          </button>
          <div className="cloud-project-actions">
            {editingId === project.id ? <button onClick={() => void saveName(project)} title="Save name"><Check /></button> : <button onClick={() => { setEditingId(project.id); setEditingName(project.name); setConfirmingDeleteId(null) }} title="Rename project"><Pencil /></button>}
            <button onClick={() => void duplicateProject(project)} title="Duplicate project"><Copy /></button>
            <button className="danger" onClick={() => setConfirmingDeleteId(project.id)} title="Delete project"><Trash2 /></button>
          </div>
          {confirmingDeleteId === project.id && <div className="delete-confirm"><span>Delete “{project.name}” permanently?</span><button onClick={() => setConfirmingDeleteId(null)}>Cancel</button><button className="danger" onClick={() => void removeProject(project)}>Delete</button></div>}
        </article>)}</div> : <div className="no-cloud-projects"><Cloud /><p>No cloud projects yet.</p><span>Create a project or save the current venue to upload it.</span></div>}
      </div>
        : <div className="cloud-auth"><div className="auth-switch"><button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')}>Sign in</button><button className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Create account</button></div><h2>{mode === 'signin' ? 'Continue your venue' : 'Create your cloud workspace'}</h2><p>Synchronise venue projects across devices while keeping the editor local-first.</p><form onSubmit={submit}><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{message && <div className="auth-message">{message}</div>}<button className="button button-primary" disabled={busy}>{busy && <LoaderCircle className="spin-icon" />} {mode === 'signin' ? 'Sign in' : 'Create account'}</button></form></div>}
  </aside></div>
}
