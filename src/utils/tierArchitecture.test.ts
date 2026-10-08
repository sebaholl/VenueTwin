import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { levelArchitecture } from './levelGeometry'
import { blenderBlueprint } from './blenderBridge'
import { geometrySignature } from './customerViewer'
const config = { ...defaultVenue, geometry: 'straight' as const, rows: 3, seatingLevels: [{ id: 'upper', name: 'Upper tier', elevation: 4, parapetHeight: 1.1 }], rowOverrides: { 0: { levelId: 'upper', rotation: 45 }, 1: { levelId: 'upper', rotation: 45 }, 2: { levelId: 'upper', rotation: 45 } } }
describe('custom tier architecture', () => {
  it('rotates straight row decks instead of expanding their axis-aligned bounds', () => {
    const rotated = levelArchitecture(config).find((box) => box.name === 'Deck 1')!
    const straight = levelArchitecture({ ...config, rowOverrides: { 0: { levelId: 'upper' } } }).find((box) => box.name === 'Deck 1')!
    expect(rotated.rotation).toBeCloseTo(Math.PI / 4)
    expect(rotated.size[0]).toBeCloseTo(straight.size[0])
    expect(rotated.size[2]).toBeCloseTo(config.rowSpacing!)
  })
  it('adds one default front railing at the raised level height', () => {
    const rails = levelArchitecture(config).filter((box) => box.name.startsWith('Straight parapet'))
    expect(rails).toHaveLength(1)
    expect(rails[0].position[1]).toBeCloseTo(4.55)
    expect(rails[0].size[1]).toBe(1.1)
  })
  it('allows front railings on separate row sections and tracks geometry changes', () => {
    const next = { ...config, rowOverrides: { ...config.rowOverrides, 0: { ...config.rowOverrides[0], frontRailing: false }, 2: { ...config.rowOverrides[2], frontRailing: true } } }
    expect(levelArchitecture(next).filter((box) => box.name.startsWith('Straight parapet')).map((box) => box.name)).toEqual(['Straight parapet 3'])
    expect(geometrySignature(next)).not.toBe(geometrySignature(config))
  })
  it('prevents unsupported custom railings in the detailed template', () => {
    expect(() => blenderBlueprint({ ...config, rowOverrides: { 0: { levelId: 'upper', frontRailing: false } } }, true)).toThrow('general Blender')
  })
  it('exports exactly the structures shown by the live generator', () => {
    const boxes = levelArchitecture(config)
    expect(blenderBlueprint(config).boxes.slice(2, 2 + boxes.length)).toEqual(boxes)
  })
})
