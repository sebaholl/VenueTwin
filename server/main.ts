import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { blenderRunner, createBlenderJobs } from './blenderJobs'
import { productionSettings, productionIdentity } from './productionSecurity'
import { createProductionApi } from './productionApi'
const settings = productionSettings(process.env)
const executable = process.env.BLENDER_PATH || '/usr/bin/blender'
// Fail startup if Blender cannot launch. No keys are inherited by this check or the build subprocess.
execFileSync(executable, ['--background', '--factory-startup', '--disable-autoexec', '--version'], { env: { PATH: process.env.PATH, HOME: '/tmp' }, timeout: 15000, maxBuffer: 16384, stdio: 'pipe' })
const jobs = createBlenderJobs(blenderRunner(executable, resolve('scripts/blender/build_job.py')))
const api = createProductionApi(settings, { jobs, identity: productionIdentity(settings) })
const server = createServer((req, res) => { void api(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end() }) })
server.requestTimeout = 30000
server.headersTimeout = 10000
server.keepAliveTimeout = 5000
server.maxConnections = 100
server.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.info('VenueTwin production API listening'))
let closing = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => {
  if (closing) return; closing = true
  server.close()
  void jobs.close().finally(() => process.exit(0))
  setTimeout(() => process.exit(1), 15000).unref()
})
