// Offline, actual Three.js GLB round-trip gate. No renderer, browser or remote assets.
import { readFile, writeFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { Vector3, Matrix4, REVISION } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const directory = resolve(process.argv[2] ?? '')
const source = JSON.parse(await readFile(resolve(directory, 'input.json'), 'utf8'))
const modelPath = resolve(directory, 'venue.glb')
assert.ok((await stat(modelPath)).size <= 25 * 1024 * 1024, 'GLB exceeds 25 MiB')
const bytes = await readFile(modelPath)
assert.ok(bytes.length >= 20, 'Truncated GLB')
assert.equal(bytes.readUInt32LE(0), 0x46546c67)
assert.equal(bytes.readUInt32LE(4), 2)
assert.equal(bytes.readUInt32LE(8), bytes.length)
assert.equal(bytes.readUInt32LE(16), 0x4e4f534a)
const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString())
assert.ok(!json.images?.length && !json.buffers?.some(buffer => buffer.uri), 'External resources are forbidden')
assert.ok(!json.extensionsRequired?.length, 'Unexpected glTF extensions')
globalThis.fetch = async () => { throw new Error('Network forbidden in production verification') }
const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
gltf.scene.updateMatrixWorld(true)
const groups = { structures: new Map(), seats: new Map(), cameras: new Map() }
gltf.scene.traverse(object => {
  for (const [group, field] of [['structures', 'venueTwinStructureId'], ['seats', 'venueTwinSeatId'], ['cameras', 'venueTwinCameraSeatId']]) {
    const id = object.userData[field]
    if (id !== undefined) {
      assert.equal(groups[group].has(id), false, `Duplicate ${group} ID ${id}`)
      assert.equal(object.userData.venueTwinStatus, 'draft-unverified')
      groups[group].set(id, object)
    }
  }
  if (object.isMesh) assert.ok(object.userData.venueTwinStructureId, 'Unexpected mesh')
  if (object.isCamera) assert.ok(object.userData.venueTwinCameraSeatId, 'Unexpected camera')
})
const tolerance = 0.0001
let maxError = 0
function close(actual, expected, label) {
  const error = actual.distanceTo(expected)
  maxError = Math.max(maxError, error)
  assert.ok(error <= tolerance, `${label}: error ${error}`)
}
assert.equal(groups.structures.size, source.structures.length)
assert.equal(groups.seats.size, source.seats.length)
assert.equal(groups.cameras.size, source.seats.length)
for (const structure of source.structures) {
  const mesh = groups.structures.get(structure.id)
  assert.ok(mesh?.isMesh, `Missing structure ${structure.id}`)
  const centre = new Vector3(...structure.position_m)
  const rotation = new Matrix4().makeRotationY(structure.yaw_rad)
  const expected = []
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    expected.push(new Vector3(x * structure.size_m[0] / 2, y * structure.size_m[1] / 2, z * structure.size_m[2] / 2).applyMatrix4(rotation).add(centre))
  }
  const vertices = mesh.geometry.getAttribute('position')
  const actual = Array.from({ length: vertices.count }, (_, i) => new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld))
  for (const point of expected) close(actual.reduce((a, b) => a.distanceToSquared(point) < b.distanceToSquared(point) ? a : b), point, `Structure ${structure.id}`)
  for (const point of actual) close(point, expected.reduce((a, b) => a.distanceToSquared(point) < b.distanceToSquared(point) ? a : b), `Unexpected vertex ${structure.id}`)
}
for (const seat of source.seats) {
  const anchor = groups.seats.get(seat.id), camera = groups.cameras.get(seat.id)
  assert.ok(anchor && camera?.isPerspectiveCamera, `Missing seat or camera ${seat.id}`)
  close(anchor.getWorldPosition(new Vector3()), new Vector3(...seat.position_m), `Seat ${seat.id}`)
  close(anchor.getWorldDirection(new Vector3()), new Vector3(Math.sin(seat.yaw_rad), 0, Math.cos(seat.yaw_rad)), `Seat yaw ${seat.id}`)
  close(camera.getWorldPosition(new Vector3()), new Vector3(...seat.eye_position_m), `Eye ${seat.id}`)
  const direction = new Vector3(...source.stage_target_m).sub(new Vector3(...seat.eye_position_m)).normalize()
  close(camera.getWorldDirection(new Vector3()), direction, `Camera aim ${seat.id}`)
  const expectedRight = direction.clone().cross(new Vector3(0, 1, 0)).normalize()
  const actualRight = new Vector3(1, 0, 0).transformDirection(camera.matrixWorld)
  close(actualRight, expectedRight, `Camera roll ${seat.id}`)
  assert.ok(Math.abs(camera.fov - 65) < .0001, `Camera FOV ${camera.fov}`)
}
const report = { format: 'venuetwin-roundtrip', version: 1, three_revision: REVISION, structures: groups.structures.size,
  seats: groups.seats.size, cameras: groups.cameras.size, position_tolerance_m: tolerance, direction_vector_tolerance: tolerance,
  maximum_numeric_error: maxError, glb_sha256: createHash('sha256').update(bytes).digest('hex'),
  note: 'Numeric coordinate round-trip only; not a venue accuracy or sightline certification.' }
await writeFile(resolve(directory, 'verification.json'), JSON.stringify(report, null, 2) + '\n')
console.log(`Production GLB verified: ${report.structures} structures, ${report.seats} seats, ${report.cameras} cameras.`)
