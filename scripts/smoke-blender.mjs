import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const directory = await mkdtemp(join(tmpdir(), 'vt-smoke-'))
try {
  const input = join(directory, 'scene.json'), output = join(directory, 'venue.glb')
  await writeFile(input, JSON.stringify({ format: 'venuetwin-blender', version: 1, units: 'metres', axes: 'three-y-up', seats: [], boxes: [{ name: 'Smoke structure', position: [0, 1, 0], size: [2, 2, .2], rotation: .2, color: '#b88b43', roughness: .3, metalness: .7 }] }))
  await promisify(execFile)(process.env.BLENDER_PATH || 'blender', ['--background', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1', '--python', resolve('scripts/blender/build_job.py'), '--', input, output], { timeout: 120000, maxBuffer: 1024 * 1024, env: { PATH: process.env.PATH, HOME: '/tmp' } })
  const glb = await readFile(output)
  if (glb.length < 20 || glb.readUInt32LE(0) !== 0x46546c67 || glb.readUInt32LE(4) !== 2 || glb.readUInt32LE(8) !== glb.length) throw new Error('Blender did not produce a valid GLB.')
  const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString())
  if (!json.meshes?.length || !json.materials?.some(material => Math.abs((material.pbrMetallicRoughness?.metallicFactor ?? 0) - .7) < .0001)) throw new Error('Blender export lost geometry or materials.')
  console.info(`Blender smoke passed: ${glb.length} bytes, ${json.meshes.length} mesh(es).`)
} finally { await rm(directory, { recursive: true, force: true }) }
