// Offline photo landmark gate against the actual exported GLB camera.
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const [buildDirectory, reviewFile, photoFile] = process.argv.slice(2)
assert.ok(buildDirectory && reviewFile && photoFile, 'Usage: node scripts/photo-alignment.mjs BUILD_DIR REVIEW.json PHOTO_FILE')
const review = JSON.parse(await readFile(reviewFile, 'utf8'))
assert.equal(review.format, 'venuetwin-photo-alignment')
assert.equal(review.version, 1)
assert.match(review.seat_id, /^[A-Za-z0-9_.:-]{1,100}$/)
assert.match(review.photo_source_id, /^[A-Za-z0-9_.:-]{1,100}$/)
assert.match(review.glb_sha256, /^[a-f0-9]{64}$/)
assert.ok(Number.isInteger(review.image_width_px) && review.image_width_px >= 100 && review.image_width_px <= 20000)
assert.ok(Number.isInteger(review.image_height_px) && review.image_height_px >= 100 && review.image_height_px <= 20000)
assert.ok(Number.isFinite(review.maximum_error_px) && review.maximum_error_px > 0 && review.maximum_error_px <= 100)
assert.match(review.photo_sha256, /^[a-f0-9]{64}$/)
const photo = await readFile(photoFile)
assert.ok(photo.length <= 30 * 1024 * 1024, 'Photo exceeds 30 MiB')
assert.equal(createHash('sha256').update(photo).digest('hex'), review.photo_sha256, 'Photo hash differs')
function imageDimensions(bytes) {
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break
      const marker = bytes[offset + 1]
      if (marker === 0xd9 || marker === 0xda) break
      const size = bytes.readUInt16BE(offset + 2)
      assert.ok(size >= 2 && offset + 2 + size <= bytes.length, 'Invalid JPEG segment')
      if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
        assert.ok(size >= 7, 'Invalid JPEG frame')
        return [bytes.readUInt16BE(offset + 7), bytes.readUInt16BE(offset + 5)]
      }
      offset += 2 + size
    }
  }
  throw new Error('Photo must be a PNG or baseline/progressive JPEG with readable dimensions')
}
assert.deepEqual(imageDimensions(photo), [review.image_width_px, review.image_height_px], 'Photo dimensions differ')
assert.ok(Array.isArray(review.landmarks) && review.landmarks.length >= 4 && review.landmarks.length <= 100)
const ids = new Set()
for (const point of review.landmarks) {
  assert.ok(typeof point.id === 'string' && point.id.length > 0 && !ids.has(point.id), 'Landmark ID missing or duplicated')
  ids.add(point.id)
  assert.ok(Array.isArray(point.world_m) && point.world_m.length === 3 && point.world_m.every(v => Number.isFinite(v) && Math.abs(v) <= 500))
  assert.ok(Array.isArray(point.image_px) && point.image_px.length === 2 &&
    Number.isFinite(point.image_px[0]) && point.image_px[0] >= 0 && point.image_px[0] <= review.image_width_px &&
    Number.isFinite(point.image_px[1]) && point.image_px[1] >= 0 && point.image_px[1] <= review.image_height_px)
}
const model = await readFile(resolve(buildDirectory, 'venue.glb'))
assert.ok(model.length <= 25 * 1024 * 1024, 'GLB exceeds 25 MiB')
assert.equal(createHash('sha256').update(model).digest('hex'), review.glb_sha256, 'GLB hash differs')
globalThis.fetch = async () => { throw new Error('Network forbidden in photo alignment') }
const gltf = await new GLTFLoader().parseAsync(model.buffer.slice(model.byteOffset, model.byteOffset + model.byteLength), '')
gltf.scene.updateMatrixWorld(true)
const cameras = []
gltf.scene.traverse(object => { if (object.userData.venueTwinCameraSeatId === review.seat_id) cameras.push(object) })
assert.equal(cameras.length, 1, 'Expected exactly one camera for seat')
const camera = cameras[0]
assert.ok(camera.isPerspectiveCamera)
const input = JSON.parse(await readFile(resolve(buildDirectory, 'input.json'), 'utf8'))
const seat = input.seats.find(item => item.id === review.seat_id)
assert.ok(seat && seat.camera_source_id, 'Seat needs a photo-linked calibrated camera')
assert.equal(seat.camera_source_id, review.photo_source_id, 'Wrong photo source for camera')
const source = input.sources.find(item => item.id === review.photo_source_id)
assert.ok(source?.kind === 'photo' && source.sha256 === review.photo_sha256, 'Photo does not match contract evidence')
assert.ok(Math.abs(camera.fov - seat.vertical_fov_deg) < 0.0001, 'Exported camera FOV differs')
camera.aspect = review.image_width_px / review.image_height_px
camera.updateProjectionMatrix()
camera.updateMatrixWorld(true)
const errors = review.landmarks.map(point => {
  const world = new Vector3(...point.world_m)
  const local = camera.worldToLocal(world.clone())
  assert.ok(local.z < -camera.near, `Landmark behind camera: ${point.id}`)
  const ndc = world.project(camera)
  assert.ok(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1, `Landmark outside photo frame: ${point.id}`)
  const x = (ndc.x * .5 + .5) * review.image_width_px
  const y = (-ndc.y * .5 + .5) * review.image_height_px
  return { id: point.id, error_px: Math.hypot(x - point.image_px[0], y - point.image_px[1]) }
})
const maximum = Math.max(...errors.map(item => item.error_px))
const report = { format: 'venuetwin-photo-alignment-report', version: 1, seat_id: review.seat_id,
  photo_sha256: review.photo_sha256, glb_sha256: review.glb_sha256,
  maximum_error_px: maximum, threshold_px: review.maximum_error_px,
  passed: maximum <= review.maximum_error_px, landmarks: errors,
  note: 'Manual landmark reprojection only; does not prove texture quality, survey truth, or all seat views.' }
await writeFile(resolve(buildDirectory, `photo-alignment-${review.seat_id}.json`), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
assert.ok(report.passed, `Photo alignment exceeds ${review.maximum_error_px}px: ${maximum}px`)
console.log(`Seat ${review.seat_id}: ${errors.length} landmarks within ${review.maximum_error_px}px (worst ${maximum.toFixed(2)}px).`)
