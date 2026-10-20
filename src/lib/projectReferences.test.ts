import { describe, expect, it } from 'vitest'
import { emptyReferences, validateReferences, type ReferenceAsset } from './projectReferences'
const asset = (kind: 'plan' | 'photo' = 'plan', type = 'image/png'): ReferenceAsset => ({ id: 'a', kind, name: 'plan.png', file: new Blob(['image'], { type }), caption: '' })
describe('project references', () => {
  it('accepts an empty project and a PDF source plan', () => {
    expect(validateReferences(emptyReferences()).activePlanId).toBeNull()
    expect(validateReferences({ ...emptyReferences(), assets: [asset('plan', 'application/pdf')], activePlanId: 'a' }).assets).toHaveLength(1)
  })
  it('does not accept a photo or missing file as the active floor plan', () => {
    expect(() => validateReferences({ ...emptyReferences(), activePlanId: 'missing' })).toThrow('missing')
    expect(() => validateReferences({ ...emptyReferences(), assets: [asset('photo')], activePlanId: 'a' })).toThrow('missing')
  })
  it('rejects unsupported formats, duplicate IDs and excessive file sizes', () => {
    for (const assets of [[asset('photo', 'application/pdf')], [asset('plan', 'image/svg+xml')], [asset(), asset()], [{ ...asset(), file: new Blob([new Uint8Array(11*1024*1024)], { type: 'image/png' }) }]]) expect(() => validateReferences({ ...emptyReferences(), assets })).toThrow()
  })
  it('requires positive finite measurements with explicit evidence labels', () => {
    const measurement = { id: 'm', label: 'Stage width', meters: 12, confidence: 'estimated' as const, source: 'Reference photograph' }
    expect(validateReferences({ ...emptyReferences(), measurements: [measurement] }).measurements[0].confidence).toBe('estimated')
    for (const meters of [0, -1, NaN, Infinity, 1001]) expect(() => validateReferences({ ...emptyReferences(), measurements: [{ ...measurement, meters }] })).toThrow()
  })
  it('caps references and notes to prevent unbounded records', () => {
    expect(() => validateReferences({ ...emptyReferences(), assets: Array.from({ length: 21 }, (_, i) => ({ ...asset(), id: String(i) })) })).toThrow()
    expect(() => validateReferences({ ...emptyReferences(), notes: 'x'.repeat(10001) })).toThrow()
  })
})
