// Local release preview only. Serves the built files and the generated CSP.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
const root = resolve('dist-managed')
const port = Number(process.env.PORT ?? 4174)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number from 1 to 65535.')
const headers = (await readFile(resolve(root, '_headers'), 'utf8')).split('\n').filter(s => s.startsWith('  ')).map(s => { const i = s.indexOf(':'); return [s.slice(2, i), s.slice(i + 1).trim()] })
const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    let file = resolve(root, '.' + pathname)
    if ((file !== root && !file.startsWith(root + sep)) || pathname.split('/').some(x => x.startsWith('.'))) { res.writeHead(404); res.end(); return }
    try { if (!(await stat(file)).isFile()) file = resolve(root, 'index.html') } catch { if (pathname.startsWith('/venues/') || pathname.startsWith('/assets/')) { res.writeHead(404); res.end(); return } file = resolve(root, 'index.html') }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary' }
    const data = await readFile(file)
    res.writeHead(200, { ...Object.fromEntries(headers), 'Content-Type': types[extname(file)] ?? 'application/octet-stream', 'Content-Length': data.length })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch { res.writeHead(404); res.end() }
})
server.on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Try PORT=${port + 1} npm run demo:viewer.`)
  else console.error(error)
  process.exitCode = 1
})
server.listen(port, '127.0.0.1', () => console.log(`Managed release preview: http://127.0.0.1:${port}`))
