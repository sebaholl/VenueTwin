// Synthetic camera/photo fixture: checks offline GLB projection and fail-closed mismatch.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { deflateSync } from 'node:zlib'

function crc(bytes) {
  let value = 0xffffffff
  for (const byte of bytes) {
    value ^= byte
    for (let i = 0; i < 8; i++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0)
  }
  return (value ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, checksum])
}
const pixels = Buffer.alloc(100 * (1 + 100 * 3))
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', Buffer.from([0, 0, 0, 100, 0, 0, 0, 100, 8, 2, 0, 0, 0])),
  chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))])
const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ camera: 0, translation: [0, 1, 0], extras: { venueTwinCameraSeatId: 'a1' } }],
  cameras: [{ type: 'perspective', perspective: { yfov: 65 * Math.PI / 180, znear: .05, zfar: 2000, aspectRatio: 1 } }] }
const json = Buffer.from(JSON.stringify(gltf))
const padded = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)])
const glb = Buffer.alloc(20 + padded.length)
glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8)
glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); padded.copy(glb, 20)
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const directory = await mkdtemp(join(tmpdir(), 'vt-photo-test-'))
try {
  await writeFile(join(directory, 'venue.glb'), glb)
  await writeFile(join(directory, 'photo.png'), png)
  await writeFile(join(directory, 'input.json'), JSON.stringify({ seats: [{ id: 'a1', vertical_fov_deg: 65,
    camera_source_id: 'photo' }], sources: [{ id: 'photo', kind: 'photo', sha256: digest(png) }] }))
  const spread = 100 / (2 * 5 * Math.tan(65 * Math.PI / 360))
  const review = { format: 'venuetwin-photo-alignment', version: 1, seat_id: 'a1', photo_source_id: 'photo',
    photo_sha256: digest(png), glb_sha256: digest(glb), image_width_px: 100, image_height_px: 100,
    maximum_error_px: 2, landmarks: [
      { id: 'centre', world_m: [0, 1, -5], image_px: [50, 50] },
      { id: 'left', world_m: [-1, 1, -5], image_px: [50 - spread, 50] },
      { id: 'right', world_m: [1, 1, -5], image_px: [50 + spread, 50] },
      { id: 'top', world_m: [0, 2, -5], image_px: [50, 50 - spread] }] }
  const run = () => spawnSync(process.execPath, [resolve('scripts/photo-alignment.mjs'), directory,
    join(directory, 'review.json'), join(directory, 'photo.png')], { encoding: 'utf8' })
  await writeFile(join(directory, 'review.json'), JSON.stringify(review))
  const passed = run()
  assert.equal(passed.status, 0, passed.stderr)
  const report = JSON.parse(await readFile(join(directory, 'photo-alignment-a1.json')))
  assert.equal(report.passed, true)
  assert.ok(report.rms_error_px < 1e-8)
  assert.deepEqual(report.landmarks[0].projected_px, [50, 50])
  await rm(join(directory, 'photo-alignment-a1.json'))
  review.landmarks[0].image_px[0] += 20
  await writeFile(join(directory, 'review.json'), JSON.stringify(review))
  const failed = run()
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /Photo alignment exceeds/)
  assert.equal(JSON.parse(await readFile(join(directory, 'photo-alignment-a1.json'))).passed, false)
  await rm(join(directory, 'photo-alignment-a1.json'))
  const textured = structuredClone(gltf)
  textured.buffers = [{ byteLength: png.length }]
  textured.bufferViews = [{ buffer: 0, byteOffset: 0, byteLength: png.length }]
  textured.images = [{ mimeType: 'image/png', bufferView: 0 }]
  textured.textures = [{ source: 0 }]
  textured.materials = [{ name: 'VT_surface', pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]
  const textureJson = Buffer.from(JSON.stringify(textured))
  const textureJsonPadded = Buffer.concat([textureJson, Buffer.alloc((4 - textureJson.length % 4) % 4, 32)])
  const imagePadded = Buffer.concat([png, Buffer.alloc((4 - png.length % 4) % 4)])
  const texturedGlb = Buffer.alloc(20 + textureJsonPadded.length + 8 + imagePadded.length)
  texturedGlb.writeUInt32LE(0x46546c67, 0); texturedGlb.writeUInt32LE(2, 4)
  texturedGlb.writeUInt32LE(texturedGlb.length, 8); texturedGlb.writeUInt32LE(textureJsonPadded.length, 12)
  texturedGlb.writeUInt32LE(0x4e4f534a, 16); textureJsonPadded.copy(texturedGlb, 20)
  const binaryAt = 20 + textureJsonPadded.length
  texturedGlb.writeUInt32LE(imagePadded.length, binaryAt); texturedGlb.writeUInt32LE(0x004e4942, binaryAt + 4)
  imagePadded.copy(texturedGlb, binaryAt + 8)
  await writeFile(join(directory, 'venue.glb'), texturedGlb)
  await writeFile(join(directory, 'input.json'), JSON.stringify({ seats: [{ id: 'a1', vertical_fov_deg: 65,
    camera_source_id: 'photo' }], sources: [{ id: 'photo', kind: 'photo', sha256: digest(png) },
      { id: 'texture', kind: 'photo', sha256: digest(png) }],
  materials: [{ id: 'surface', base_color_texture_source_id: 'texture' }] }))
  review.landmarks[0].image_px[0] -= 20
  review.glb_sha256 = digest(texturedGlb)
  await writeFile(join(directory, 'review.json'), JSON.stringify(review))
  const texturedPass = run()
  assert.equal(texturedPass.status, 0, texturedPass.stderr)
  console.log('Photo alignment accepted a calibrated synthetic camera and rejected a 20px mismatch.')
} finally { await rm(directory, { recursive: true, force: true }) }
