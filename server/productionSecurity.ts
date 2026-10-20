export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export type ProductionSettings = { supabaseUrl: string; serviceKey: string; origins: string[]; apiKey: string; model: string }
export function productionSettings(env: NodeJS.ProcessEnv): ProductionSettings {
  const supabaseUrl = env.SUPABASE_URL?.replace(/\/$/, '') ?? ''
  const origins = (env.ALLOWED_ORIGINS ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseUrl) || !env.SUPABASE_SERVICE_ROLE_KEY || !env.OPENAI_API_KEY || !env.OPENAI_MODEL || !origins.length || origins.some((x) => { try { const u = new URL(x); return u.protocol !== 'https:' || u.origin !== x } catch { return true } })) throw new Error('Configure HTTPS Supabase URL, server credentials, OPENAI_MODEL and exact HTTPS ALLOWED_ORIGINS before starting production.')
  return { supabaseUrl, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, origins, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }
}
export function productionIdentity(settings: ProductionSettings, fetcher: typeof fetch = fetch) {
  const admin = { apikey: settings.serviceKey, Authorization: `Bearer ${settings.serviceKey}`, 'Content-Type': 'application/json' }
  async function request(path: string, init: RequestInit) {
    let response: Response
    try { response = await fetcher(settings.supabaseUrl + path, { ...init, signal: AbortSignal.timeout(10000), redirect: 'error' }) }
    catch { throw new HttpError(503, 'Account service is temporarily unavailable.') }
    return response
  }
  return {
    async authenticate(header?: string) {
      if (!header || header.length > 8192 || !/^Bearer [A-Za-z0-9._-]+$/.test(header)) throw new HttpError(401, 'Sign in to use Pilot and Blender.')
      const response = await request('/auth/v1/user', { headers: { apikey: settings.serviceKey, Authorization: header } })
      if (!response.ok) throw new HttpError(response.status >= 500 ? 503 : 401, 'Your session could not be verified. Sign in again.')
      const user = await response.json()
      if (!/^[a-f0-9-]{36}$/i.test(user.id) || !user.email_confirmed_at) throw new HttpError(403, 'Confirm your account email first.')
      return user.id as string
    },
    async access(user: string) {
      const response = await request(`/rest/v1/pilot_access?user_id=eq.${encodeURIComponent(user)}&select=enabled,expires_at`, { headers: admin })
      if (!response.ok) throw new HttpError(503, 'Pilot access service is unavailable.')
      const [access] = await response.json()
      if (!access?.enabled || (access.expires_at && Date.parse(access.expires_at) <= Date.now())) throw new HttpError(403, 'Pilot access has not been enabled for this account. Contact the venue operator.')
    },
    async reserve(user: string, kind: 'ai' | 'build', units: number) {
      const response = await request('/rest/v1/rpc/reserve_pilot_usage', { method: 'POST', headers: admin, body: JSON.stringify({ p_user: user, p_kind: kind, p_units: units }) })
      if (!response.ok) throw new HttpError(503, 'Usage limits could not be verified. No work was started.')
      if (await response.json() !== true) throw new HttpError(429, 'Pilot is paused or the daily usage allowance has been reached. Contact the venue operator.')
    },
  }
}
