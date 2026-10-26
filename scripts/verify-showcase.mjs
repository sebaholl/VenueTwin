import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const directory = resolve(process.argv[2] ?? 'venue-data/lantern-opera-house/public-demo')
const manifest = JSON.parse(await readFile(resolve(directory, 'venue.json'), 'utf8'))
const bytes = await readFile(resolve(directory, 'venue.glb'))
assert.equal(manifest.quality, 'demonstration')
assert.match(manifest.notice, /FICTIONAL SHOWCASE/)
assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.model.sha256)
assert.ok(bytes.length < 25 * 1024 * 1024)
const jsonLength = bytes.readUInt32LE(12)
const doc = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
const expectedImages = ['dark_wood_diff_1k.jpg', 'dark_wood_nor_gl_1k.jpg', 'painted_plaster_wall_diff_1k.jpg', 'painted_plaster_wall_nor_gl_1k.jpg', 'velour_velvet_diff_1k.jpg', 'velour_velvet_nor_gl_1k.jpg']
assert.deepEqual(doc.images.map(image => image.name), expectedImages)
const binaryOffset = 20 + jsonLength + 8
for (const image of doc.images) {
  assert.equal(image.mimeType, 'image/jpeg')
  assert.equal(image.uri, undefined)
  const slice = doc.bufferViews[image.bufferView]
  const embedded = bytes.subarray(binaryOffset + slice.byteOffset, binaryOffset + slice.byteOffset + slice.byteLength)
  const source = await readFile(resolve('venue-data/lantern-opera-house/materials', image.name))
  assert.equal(createHash('sha256').update(embedded).digest('hex'), createHash('sha256').update(source).digest('hex'))
}
for (const mesh of doc.meshes) for (const primitive of mesh.primitives) {
  assert.equal(doc.accessors[primitive.attributes.TEXCOORD_0].count, doc.accessors[primitive.attributes.POSITION].count)
}
for (const name of ['plaster', 'velvet', 'carpet', 'wood']) {
  const material = doc.materials.find(item => item.name === name)
  assert.ok(material?.pbrMetallicRoughness.baseColorTexture && material.normalTexture, `Missing ${name} textures`)
}
globalThis.fetch = async () => { throw new Error('Remote asset forbidden in showcase') }
// Node has no image decoder. Parse the same geometry/cameras after removing only
// texture references; the embedded image bytes above are checked byte-for-byte.
const geometryDoc = structuredClone(doc)
geometryDoc.images = []; geometryDoc.textures = []
for (const material of geometryDoc.materials) {
  delete material.pbrMetallicRoughness.baseColorTexture
  delete material.normalTexture
}
const json = Buffer.from(JSON.stringify(geometryDoc))
const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 0x20)])
const bin = bytes.subarray(binaryOffset)
const viewBytes = Buffer.concat([Buffer.alloc(12), Buffer.alloc(8), padded, Buffer.alloc(8), bin])
viewBytes.write('glTF', 0); viewBytes.writeUInt32LE(2, 4); viewBytes.writeUInt32LE(viewBytes.length, 8)
viewBytes.writeUInt32LE(padded.length, 12); viewBytes.write('JSON', 16)
viewBytes.writeUInt32LE(bin.length, 20 + padded.length); viewBytes.write('BIN\0', 24 + padded.length)
const view = viewBytes.buffer.slice(viewBytes.byteOffset, viewBytes.byteOffset + viewBytes.byteLength)
const scene = (await new GLTFLoader().parseAsync(view, '')).scene
scene.updateMatrixWorld(true)
const anchors = new Map(), cameras = new Map(); let meshes = 0
scene.traverse(object => {
  if (object.isMesh) meshes++
  const seat = object.userData.venueTwinSeatId, camera = object.userData.venueTwinCameraSeatId
  if (seat) { assert.ok(!anchors.has(seat)); anchors.set(seat, object) }
  if (camera) { assert.ok(!cameras.has(camera)); cameras.set(camera, object) }
})
assert.ok(meshes >= 25)
assert.equal(anchors.size, manifest.seats.length)
assert.equal(cameras.size, manifest.seats.length)
for (const seat of manifest.seats) {
  const anchor=anchors.get(seat.id), camera=cameras.get(seat.id)
  assert.ok(anchor && camera?.isPerspectiveCamera, `Missing ${seat.id}`)
  assert.ok(anchor.getWorldPosition(new Vector3()).distanceTo(new Vector3(...seat.position)) < .0001)
  assert.ok(camera.getWorldPosition(new Vector3()).distanceTo(new Vector3(...seat.eye)) < .0001)
  const target=new Vector3(...manifest.target).sub(new Vector3(...seat.eye)).normalize()
  assert.ok(camera.getWorldDirection(new Vector3()).distanceTo(target) < .0001, `Aim ${seat.id}`)
  assert.ok(Math.abs(camera.fov-seat.vertical_fov_deg) < .0001)
}
console.log(`Showcase verified offline: ${meshes} architectural meshes, ${anchors.size} seats and calibrated-to-fiction camera transforms.`)
