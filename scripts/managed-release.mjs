import { mkdir, readFile, readdir, copyFile, writeFile, rename } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'
import { build, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { parseProductionManifest, productionCameras } from '../src/utils/productionViewer.ts'
import { validateGlb } from '../src/utils/localGlb.ts'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
const demo = process.argv.includes('--demo')
const venueIndex = process.argv.indexOf('--venues')
const sourceRoot = venueIndex >= 0 ? resolve(process.argv[venueIndex + 1] ?? '') : null
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env }
const publicEnv = demo ? { VITE_OPERATOR_NAME: 'VenueTwin demonstration', VITE_SUPPORT_EMAIL: 'demo@example.invalid', VITE_PRIVACY_URL: 'https://example.invalid/privacy', VITE_TERMS_URL: 'https://example.invalid/terms', VITE_MANAGED_DEMO: '1' } : { VITE_OPERATOR_NAME: env.VITE_OPERATOR_NAME, VITE_SUPPORT_EMAIL: env.VITE_SUPPORT_EMAIL, VITE_PRIVACY_URL: env.VITE_PRIVACY_URL, VITE_TERMS_URL: env.VITE_TERMS_URL, VITE_MANAGED_DEMO: '0' }
if (!demo) {
  if (!publicEnv.VITE_OPERATOR_NAME?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publicEnv.VITE_SUPPORT_EMAIL ?? '') || /example\.|replace|your_/i.test(publicEnv.VITE_SUPPORT_EMAIL)) throw new Error('Configure real VITE_OPERATOR_NAME and VITE_SUPPORT_EMAIL for release.')
  for (const key of ['VITE_PRIVACY_URL', 'VITE_TERMS_URL']) { const url = new URL(publicEnv[key] ?? ''); if (url.protocol !== 'https:' || url.username || url.password || /example\.|localhost|your_domain/i.test(url.host)) throw new Error(`Configure a real HTTPS ${key}.`) }
  if (!sourceRoot) throw new Error('Supply --venues with reviewed public packages. No live build was produced.')
}
const packages = []
if (demo) {
  packages.push({ dir: resolve('tests/fixtures/production'), destination: 'demo/v1', expectedQuality: 'demonstration' })
  packages.push({ dir: resolve('venue-data/national-theatre-prague/public-study'), destination: 'prague-national-theatre-study/v1', expectedQuality: 'study' })
}
else {
  for (const slug of await readdir(sourceRoot, { withFileTypes: true })) {
    if (!slug.isDirectory() || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug.name)) throw new Error('Venue folders must be simple lowercase slugs.')
    for (const version of await readdir(join(sourceRoot, slug.name), { withFileTypes: true })) {
      if (!version.isDirectory() || !/^v[1-9][0-9]*$/.test(version.name)) throw new Error('Use versioned venue directories such as theatre/v1.')
      packages.push({ dir: join(sourceRoot, slug.name, version.name), destination: `${slug.name}/${version.name}` })
    }
  }
  if (!packages.length) throw new Error('No reviewed customer packages supplied.')
}
for (const item of packages) {
  const names = await readdir(item.dir, { withFileTypes: true })
  if (names.length !== 2 || names.some(x => !x.isFile() || !['venue.json', 'venue.glb'].includes(x.name))) throw new Error('Only venue.json and venue.glb may enter the public release.')
  const manifest = parseProductionManifest(JSON.parse(await readFile(join(item.dir, 'venue.json'), 'utf8')))
  if (!demo && item.destination.split('/')[1] !== `v${manifest.revision}`) throw new Error('Directory version must match venue revision.')
  const allowed = ['format', 'version', 'venue_id', 'revision', 'name', 'quality', 'notice', 'model', 'levels', 'seats', 'target']
  if (Object.keys(manifest).length !== allowed.length || allowed.some(k => !Object.hasOwn(manifest, k)) || manifest.format !== 'venuetwin-customer' || manifest.version !== 2 || manifest.model?.file !== 'venue.glb' || (demo ? manifest.quality !== item.expectedQuality : manifest.quality !== 'reviewed')) throw new Error('Only expected, minimal customer manifests can enter a release.')
  for (const level of manifest.levels) if (Object.keys(level).sort().join(',') !== 'id,name') throw new Error('Private level metadata is forbidden.')
  for (const seat of manifest.seats) if (Object.keys(seat).sort().join(',') !== 'eye,id,label,level_id,position,row,vertical_fov_deg,yaw') throw new Error('Private seat metadata is forbidden.')
  const bytes = await readFile(join(item.dir, 'venue.glb'))
  if (bytes.length > 25 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== manifest.model.sha256) throw new Error('Customer model integrity check failed.')
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  validateGlb(buffer)
  const loaded = await new GLTFLoader().parseAsync(buffer, '')
  productionCameras(loaded.scene, manifest)
  item.hash = manifest.model.sha256
}
await build({ configFile: false, publicDir: false, plugins: [react()], define: Object.fromEntries(Object.entries(publicEnv).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])), build: { outDir: 'dist-managed', target: 'es2022', sourcemap: false, rolldownOptions: { input: 'managed.html' } } })
await rename('dist-managed/managed.html', 'dist-managed/index.html')
for (const item of packages) { const target = join('dist-managed/venues', item.destination); await mkdir(target, { recursive: true }); for (const name of ['venue.json', 'venue.glb']) await copyFile(join(item.dir, name), join(target, name)) }
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'"
const apache = `Options -Indexes\nRewriteEngine On\nRewriteRule ^\\.well-known/ - [L]\nRewriteCond %{REQUEST_FILENAME} !-f\nRewriteCond %{REQUEST_FILENAME} !-d\nRewriteRule ^ index.html [L]\n<IfModule mod_headers.c>\nHeader always set Content-Security-Policy "${csp}"\nHeader always set X-Content-Type-Options "nosniff"\nHeader always set Referrer-Policy "no-referrer"\nHeader always set Permissions-Policy "camera=(), microphone=(), geolocation=()"\nHeader always set Cache-Control "no-cache"\n</IfModule>\n`
await writeFile('dist-managed/.htaccess', apache)
await writeFile('dist-managed/_headers', `/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cache-Control: no-cache\n`)
await writeFile('dist-managed/release.json', JSON.stringify({ format: 'venuetwin-managed-release', version: 1, status: demo ? 'demonstration-not-for-customers' : 'operator-configured-release-candidate', venues: packages.map(p => ({ path: `/venues/${p.destination}/venue.json`, model_sha256: p.hash })) }, null, 2))
console.log(`Managed ${demo ? 'DEMONSTRATION' : 'release candidate'} built in dist-managed. No upload or deployment performed.`)
