import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { BoxGeometry } from 'three'

const args = process.argv.slice(2)
const option = (key) => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1] }
const project = option('--project'), modelPath = option('--model')
const slug = option('--slug') ?? 'demo-theatre/v1'
if (!/^[a-z0-9-]+\/v[1-9][0-9]*$/.test(slug)) throw new Error('Use a versioned slug such as theatre/v1.')
if (!!project !== !!modelPath) throw new Error('Supply both --project and --model.')
if (project && slug === 'demo-theatre/v1') throw new Error('Choose your own --slug for a custom venue.')
const folder = resolve('public/venues', slug)
if (project) {
  let exists = false
  try { await access(folder); exists = true } catch { /* New version. */ }
  if (exists) throw new Error('This version already exists. Choose a new version to preserve old seat links.')
}
const config = project ? JSON.parse(await readFile(project, 'utf8')).config : {
  name: 'The Lantern Theatre · demo', venueType: 'theatre', rows: 10, seatsPerRow: 14,
  sectors: 2, rake: .18, curve: 0, stageWidth: 10, geometry: 'straight',
  rowOverrides: {}, calibration: null, seatSpacing: .65, rowSpacing: .85, aisleWidth: 1,
  studyNotice: 'Fictional demonstration venue. Approximate seat views; no booking or live availability.',
}
if (!config || typeof config.name !== 'string') throw new Error('Choose a VenueTwin project export containing config.')

function demoModel() {
  // Original, deterministic architecture. Seats remain interactive in the web viewer.
  const geometry = new BoxGeometry(1, 1, 1)
  const chunks = [], views = [], accessors = []
  let length = 0
  function attribute(array, type, componentType, min, max) {
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength)
    views.push({ buffer: 0, byteOffset: length, byteLength: bytes.length })
    chunks.push(bytes); length += bytes.length
    const padding = (4 - length % 4) % 4; chunks.push(Buffer.alloc(padding)); length += padding
    accessors.push({ bufferView: views.length - 1, componentType, count: array.length / (type === 'VEC3' ? 3 : 1), type, ...(min ? { min, max } : {}) })
    return accessors.length - 1
  }
  const positions = attribute(geometry.attributes.position.array, 'VEC3', 5126, [-.5, -.5, -.5], [.5, .5, .5])
  const normals = attribute(geometry.attributes.normal.array, 'VEC3', 5126)
  const indices = attribute(geometry.index.array, 'SCALAR', 5123)
  const colors = [[.08,.11,.14,1],[.34,.07,.1,1],[.7,.43,.16,1],[.18,.13,.1,1]]
  const nodes = []
  const box = (name, translation, scale, material = 0, shell = false) => nodes.push({ name, mesh: material, translation, scale, ...(shell ? { extras: { venueTwinShell: true } } : {}) })
  box('Stage', [0,-.05,-2.3], [11,.4,3.4], 3)
  box('Curtain', [0,2.8,-3.8], [10,5.4,.18], 1)
  box('Portal top', [0,5.7,-3.6], [11,.3,.35], 2)
  for (const side of [-1,1]) {
    box('Portal side', [side*5.35,2.8,-3.6], [.25,5.5,.35], 2)
    box('Side wall', [side*6.1,3,2.5], [.25,6,14], 0, true)
    for (let bay=0;bay<6;bay++) box('Wall pilaster', [side*5.9,3,-2+bay*2], [.18,5.4,.16], 2, true)
  }
  box('Rear wall', [0,3,9], [12.4,6,.25], 0, true)
  for (let row=0;row<10;row++) box('Row deck', [0,row*.09-.08,row*.85], [11.7,row*.18+.16,.85], 3)
  const doc = { asset: { version: '2.0', generator: 'VenueTwin original demo architecture' }, scene: 0, scenes: [{ nodes: nodes.map((_,i)=>i) }], nodes,
    materials: colors.map((color)=>({ pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: .1, roughnessFactor: .8 } })),
    meshes: colors.map((_,material)=>({ primitives: [{ attributes: { POSITION: positions, NORMAL: normals }, indices, material }] })),
    buffers: [{ byteLength: length }], bufferViews: views, accessors }
  const raw = Buffer.from(JSON.stringify(doc)), json = Buffer.concat([raw, Buffer.alloc((4-raw.length%4)%4, 32)])
  const binary = Buffer.concat(chunks), header = Buffer.alloc(20), binHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67,0); header.writeUInt32LE(2,4); header.writeUInt32LE(28+json.length+binary.length,8)
  header.writeUInt32LE(json.length,12); header.writeUInt32LE(0x4e4f534a,16)
  binHeader.writeUInt32LE(binary.length,0); binHeader.writeUInt32LE(0x004e4942,4)
  geometry.dispose()
  return Buffer.concat([header,json,binHeader,binary])
}
const model = modelPath ? await readFile(modelPath) : demoModel()
if (model.length < 20 || model.length > 25*1024*1024 || model.readUInt32LE(0) !== 0x46546c67) throw new Error('Choose a self-contained GLB smaller than 25 MB.')
const hash = createHash('sha256').update(model).digest('hex'), filename = `venue-${hash.slice(0,16)}.glb`
await mkdir(folder, { recursive: true })
await writeFile(resolve(folder, filename), model)
await writeFile(resolve(folder, 'venue.json'), JSON.stringify({ format: 'venuetwin-viewer', version: 1, config, model: { file: filename, sha256: hash } }, null, 2))
console.log(`Demo package ready: /venues/${slug}/venue.json (${model.length} model bytes)`)
