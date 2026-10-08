import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { isLocalPilotRequest } from './studioPilot'
import { parseViewerConfig, geometrySignature } from '../src/utils/customerViewer'
import { blenderBlueprint } from '../src/utils/blenderBridge'
import { validateGlb } from '../src/utils/localGlb'

export type BuildStatus = { id: string; state: 'running' | 'completed' | 'failed' | 'cancelled'; stage: string; signature: string; error?: string }
type Job = { status: BuildStatus; directory: string; controller: AbortController; done: Promise<void> }
export type BlenderRunner = (input: string, output: string, signal: AbortSignal, progress: (stage: string) => void) => Promise<void>
export function blenderRunner(executable: string, script: string): BlenderRunner {
  return (input, output, signal, progress) => new Promise((resolveJob, reject) => {
    // No shell and no customer-supplied executable, script, or output path.
    const env = Object.fromEntries(['PATH', 'HOME', 'USERPROFILE', 'SystemRoot', 'TEMP', 'TMP', 'TMPDIR', 'LANG'].flatMap((key) => process.env[key] ? [[key, process.env[key]!]] : []))
    const child = spawn(executable, ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', script, '--', input, output], { env, stdio: ['ignore', 'pipe', 'pipe'] })
    let launchFailed = false
    let tail = '', errorTail = '', killTimer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => { child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 2000); killTimer.unref() }
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
    child.stdout.on('data', (chunk) => {
      tail = (tail + String(chunk)).slice(-4000)
      if (tail.includes('VT_PROGRESS:Finalizing model')) progress('Finalizing model')
      else if (tail.includes('VT_PROGRESS:Building architecture')) progress('Building architecture')
    })
    child.stderr.on('data', (chunk) => { errorTail = (errorTail + String(chunk)).slice(-2000) })
    const cleanup = () => { signal.removeEventListener('abort', cancel); clearTimeout(killTimer) }
    child.once('error', () => { launchFailed = true; cleanup(); reject(new Error('Could not launch Blender. Check BLENDER_PATH in .env.local and restart npm run dev.')) })
    child.once('close', (code) => {
      cleanup()
      if (launchFailed) return
      if (signal.aborted) reject(new Error('Build cancelled.'))
      else if (code !== 0) { console.error('VenueTwin Blender job failed:', errorTail || tail); reject(new Error('Blender could not build this layout. Check the dev-server terminal for details.')) }
      else resolveJob()
    })
  })
}
export function createBlenderJobs(run: BlenderRunner, timeoutMs = 10 * 60 * 1000) {
  const jobs = new Map<string, Job>()
  let starting = false, closed = false
  const get = (id: string) => { const job = jobs.get(id); if (!job) throw new Error('This build expired or the server restarted. Start a new build.'); return job }
  const remove = async (job: Job) => { await rm(job.directory, { recursive: true, force: true }) }
  return {
    async start(value: unknown) {
      if (closed) throw new Error('Build server is shutting down.')
      if (starting || [...jobs.values()].some((j) => j.status.state === 'running')) throw new Error('A Blender build is already running. Finish or cancel it first.')
      const config = parseViewerConfig(value)
      const blueprint = JSON.stringify(blenderBlueprint(config))
      if (Buffer.byteLength(blueprint) > 5 * 1024 * 1024) throw new Error('The generated blueprint exceeds 5 MB.')
      starting = true
      let directory = ''
      try {
        if (jobs.size >= 4) { const oldest = jobs.entries().next().value!; await remove(oldest[1]); jobs.delete(oldest[0]) }
        directory = await mkdtemp(join(tmpdir(), 'venuetwin-build-'))
        const input = join(directory, 'blueprint.json'), output = join(directory, 'venue.glb')
        await writeFile(input, blueprint)
        if (closed) throw new Error('Build server is shutting down.')
        const id = randomUUID(), controller = new AbortController()
        const job: Job = { directory, controller, status: { id, state: 'running', stage: 'Starting Blender', signature: geometrySignature(config) }, done: Promise.resolve() }
        jobs.set(id, job)
        let timedOut = false
        const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs); timer.unref()
        job.done = (async () => {
          try {
            await run(input, output, controller.signal, (stage) => { if (!controller.signal.aborted) job.status.stage = stage })
            if (controller.signal.aborted) throw new Error('Build cancelled.')
            job.status.stage = 'Checking model'
            const info = await stat(output)
            if (info.size > 25 * 1024 * 1024) throw new Error('Generated model exceeds the 25 MB viewer limit. Simplify the layout.')
            const file = await readFile(output)
            validateGlb(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer)
            if (controller.signal.aborted) throw new Error('Build cancelled.')
            job.status.state = 'completed'; job.status.stage = 'Model ready'
          } catch (error) {
            job.status.state = controller.signal.aborted && !timedOut ? 'cancelled' : 'failed'
            job.status.error = timedOut ? 'Blender exceeded the 10-minute build limit. Simplify the layout and retry.' : error instanceof Error ? error.message : 'Blender build failed.'
            job.status.stage = job.status.state === 'cancelled' ? 'Cancelled' : 'Build failed'
            await remove(job).catch(() => {})
          } finally { clearTimeout(timer) }
        })()
        return { ...job.status }
      } catch (error) { if (directory) await rm(directory, { recursive: true, force: true }); throw error }
      finally { starting = false }
    },
    status(id: string) { return { ...get(id).status } },
    async model(id: string) { const job = get(id); if (job.status.state !== 'completed') throw new Error('The model is not ready.'); return readFile(join(job.directory, 'venue.glb')) },
    async cancel(id: string) { const job = get(id); if (job.status.state === 'running') { job.controller.abort(); await job.done }; return { ...job.status } },
    async close() { closed = true; for (const job of jobs.values()) job.controller.abort(); await Promise.all([...jobs.values()].map(async (job) => { await job.done; await remove(job) })); jobs.clear() },
  }
}
export function blenderJobsPlugin(path: string): Plugin {
  return { name: 'venuetwin-local-blender', apply: 'serve', configureServer(server) {
    const executable = path || (process.platform === 'darwin' ? '/Applications/Blender.app/Contents/MacOS/Blender' : 'blender')
    const jobs = createBlenderJobs(blenderRunner(executable, resolve('scripts/blender/build_job.py')))
    server.httpServer?.once('close', () => { void jobs.close() })
    server.middlewares.use(async (request, response, next) => {
      const url = request.url?.split('?')[0] ?? ''
      if (!url.startsWith('/api/blender/')) return next()
      const send = (code: number, value: unknown) => { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)) }
      if (!isLocalPilotRequest(request)) return send(403, { error: 'Blender builds are available only on the local dev server.' })
      try {
        if (url === '/api/blender/jobs' && request.method === 'POST') {
          if (!request.headers['content-type']?.startsWith('application/json')) return send(415, { error: 'Use application/json.' })
          const chunks: Buffer[] = []; let size = 0
          for await (const chunk of request) { size += Buffer.byteLength(chunk); if (size > 256000) return send(413, { error: 'Project exceeds the build request limit.' }); chunks.push(Buffer.from(chunk)) }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          return send(202, await jobs.start(body.config))
        }
        const match = /^\/api\/blender\/jobs\/([a-f0-9-]{36})(\/model)?$/.exec(url)
        if (!match) return send(404, { error: 'Unknown build route.' })
        if (request.method === 'DELETE' && !match[2]) return send(200, await jobs.cancel(match[1]))
        if (request.method === 'GET' && !match[2]) return send(200, jobs.status(match[1]))
        if (request.method === 'GET' && match[2]) {
          const data = await jobs.model(match[1])
          response.writeHead(200, { 'Content-Type': 'model/gltf-binary', 'Content-Length': data.length, 'Cache-Control': 'no-store' }); response.end(data); return
        }
        send(405, { error: 'Method not allowed.' })
      } catch (error) { send(400, { error: error instanceof Error ? error.message : 'Build failed.' }) }
    })
  } }
}
