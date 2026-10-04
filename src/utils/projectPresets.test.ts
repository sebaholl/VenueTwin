import { describe, expect, it } from 'vitest'
import { createProjectConfig, venueTypeLabel } from './projectPresets'

describe('project presets', () => {
  it('creates a cinema layout with a clean editable state', () => {
    const config = createProjectConfig({ name: 'Screen 1', venueType: 'cinema' })
    expect(config).toMatchObject({ name: 'Screen 1', venueType: 'cinema', geometry: 'straight', rows: 10, seatsPerRow: 16 })
    expect(config.rowOverrides).toEqual({})
    expect(config.planBoundary).toEqual([])
  })

  it('allows layout values to override a venue preset', () => {
    const config = createProjectConfig({ name: '  Main Hall  ', venueType: 'theatre', rows: 18, seatsPerRow: 20, sectors: 3, geometry: 'blocks' })
    expect(config).toMatchObject({ name: 'Main Hall', rows: 18, seatsPerRow: 20, sectors: 3, geometry: 'blocks' })
  })

  it('returns a readable fallback venue label', () => {
    expect(venueTypeLabel()).toBe('Other venue')
  })
})
