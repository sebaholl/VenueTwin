import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
const html = await readFile(new URL('../demo-host/index.html', import.meta.url))
createServer((request, response) => {
  if (request.url !== '/' && request.url !== '/index.html') { response.writeHead(404); response.end('Not found'); return }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(html)
}).listen(4174, '127.0.0.1', () => console.log('Separate demo website: http://127.0.0.1:4174'))
