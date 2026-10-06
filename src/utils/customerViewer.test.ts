import { describe, expect, it } from 'vitest'
import { assetUrl, embedCode, geometrySignature, parseViewerConfig, viewerLevels, viewerManifest } from './customerViewer'
import { defaultVenue } from '../types/venue'
import { createNationalTheatreStudy } from './nationalTheatreStudy'

describe('customer viewer', () => {
  it('groups every seat exactly once without changing coordinates', () => {
    const config = createNationalTheatreStudy(), levels = viewerLevels(config)
    expect(levels).toHaveLength(5)
    expect(levels[0].seats).toHaveLength(238)
    const labels = levels.flatMap((l) => l.seats.map((s) => s.label))
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels).toHaveLength(862)
    expect(levels[1].seats[0].position[1]).toBeCloseTo(3.95)
  })
  it('keeps unassigned seats accessible', () => {
    const config = createNationalTheatreStudy()
    delete config.rowOverrides[0].levelId
    expect(viewerLevels(config)[0].id).toBe('__main')
    expect(viewerLevels(defaultVenue)[0].seats.length).toBeGreaterThan(0)
  })
  it('detects geometry changes but ignores names and prices', () => {
    const config = createNationalTheatreStudy()
    expect(geometrySignature({ ...config, name: 'Renamed' })).toBe(geometrySignature(config))
    expect(geometrySignature({ ...config, stageWidth: 15 })).not.toBe(geometrySignature(config))
    expect(geometrySignature({ ...config, rowOverrides: { ...config.rowOverrides, 0: { ...config.rowOverrides[0], elevation: 2 } } })).not.toBe(geometrySignature(config))
  })
  it('rejects excessive or non-finite layouts before generating seats', () => {
    expect(() => parseViewerConfig({ ...defaultVenue, rows: Infinity })).toThrow()
    expect(() => parseViewerConfig({ ...defaultVenue, rows: 50, seatsPerRow: 200 })).toThrow('2,000')
    expect(() => parseViewerConfig({ ...defaultVenue, rowOverrides: { 0: { arcRadius: NaN } } })).toThrow()
    expect(parseViewerConfig(createNationalTheatreStudy()).rows).toBe(24)
  })
  it('restricts assets to the same-origin public venue folder', () => {
    const base = 'https://example.com/venues/nd/venue.json'
    expect(assetUrl('./venue.glb', base, 'https://example.com')).toBe('https://example.com/venues/nd/venue.glb')
    for (const url of ['https://other.test/x.glb', '/api/logout', '../../../private.json', 'javascript:alert(1)', '/venues/x.glb?redirect=1']) expect(() => assetUrl(url, base, 'https://example.com')).toThrow()
  })
  it('pairs the exported manifest with the exact model bytes', async () => {
    const manifest = await viewerManifest({ config: defaultVenue, model: new Blob(['test']), createdAt: '' })
    expect(manifest.model?.sha256).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08')
    expect((await viewerManifest({ config: defaultVenue, model: null, createdAt: '' })).model).toBeUndefined()
  })
  it('produces a hosted embed, never a local-storage preview link', () => {
    const code = embedCode('https://example.com', '/venues/nd')
    expect(code).toContain('/viewer?venue=%2Fvenues%2Fnd%2Fvenue.json')
    expect(() => embedCode('https://example.com', '/venues/" onload="x')).toThrow()
  })
})
