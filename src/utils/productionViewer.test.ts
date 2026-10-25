import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import fixture from '../../tests/fixtures/production/venue.json'
import { parseProductionManifest, productionCameras, productionSeatLink } from './productionViewer'

describe('customer production contract', () => {
  it('accepts the public Python-generated fixture without private metadata', () => {
    expect(parseProductionManifest(fixture)).toEqual(fixture)
    expect(JSON.stringify(fixture)).not.toContain('source_ids')
  })
  it.each(['unknown', 'coercion', 'camera', 'level', 'duplicate', 'url', 'missing', 'lens', 'old-version'])('rejects %s instead of generating fallback geometry', kind => {
    const value = structuredClone(fixture) as unknown as Record<string, unknown>
    const seats = value.seats as Record<string, unknown>[]
    if (kind === 'unknown') value.privateNotes = 'secret'
    if (kind === 'coercion') value.revision = '1'
    if (kind === 'camera') seats[0].eye = [NaN, 1, 2]
    if (kind === 'level') seats[0].level_id = 'missing'
    if (kind === 'duplicate') seats.push(seats[0])
    if (kind === 'url') value.model = { file: 'https://evil.test/model.glb', sha256: 'a'.repeat(64) }
    if (kind === 'missing') delete seats[0].eye
    if (kind === 'lens') seats[0].vertical_fov_deg = '65'
    if (kind === 'old-version') value.version = 1
    expect(() => parseProductionManifest(value)).toThrow()
  })
  it('preserves stable seat IDs and versioned venue paths in shared links', () => {
    const url = new URL(productionSeatLink('https://venue.test', '/venues/theatre/v4/venue.json', 'stalls.a1'))
    expect(url.searchParams.get('seat')).toBe('stalls.a1')
    expect(url.searchParams.get('venue')).toBe('/venues/theatre/v4/venue.json')
  })
  it('matches actual Blender cameras and rejects a displaced camera', async () => {
    const bytes = readFileSync('tests/fixtures/production/venue.glb')
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const manifest = parseProductionManifest(fixture)
    const { cameras } = productionCameras(scene, manifest)
    expect(cameras.size).toBe(4)
    cameras.get('a1')!.position.x += 1
    expect(() => productionCameras(scene, manifest)).toThrow('do not match')
  })
  it('rejects a lens that differs from the approved seat view', async () => {
    const bytes = readFileSync('tests/fixtures/production/venue.glb')
    const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const manifest = parseProductionManifest(fixture)
    manifest.seats[0].vertical_fov_deg = 50
    expect(() => productionCameras(scene, manifest)).toThrow('do not match')
  })
})
