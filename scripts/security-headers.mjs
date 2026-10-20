import { readFile, writeFile } from 'node:fs/promises'
import { loadEnv } from 'vite'
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const origin = (value) => { if (!value) return ''; const url = new URL(value); if (url.protocol !== 'https:' || url.origin !== value.replace(/\/$/, '')) throw new Error('Production public URLs must be exact HTTPS origins.'); return url.origin }
const api = origin(env.VITE_PILOT_API_URL), auth = origin(env.VITE_SUPABASE_URL)
if (api) {
  if (!auth || !env.VITE_SUPABASE_ANON_KEY || !env.VITE_OPERATOR_NAME?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_SUPPORT_EMAIL ?? '')) throw new Error('Hosted release requires Supabase, VITE_OPERATOR_NAME and VITE_SUPPORT_EMAIL.')
  for (const key of ['VITE_PRIVACY_URL', 'VITE_TERMS_URL']) if (!env[key] || new URL(env[key]).protocol !== 'https:') throw new Error(`Publish and configure ${key} before a hosted customer release.`)
}
const policy = `default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' blob: data:; connect-src 'self' blob: ${auth} ${api} https://cdn.jsdelivr.net https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests`
const original = await readFile('public/.htaccess', 'utf8')
await writeFile('dist/.htaccess', original + `\n# Generated for this build's API and authentication origins.\n<IfModule mod_headers.c>\n  Header always set Content-Security-Policy "${policy}"\n</IfModule>\n`)
console.info('Production browser security headers generated.')
