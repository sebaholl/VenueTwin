import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { estimateCapacity, estimateSeatScore, generateSeatLayout } from './venue'

describe('venue model', () => {
  it('estimates the configured capacity', () => {
    expect(estimateCapacity({ ...defaultVenue, geometry: 'straight' })).toBe(140)
  })

  it('uses individual row edits in capacity and layout', () => {
    const config = { ...defaultVenue, geometry: 'straight' as const, rowOverrides: { 0: { seats: 8, offsetX: 2 } } }
    expect(estimateCapacity(config)).toBe(134)
    expect(generateSeatLayout(config).filter((seat) => seat.row === 0)).toHaveLength(8)
    expect(generateSeatLayout(config)[0].position[0]).toBeGreaterThan(-1)
  })

  it('creates one straight-layout seat per configured position', () => {
    const config = { ...defaultVenue, geometry: 'straight' as const }
    expect(generateSeatLayout(config)).toHaveLength(140)
  })

  it('rates a central front seat above an edge rear seat', () => {
    const front = { row: 1, seat: 7, label: 'B8' }
    const rearEdge = { row: 9, seat: 0, label: 'J1' }
    expect(estimateSeatScore(front, defaultVenue)).toBeGreaterThan(estimateSeatScore(rearEdge, defaultVenue))
  })
})
