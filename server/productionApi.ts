import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { HttpError, type ProductionSettings, productionIdentity } from './productionSecurity'
import { createBlenderJobs } from './blenderJobs'
import { generatePlanRequest, PilotError } from './studioPilot'
import { analyseReferences, parseAnalysisFiles } from './referenceAnalysis'
import { parseViewerConfig } from '../src/utils/customerViewer'
import { blenderBlueprint } from '../src/utils/blenderBridge'

type Jobs = ReturnType<typeof createBlenderJobs>
type Identity = ReturnType<typeof productionIdentity>
type Dependencies = { jobs: Jobs; identity: Identity; plan?: typeof generatePlanRequest; analyse?: typeof analyseReferences; now?: () => number }
async function body(request: IncomingMessage, limit: number) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new HttpError(415, 'Use application/json.')
  if (request.headers['content-encoding']) throw new HttpError(415, 'Compressed request bodies are not accepted.')
  if (Number(request.headers['content-length']) > limit) throw new HttpError(413, 'Request exceeds the upload limit.')
  const chunks: Buffer[] = []; let bytes = 0
  for await (const chunk of request) {
    bytes += Buffer.byteLength(chunk)
    if (bytes > limit) throw new HttpError(413, 'Request exceeds the upload limit.')
    chunks.push(Buffer.from(chunk))
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new HttpError(400, 'Use a valid JSON request.') }
}
export function createProductionApi(settings: ProductionSettings, dependencies: Dependencies) {
  const { jobs, identity } = dependencies, now = dependencies.now ?? Date.now
  const owners = new Map<string, { user: string; at: number }>()
  const counters = new Map<string, { since: number; count: number }>()
  let active = 0, working = false, startingBuild = false
  let globalWindow = { since: now(), count: 0 }
  const allowedRoutes = /^\/api\/(pilot\/(status|plan|analyse)|blender\/jobs(?:\/[a-f0-9-]{36}(?:\/model)?)?)$/
  return async (request: IncomingMessage, response: ServerResponse) => {
    const requestId = randomUUID(), start = now()
    const send = (code: number, data: unknown) => { if (!response.destroyed && !response.headersSent) { response.writeHead(code, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(data)) } }
    response.setHeader('X-Request-Id', requestId)
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    response.setHeader('Vary', 'Origin')
    const path = request.url?.split('?')[0] ?? ''
    const origin = request.headers.origin
    if (origin && !settings.origins.includes(origin)) return send(403, { error: 'Origin not allowed.', requestId })
    if (origin) response.setHeader('Access-Control-Allow-Origin', origin)
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      response.setHeader('Access-Control-Max-Age', '600')
      response.writeHead(204); response.end(); return
    }
    if (path === '/healthz' && request.method === 'GET') return send(200, { status: 'ok' })
    if (!allowedRoutes.test(path)) return send(404, { error: 'Unknown API route.', requestId })
    if (now() - globalWindow.since > 60000) globalWindow = { since: now(), count: 0 }
    if (++globalWindow.count > 600 || active >= 16) { response.setHeader('Retry-After', '60'); return send(429, { error: 'Server is busy. Retry shortly.', requestId }) }
    active++
    try {
      const user = await identity.authenticate(request.headers.authorization)
      await identity.access(user)
      for (const [key, counter] of counters) if (now() - counter.since > 60000) counters.delete(key)
      const counter = counters.get(user) ?? { since: now(), count: 0 }
      if (++counter.count > 120 || (!counters.has(user) && counters.size >= 1000)) throw new HttpError(429, 'Too many requests. Retry in one minute.')
      counters.set(user, counter)
      if (path === '/api/pilot/status' && request.method === 'GET') return send(200, { ready: true, mode: 'hosted', builds: true })
      if (path === '/api/pilot/plan' || path === '/api/pilot/analyse') {
        if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
        if (working) throw new HttpError(429, 'Pilot is working on another request. Retry shortly.')
        working = true
        const controller = new AbortController(), cancel = () => controller.abort()
        response.on('close', cancel)
        try {
          const input = await body(request, path.endsWith('analyse') ? 18 * 1024 * 1024 : 256000)
          // Validate before reserving any paid capacity. Reserves are not refunded: interrupted provider calls may still bill.
          try {
            if (path.endsWith('analyse')) parseAnalysisFiles(input?.files)
            else {
              parseViewerConfig(input?.config, true)
              if (typeof input.brief !== 'string' || !input.brief.trim() || input.brief.length > 12000 || typeof input.references !== 'string' || input.references.length > 80000 || typeof input.allowEstimates !== 'boolean' || (input.autoReview !== undefined && typeof input.autoReview !== 'boolean')) throw new Error('Invalid Pilot brief or options.')
            }
          } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid input.') }
          if (controller.signal.aborted) return
          await identity.reserve(user, 'ai', path.endsWith('plan') && input.autoReview === true ? 2 : 1)
          if (controller.signal.aborted) return
          const result = path.endsWith('analyse') ? await (dependencies.analyse ?? analyseReferences)(input, settings, fetch, controller.signal) : await (dependencies.plan ?? generatePlanRequest)(input, settings, controller.signal)
          send(200, result)
        } finally { working = false; response.off('close', cancel) }
        return
      }
      if (path === '/api/blender/jobs') {
        if (request.method !== 'POST') throw new HttpError(405, 'Method not allowed.')
        if (startingBuild || [...owners.keys()].some((id) => { try { return jobs.status(id).state === 'running' } catch { return false } })) throw new HttpError(429, 'A Blender build is running. Retry after it finishes.')
        startingBuild = true
        try {
          const input = await body(request, 256000)
          try { blenderBlueprint(parseViewerConfig(input?.config)) } catch (error) { throw new HttpError(422, error instanceof Error ? error.message : 'Invalid layout.') }
          await identity.reserve(user, 'build', 1)
          const job = await jobs.start(input.config)
          if (owners.size >= 4) owners.delete(owners.keys().next().value!)
          owners.set(job.id, { user, at: now() })
          send(202, job)
        } finally { startingBuild = false }
        return
      }
      const match = /^\/api\/blender\/jobs\/([a-f0-9-]{36})(\/model)?$/.exec(path)
      if (!match) throw new HttpError(404, 'Unknown API route.')
      const owner = owners.get(match[1])
      if (!owner || owner.user !== user || now() - owner.at > 60 * 60 * 1000) throw new HttpError(404, 'Build unavailable or expired. Start a new build.')
      if (request.method === 'GET' && match[2]) {
        const file = await jobs.model(match[1])
        response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': file.length, 'Content-Disposition': 'attachment; filename="venue.glb"' }); response.end(file); return
      }
      if (request.method === 'GET') return send(200, jobs.status(match[1]))
      if (request.method === 'DELETE' && !match[2]) return send(200, await jobs.cancel(match[1]))
      throw new HttpError(405, 'Method not allowed.')
    } catch (error) {
      const status = error instanceof HttpError || error instanceof PilotError ? error.status : 400
      if (status === 429) response.setHeader('Retry-After', '60')
      send(status, { error: error instanceof HttpError || error instanceof PilotError ? error.message : 'Request could not be completed. Retry or contact support with the request ID.', requestId })
    } finally {
      active--
      // No tokens, briefs, uploaded files or full URLs in logs.
      console.info(JSON.stringify({ requestId, route: path.replace(/[a-f0-9-]{36}/g, ':job'), status: response.statusCode, durationMs: now() - start }))
    }
  }
}
