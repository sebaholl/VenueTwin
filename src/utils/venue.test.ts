import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { estimateCapacity, estimateSeatScore, generateSeatLayout } from './venue'

describe('venue model', () => {
  it('estimates the configured capacity', () => {
    expect(estimateCapacity(defaultVenue)).toBe(140)
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
