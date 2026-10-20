import { afterEach, expect, it, vi } from 'vitest'
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.resetModules() })
it('does not resurrect a signed-out account when a delayed refresh completes', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://fixture.supabase.co'); vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-fixture')
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) })
  let complete!: (value: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { complete = resolve })))
  const api = await import('./supabaseApi')
  const session = { access_token: 'old', refresh_token: 'refresh', user: { id: 'one', email: 'one@example.com' } }
  api.storeSession(session)
  const pending = api.refreshSession(session)
  api.storeSession(null)
  complete(new Response(JSON.stringify({ ...session, access_token: 'new' })))
  await expect(pending).rejects.toThrow('session changed')
  expect(api.getStoredSession()).toBeNull()
})
