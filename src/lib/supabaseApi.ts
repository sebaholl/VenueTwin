import type { VenueConfig } from '../types/venue'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '') ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
const sessionKey = 'venuetwin-cloud-session'

export const isCloudConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export type CloudUser = {
  id: string
  email: string
}

export type CloudSession = {
  access_token: string
  refresh_token: string
  expires_in?: number
  expires_at?: number
  user: CloudUser
}

export type CloudProject = {
  id: string
  name: string
  venue_data: VenueConfig
  updated_at: string
  share_enabled?: boolean
  share_token?: string | null
}

export type SharedProject = Pick<CloudProject, 'id' | 'name' | 'venue_data' | 'updated_at'>

type AuthResponse = CloudSession & { error_description?: string; msg?: string }

function baseHeaders() {
  return { apikey: supabaseAnonKey, 'Content-Type': 'application/json' }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error_description ?? body.msg ?? body.message ?? 'Cloud request failed')
  return body as T
}

export function getStoredSession(): CloudSession | null {
  if (!isCloudConfigured) return null
  try { return JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as CloudSession | null } catch { return null }
}

export function storeSession(session: CloudSession | null) {
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session))
  else localStorage.removeItem(sessionKey)
}

export async function refreshSession(session: CloudSession) {
  if (!isCloudConfigured) throw new Error('Supabase is not configured')
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: baseHeaders(), body: JSON.stringify({ refresh_token: session.refresh_token }),
  })
  const refreshed = await parseResponse<AuthResponse>(response)
  storeSession(refreshed)
  return refreshed
}

export async function ensureFreshSession(session: CloudSession) {
  const expiresSoon = session.expires_at ? session.expires_at <= Math.floor(Date.now() / 1000) + 90 : false
  return expiresSoon ? refreshSession(session) : session
}

export async function signIn(email: string, password: string) {
  if (!isCloudConfigured) throw new Error('Supabase is not configured')
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: baseHeaders(), body: JSON.stringify({ email, password }),
  })
  const session = await parseResponse<AuthResponse>(response)
  storeSession(session)
  return session
}

export async function signUp(email: string, password: string) {
  if (!isCloudConfigured) throw new Error('Supabase is not configured')
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST', headers: baseHeaders(), body: JSON.stringify({ email, password }),
  })
  return parseResponse<AuthResponse>(response)
}

function authenticatedHeaders(session: CloudSession, prefer?: string) {
  return { ...baseHeaders(), Authorization: `Bearer ${session.access_token}`, ...(prefer ? { Prefer: prefer } : {}) }
}

export async function saveCloudProject(session: CloudSession, project: { id: string; name: string; config: VenueConfig }) {
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?on_conflict=id`, {
    method: 'POST',
    headers: authenticatedHeaders(session, 'resolution=merge-duplicates,return=representation'),
    body: JSON.stringify({ id: project.id, owner_id: session.user.id, name: project.name, venue_data: project.config, updated_at: new Date().toISOString() }),
  })
  return parseResponse<CloudProject[]>(response)
}

export async function listCloudProjects(session: CloudSession) {
  const query = new URLSearchParams({ select: 'id,name,venue_data,updated_at,share_enabled,share_token', order: 'updated_at.desc' })
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?${query}`, { headers: authenticatedHeaders(session) })
  return parseResponse<CloudProject[]>(response)
}

export async function enableProjectShare(session: CloudSession, id: string) {
  const token = crypto.randomUUID()
  const query = new URLSearchParams({ id: `eq.${id}` })
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?${query}`, {
    method: 'PATCH',
    headers: authenticatedHeaders(session, 'return=representation'),
    body: JSON.stringify({ share_enabled: true, share_token: token, updated_at: new Date().toISOString() }),
  })
  const [project] = await parseResponse<CloudProject[]>(response)
  if (!project?.share_token) throw new Error('The public preview could not be created.')
  return project
}

export async function disableProjectShare(session: CloudSession, id: string) {
  const query = new URLSearchParams({ id: `eq.${id}` })
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?${query}`, {
    method: 'PATCH',
    headers: authenticatedHeaders(session, 'return=minimal'),
    body: JSON.stringify({ share_enabled: false, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) await parseResponse(response)
}

export async function getSharedProject(token: string) {
  if (!isCloudConfigured) throw new Error('VenueTwin Cloud is not configured.')
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_shared_project`, {
    method: 'POST', headers: baseHeaders(), body: JSON.stringify({ p_share_token: token }),
  })
  const [project] = await parseResponse<SharedProject[]>(response)
  if (!project) throw new Error('This preview is unavailable or sharing has been disabled.')
  return project
}

export async function renameCloudProject(session: CloudSession, id: string, name: string) {
  const query = new URLSearchParams({ id: `eq.${id}` })
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?${query}`, {
    method: 'PATCH',
    headers: authenticatedHeaders(session, 'return=representation'),
    body: JSON.stringify({ name, updated_at: new Date().toISOString() }),
  })
  return parseResponse<CloudProject[]>(response)
}

export async function deleteCloudProject(session: CloudSession, id: string) {
  const query = new URLSearchParams({ id: `eq.${id}` })
  const response = await fetch(`${supabaseUrl}/rest/v1/projects?${query}`, {
    method: 'DELETE', headers: authenticatedHeaders(session, 'return=minimal'),
  })
  if (!response.ok) await parseResponse(response)
}
