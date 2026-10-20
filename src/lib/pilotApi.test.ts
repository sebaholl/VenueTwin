import { afterEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ stored: vi.fn(), fresh: vi.fn() }))
vi.mock('./supabaseApi', () => ({ getStoredSession: auth.stored, ensureFreshSession: auth.fresh }))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks() })
it('sends refreshed credentials only to the configured HTTPS API with cookies and redirects disabled', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_PILOT_API_URL', 'https://api.venue.example')
  auth.stored.mockReturnValue({ access_token: 'old' }); auth.fresh.mockResolvedValue({ access_token: 'verified-fresh' })
  const fetcher = vi.fn().mockResolvedValue(new Response('{}')); vi.stubGlobal('fetch', fetcher)
  const { pilotFetch, hostedPilot } = await import('./pilotApi')
  expect(hostedPilot).toBe(true)
  await pilotFetch('/api/blender/jobs', { method: 'POST', body: '{}' })
  const [url, request] = fetcher.mock.calls[0]
  expect(url).toBe('https://api.venue.example/api/blender/jobs')
  expect(request.headers.get('Authorization')).toBe('Bearer verified-fresh')
  expect(request).toMatchObject({ credentials: 'omit', redirect: 'error' })
  await expect(pilotFetch('https://evil.example/steal')).rejects.toThrow('Invalid')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('does not send a hosted request without a signed-in session', async () => {
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_PILOT_API_URL', 'https://api.venue.example')
  auth.stored.mockReturnValue(null)
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
  const { pilotFetch } = await import('./pilotApi')
  await expect(pilotFetch('/api/pilot/status')).rejects.toThrow('Sign in')
  expect(fetcher).not.toHaveBeenCalled()
})
it('fails closed for an insecure or path-bearing API origin', async () => {
  for (const url of ['http://api.example', 'https://api.example/path', 'https://api.example?key=x']) {
    vi.resetModules(); vi.stubEnv('DEV', false); vi.stubEnv('VITE_PILOT_API_URL', url)
    const { pilotAvailable } = await import('./pilotApi')
    expect(pilotAvailable).toBe(false)
  }
})
