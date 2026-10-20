import { ensureFreshSession, getStoredSession } from './supabaseApi'
const configured = (import.meta.env.VITE_PILOT_API_URL ?? '').replace(/\/$/, '')
const validOrigin = (() => { try { return new URL(configured).origin === configured && configured.startsWith('https://') } catch { return false } })()
export const hostedPilot = !import.meta.env.DEV && validOrigin
export const pilotAvailable = import.meta.env.DEV || hostedPilot
export const pilotFetch: typeof fetch = async (input, init = {}) => {
  if (typeof input !== 'string' || !input.startsWith('/api/')) throw new Error('Invalid Pilot API path.')
  if (import.meta.env.DEV) return fetch(input, init)
  if (!hostedPilot) throw new Error('The hosted Pilot API has not been configured.')
  const session = getStoredSession()
  if (!session) throw new Error('Sign in through VenueTwin Cloud to use Pilot and Blender.')
  const current = await ensureFreshSession(session)
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${current.access_token}`)
  return fetch(configured + input, { ...init, headers, credentials: 'omit', redirect: 'error' })
}
