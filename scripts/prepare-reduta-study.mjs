// Offline conversion of the official Reduta technical SKP supplied by the operator.
// The generated GLB is deliberately local-only; it is not a reviewed customer venue.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
const { SkpFile, toGLB } = createRequire(import.meta.url)('openskp')

const path = process.argv[2]
if (!path) throw new Error('Usage: node scripts/prepare-reduta-study.mjs /absolute/path/to/reduta.skp')
const input = resolve(path)
const bytes = await readFile(input)
if (bytes.length < 100_000 || bytes.length > 150_000_000) throw new Error('Unexpected SKP file size')
const scene = SkpFile.open(input).buildScene()
if (!scene.glbPrimitives?.length) throw new Error('SKP has no renderable geometry')
const glb = Buffer.from(toGLB(scene))
const output = resolve('public/venues/reduta-study/v1')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'venue.glb'), glb)
const report = {
  format: 'venuetwin-local-technical-study', version: 1,
  venue: 'Reduta Theatre, Brno',
  status: 'Unverified technical shell; no seat-view or photorealism claim',
  source_url: 'https://www.ndbrno.cz/wp-content/uploads/2023/03/reduta_sketchup.zip',
  source_skp_sha256: createHash('sha256').update(bytes).digest('hex'),
  model_sha256: createHash('sha256').update(glb).digest('hex'),
  primitive_count: scene.glbPrimitives.length,
  missing: ['complete auditorium seat centres and numbering', 'seat-eye heights', 'calibrated comparison images', 'detailed materials and furnishings', 'visual verification and reuse permission'],
}
await writeFile(resolve(output, 'source-report.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`Local Reduta technical study ready: ${glb.length} GLB bytes, ${report.primitive_count} primitives. Open /reduta-preview.html in the local Vite app.`)
