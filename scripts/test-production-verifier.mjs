// Exercise rejection gates against a real Blender output, without another render.
import { mkdtemp, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
const source = resolve(process.argv[2])
const directory = await mkdtemp(join(tmpdir(), 'vt-reject-'))
try {
  const original = JSON.parse(await readFile(join(source, 'input.json'), 'utf8'))
  const verifier = resolve('scripts/verify-production.mjs')
  const kinds = ['eye', 'geometry', 'identity', 'header', 'fov']
  if (original.materials?.length) kinds.push('material')
  for (const kind of kinds) {
    const input = structuredClone(original)
    await copyFile(join(source, 'venue.glb'), join(directory, 'venue.glb'))
    if (kind === 'eye') input.seats[0].eye_position_m[0] += .2
    if (kind === 'geometry') input.structures[0].yaw_rad += .3
    if (kind === 'identity') input.seats[0].id = 'missing-seat'
    if (kind === 'fov') input.seats[0].vertical_fov_deg = 52
    if (kind === 'material') input.materials[0].roughness = .99
    if (kind === 'header') {
      const bytes = await readFile(join(directory, 'venue.glb'))
      bytes.writeUInt32LE(0, 0)
      await writeFile(join(directory, 'venue.glb'), bytes)
    }
    await writeFile(join(directory, 'input.json'), JSON.stringify(input))
    const result = spawnSync(process.execPath, [verifier, directory], { encoding: 'utf8', timeout: 30000 })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1, `${kind}: verifier must reject corruption`)
    assert.match(result.stderr, /AssertionError/)
  }
  console.log(`Production verifier rejected all ${kinds.length} corrupted geometry/camera/identity/header/FOV/material cases.`)
} finally { await rm(directory, { recursive: true, force: true }) }
