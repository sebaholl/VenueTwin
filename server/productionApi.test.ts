import { afterEach, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { createProductionApi } from './productionApi'
import { HttpError, productionIdentity, productionSettings } from './productionSecurity'
import { createBlenderJobs } from './blenderJobs'
import { defaultVenue } from '../src/types/venue'
const settings = { supabaseUrl: 'https://example.supabase.co', serviceKey: 'SERVER_SECRET', apiKey: 'AI_SECRET', model: 'fixture', origins: ['https://venue.example'] }
const servers: Server[] = [], cleanups: (() => Promise<void>)[] = []
afterEach(async () => { await Promise.all(cleanups.splice(0).map((fn) => fn())); await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => { s.closeAllConnections(); s.close(() => r()) }))); vi.restoreAllMocks() })
function glb() {
  const json = JSON.stringify({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] }); const bytes = Buffer.from(json + ' '.repeat((4 - json.length % 4) % 4))
  const data = Buffer.alloc(bytes.length + 20); data.writeUInt32LE(0x46546c67, 0); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8); data.writeUInt32LE(bytes.length, 12); data.writeUInt32LE(0x4e4f534a, 16); bytes.copy(data, 20); return data
}
async function fixture() {
  vi.spyOn(console, 'info').mockImplementation(() => {})
  const jobs = createBlenderJobs(async (_input, output) => { await writeFile(output, glb()) })
  cleanups.push(() => jobs.close())
  const identity = { authenticate: vi.fn(async (h?: string) => { if (h !== 'Bearer alice' && h !== 'Bearer bob') throw new HttpError(401, 'Sign in.'); return h.slice(7) }), access: vi.fn(async () => {}), reserve: vi.fn(async () => {}) }
  const plan = vi.fn(async () => ({ plan: { summary: 'Validated', actions: [], questions: [], limitations: [], expectedSeatCount: null } }))
  const api = createProductionApi(settings, { jobs, identity, plan })
  const server = createServer((req, res) => { void api(req, res) }); servers.push(server)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const address = server.address() as { port: number }
  const request = (path: string, init: RequestInit = {}, who = 'alice') => fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, headers: { Origin: 'https://venue.example', Authorization: `Bearer ${who}`, 'Content-Type': 'application/json', ...init.headers } })
  return { request, jobs, identity, plan }
}
it('requires verified identities and access before any paid work', async () => {
  const { request, identity, plan } = await fixture()
  expect((await request('/api/pilot/status', {}, 'unknown')).status).toBe(401)
  identity.access.mockRejectedValue(new HttpError(403, 'Not invited.'))
  expect((await request('/api/pilot/plan', { method: 'POST', body: '{}' })).status).toBe(403)
  expect(identity.reserve).not.toHaveBeenCalled(); expect(plan).not.toHaveBeenCalled()
})
it('rejects disallowed origins and oversized uploads without provider calls', async () => {
  const { request, identity, plan } = await fixture()
  expect((await request('/api/pilot/status', { headers: { Origin: 'https://evil.example' } })).status).toBe(403)
  expect(identity.authenticate).not.toHaveBeenCalled()
  const response = await request('/api/pilot/plan', { method: 'POST', body: JSON.stringify({ big: 'x'.repeat(256001) }) })
  expect(response.status).toBe(413)
  expect(plan).not.toHaveBeenCalled(); expect(identity.reserve).not.toHaveBeenCalled()
})
it('reserves two AI units for auto-review, and fails closed on quota exhaustion', async () => {
  const { request, identity, plan } = await fixture()
  const input = { config: defaultVenue, brief: 'Preserve layout', references: '', allowEstimates: false, autoReview: true }
  expect((await request('/api/pilot/plan', { method: 'POST', body: JSON.stringify(input) })).status).toBe(200)
  expect(identity.reserve).toHaveBeenCalledWith('alice', 'ai', 2)
  identity.reserve.mockRejectedValue(new HttpError(429, 'Allowance reached.'))
  const rejected = await request('/api/pilot/plan', { method: 'POST', body: JSON.stringify(input) })
  expect(rejected.status).toBe(429); expect(rejected.headers.get('retry-after')).toBe('60')
  expect(plan).toHaveBeenCalledTimes(1)
})
it('isolates job status, download and cancellation across accounts, with real temporary files', async () => {
  const { request } = await fixture()
  const response = await request('/api/blender/jobs', { method: 'POST', body: JSON.stringify({ config: defaultVenue }) })
  expect(response.status).toBe(202)
  const { id } = await response.json()
  for (const [suffix, method] of [['', 'GET'], ['/model', 'GET'], ['', 'DELETE']]) expect((await request(`/api/blender/jobs/${id}${suffix}`, { method }, 'bob')).status).toBe(404)
  let status
  for (let i = 0; i < 20; i++) { status = await (await request(`/api/blender/jobs/${id}`)).json(); if (status.state === 'completed') break }
  expect(status.state).toBe('completed')
  const model = await request(`/api/blender/jobs/${id}/model`)
  expect(model.headers.get('content-type')).toBe('model/gltf-binary')
  expect(Buffer.from(await model.arrayBuffer())).toEqual(glb())
  expect(model.headers.get('cache-control')).toBe('no-store')
})
it('keeps unexpected internal errors and credentials out of responses', async () => {
  const { request, identity } = await fixture()
  identity.authenticate.mockRejectedValue(new Error('SERVER_SECRET AI_SECRET /private/server/path'))
  const response = await request('/api/pilot/status')
  const text = await response.text()
  expect(text).not.toMatch(/SERVER_SECRET|AI_SECRET|private\/server/)
  expect(response.headers.get('x-request-id')).toBeTruthy()
})
it('validates production settings and verifies tokens with the auth server', async () => {
  expect(() => productionSettings({})).toThrow('Configure')
  expect(() => productionSettings({ SUPABASE_URL: settings.supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: 'secret', OPENAI_API_KEY: 'secret', OPENAI_MODEL: 'model', ALLOWED_ORIGINS: '*' })).toThrow()
  const user = '11111111-1111-4111-8111-111111111111'
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: user, email_confirmed_at: '2026-10-19T00:00:00Z' })))
  expect(await productionIdentity(settings, fetcher).authenticate('Bearer signed.jwt.token')).toBe(user)
  expect(fetcher.mock.calls[0][0]).toBe(settings.supabaseUrl + '/auth/v1/user')
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer signed.jwt.token' })
  fetcher.mockResolvedValue(new Response('{}', { status: 401 }))
  await expect(productionIdentity(settings, fetcher).authenticate('Bearer forged.jwt.token')).rejects.toMatchObject({ status: 401 })
})
