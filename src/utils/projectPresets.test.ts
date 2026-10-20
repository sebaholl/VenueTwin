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

// A blank draft must remain empty until the user or Pilot supplies seating.
describe('blank project', () => {
  it('starts without seats and accepts a supplied Pilot seating plan', async () => {
    const { createBlankProjectConfig } = await import('./projectPresets')
    const { generateSeatLayout } = await import('./venue')
    const { applyPilotPlan } = await import('./studioPilot')
    const { parseViewerConfig } = await import('./customerViewer')
    const blank = createBlankProjectConfig({ name: 'Cinema 60', venueType: 'cinema' })
    expect(generateSeatLayout(blank)).toEqual([])
    expect(parseViewerConfig(JSON.parse(JSON.stringify(blank)), true).rows).toBe(0)
    expect(() => parseViewerConfig(blank)).toThrow()
    const next = applyPilotPlan(blank, { summary: 'Create 60 seats', questions: [], limitations: [], expectedSeatCount: 60, actions: [{ tool: 'set_seating', basis: 'provided', source: 'Test brief', rows: 6, seatsPerRow: 10, sectors: 1, geometry: 'straight', rake: 0, curve: 0, seatSpacing: .6, rowSpacing: 1.1, aisleWidth: 1.2 }] }, false)
    expect(generateSeatLayout(next)).toHaveLength(60)
    expect(blank.rows).toBe(0)
    expect(next.rowOverrides).toEqual({})
  })
})
