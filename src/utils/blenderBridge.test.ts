import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { blenderBlueprint } from './blenderBridge'
import { generateSeatLayout } from './venue'
import { validateGlb } from './localGlb'
import { createNationalTheatreStudy } from './nationalTheatreStudy'

function glb(json: object) {
  const text = JSON.stringify(json); const bytes = new TextEncoder().encode(text + ' '.repeat((4 - text.length % 4) % 4))
  const data = new ArrayBuffer(bytes.length + 20), view = new DataView(data)
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, data.byteLength, true)
  view.setUint32(12, bytes.length, true); view.setUint32(16, 0x4e4f534a, true); new Uint8Array(data, 20).set(bytes)
  return data
}
describe('Blender bridge', () => {
  it('includes detail metadata only when explicitly requested for a study', () => {
    expect(blenderBlueprint(defaultVenue, true).detail).toBeUndefined()
    const config = createNationalTheatreStudy()
    expect(blenderBlueprint(config).detail).toBeUndefined()
    const data = blenderBlueprint(config, true)
    expect(data.detail?.profile).toBe('nd-photo-study-v1')
    expect(data.detail?.rows[10].floor).toBeCloseTo(3.7)
    expect(data.detail?.rows[10].arcRadius).toBe(10.6)
    expect(data.seats).toEqual(blenderBlueprint(config).seats)
  })
  it('exports the exact interactive seat coordinates, without world display offset', () => {
    const data = blenderBlueprint(defaultVenue)
    expect(data.format).toBe('venuetwin-blender'); expect(data.units).toBe('metres')
    expect(data.seats[0].position).toEqual(generateSeatLayout(defaultVenue)[0].position)
    expect(data.boxes).toHaveLength(defaultVenue.rows + 3)
  })
  it('places deck tops at the row floor height', () => {
    const decks = blenderBlueprint(defaultVenue).boxes.filter((b) => b.name.startsWith('Approximate row'))
    decks.forEach((deck, i) => expect(deck.position[1] + deck.size[1] / 2).toBeCloseTo(i * defaultVenue.rake))
  })
  it('preserves rotated stage coordinates', () => {
    const data = blenderBlueprint({ ...defaultVenue, stagePosition: { offsetX: 2, offsetY: 3, rotation: 90 } })
    expect(data.boxes[1].position[0]).toBeCloseTo(-1.25); expect(data.boxes[1].position[2]).toBeCloseTo(3)
  })
  it('accepts an embedded GLB manifest', () => expect(validateGlb(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] })).asset.version).toBe('2.0'))
  it('rejects external files and remote images', () => {
    expect(() => validateGlb(glb({ asset: { version: '2.0' }, images: [{ uri: 'https://example.com/a.png' }] }))).toThrow('External')
    expect(() => validateGlb(glb({ asset: { version: '2.0' }, buffers: [{ uri: 'local.bin' }] }))).toThrow('External')
  })
  it('rejects corrupt headers and excessive geometry', () => {
    expect(() => validateGlb(new ArrayBuffer(22))).toThrow('valid')
    expect(() => validateGlb(glb({ asset: { version: '2.0' }, accessors: [{ count: 7000000 }] }))).toThrow('complex')
  })
})
