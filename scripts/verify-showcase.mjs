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
globalThis.fetch = async () => { throw new Error('Remote asset forbidden in showcase') }
const view = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
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
