// Offline geometry round-trip for the measured-mesh verifier. Blender itself is covered by the container smoke job.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { BufferAttribute, BufferGeometry, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Scene, Vector3 } from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result => { this.result = result; this.onloadend() }) }
  readAsDataURL(blob) { blob.arrayBuffer().then(result => { this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`; this.onloadend() }) }
}

const vertices = [[-1, -1, -1], [1, -1, -1], [0, 1, -1], [0, 0, 1]]
const triangles = [[0, 1, 2], [0, 3, 1], [1, 3, 2], [2, 3, 0]]
const input = {
  stage_target_m: [0, 1, -3],
  structures: [{ id: 'measured-shell', position_m: [0, 0, 0], size_m: [2, 2, 2], yaw_rad: 0,
    mesh: { vertices_m: vertices, triangles } }],
  seats: [{ id: 'a1', position_m: [0, .25, 2], yaw_rad: 0, eye_position_m: [0, 1.15, 2] }],
}
const scene = new Scene(), geometry = new BufferGeometry()
geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices.flat()), 3))
geometry.setIndex(triangles.flat())
geometry.computeVertexNormals()
const shell = new Mesh(geometry, new MeshStandardMaterial())
shell.userData = { venueTwinStructureId: 'measured-shell', venueTwinStatus: 'draft-unverified' }
scene.add(shell)
const anchor = new Object3D()
anchor.position.set(0, .25, 2)
anchor.userData = { venueTwinSeatId: 'a1', venueTwinStatus: 'draft-unverified' }
scene.add(anchor)
const camera = new PerspectiveCamera(65, 1, .05, 2000)
camera.position.set(0, 1.15, 2)
camera.lookAt(new Vector3(...input.stage_target_m))
camera.userData = { venueTwinCameraSeatId: 'a1', venueTwinStatus: 'draft-unverified' }
scene.add(camera)
const glb = await new GLTFExporter().parseAsync(scene, { binary: true })
const directory = await mkdtemp(join(tmpdir(), 'vt-mesh-verify-'))
try {
  await writeFile(join(directory, 'venue.glb'), Buffer.from(glb))
  const verify = () => spawnSync(process.execPath, [resolve('scripts/verify-production.mjs'), directory], { encoding: 'utf8', timeout: 30000 })
  await writeFile(join(directory, 'input.json'), JSON.stringify(input))
  const valid = verify()
  assert.equal(valid.status, 0, valid.stderr)
  const tampered = structuredClone(input)
  tampered.structures[0].mesh.triangles[0] = [0, 1, 3]
  await writeFile(join(directory, 'input.json'), JSON.stringify(tampered))
  const invalid = verify()
  assert.equal(invalid.status, 1, 'Changed triangle topology must be rejected')
  assert.match(invalid.stderr, /AssertionError/)
  console.log('Measured mesh triangles survive GLB import and changed topology is rejected.')
} finally { await rm(directory, { recursive: true, force: true }) }
