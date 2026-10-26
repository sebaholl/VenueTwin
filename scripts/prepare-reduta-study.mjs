// Offline conversion of the official Reduta technical SKP supplied by the operator.
// The generated GLB is deliberately local-only; it is not a reviewed customer venue.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
const { SkpFile, toGLB } = createRequire(import.meta.url)('openskp')

const path = process.argv[2]
const sourceUrl = 'https://www.ndbrno.cz/wp-content/uploads/2023/03/reduta_sketchup.zip'
const expectedZipHash = '0042b8a2d158b962adc3b458155d105864c693964bb4e6bc8b79cd08f8f1a7cd'
let bytes
if (path) bytes = await readFile(resolve(path))
else {
  const response = await fetch(sourceUrl)
  if (!response.ok) throw new Error(`Official Reduta download failed: HTTP ${response.status}`)
  const zip = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(zip).digest('hex') !== expectedZipHash) throw new Error('Official Reduta download changed; inspect the new source before importing it.')
  const temporary = await mkdtemp(join(tmpdir(), 'venuetwin-reduta-'))
  try {
    const archive = join(temporary, 'reduta.zip')
    await writeFile(archive, zip)
    bytes = execFileSync('unzip', ['-p', archive, 'reduta.skp'], { maxBuffer: 100_000_000 })
  } finally { await rm(temporary, { recursive: true, force: true }) }
}
if (bytes.length < 100_000 || bytes.length > 150_000_000) throw new Error('Unexpected SKP file size')
const temporary = await mkdtemp(join(tmpdir(), 'venuetwin-reduta-skp-'))
let scene
try {
  const input = join(temporary, 'reduta.skp')
  await writeFile(input, bytes)
  scene = SkpFile.open(input).buildScene()
} finally { await rm(temporary, { recursive: true, force: true }) }
if (!scene.glbPrimitives?.length) throw new Error('SKP has no renderable geometry')
const glb = Buffer.from(toGLB(scene))
const output = resolve('public/venues/reduta-study/v1')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'venue.glb'), glb)
const report = {
  format: 'venuetwin-local-technical-study', version: 1,
  venue: 'Reduta Theatre, Brno',
  status: 'Unverified technical shell; no seat-view or photorealism claim',
  source_url: sourceUrl,
  source_skp_sha256: createHash('sha256').update(bytes).digest('hex'),
  model_sha256: createHash('sha256').update(glb).digest('hex'),
  primitive_count: scene.glbPrimitives.length,
  missing: ['complete auditorium seat centres and numbering', 'seat-eye heights', 'calibrated comparison images', 'detailed materials and furnishings', 'visual verification and reuse permission'],
}
await writeFile(resolve(output, 'source-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`Local Reduta technical study ready: ${glb.length} GLB bytes, ${report.primitive_count} primitives. Open /reduta-preview.html in the local Vite app.`)
