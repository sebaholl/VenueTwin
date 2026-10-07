import { describe, expect, it } from 'vitest'
import { calibratePlan, planScale } from './planScale'
import { generateAutoLayout } from './autoLayout'
import { generateSeatLayout } from './venue'
import { defaultVenue } from '../types/venue'
const boundary = [{ x: 300, y: 180 }, { x: 700, y: 180 }, { x: 700, y: 500 }, { x: 300, y: 500 }]
describe('plan scale', () => {
  it('calibrates a diagonal measurement in SVG coordinates', () => {
    const result = calibratePlan([{ x: 0, y: 0 }, { x: 30, y: 40 }], 2)
    expect(result).toEqual({ pixels: 50, meters: 2 })
    expect(planScale(result)).toBe(25)
  })
  it('rejects coincident points, invalid distances and invalid saved scales', () => {
    for (const meters of [0, -1, NaN, Infinity, 1001]) expect(calibratePlan([{ x: 0, y: 0 }, { x: 50, y: 0 }], meters)).toBeNull()
    expect(calibratePlan([{ x: 0, y: 0 }, { x: 0, y: 0 }], 10)).toBeNull()
    expect(planScale({ pixels: 100, meters: 0 })).toBe(24)
  })
  it('changes layout density when calibrated metres change', () => {
    const small = generateAutoLayout({ ...defaultVenue, calibration: { pixels: 240, meters: 5 } }, boundary)
    const large = generateAutoLayout({ ...defaultVenue, calibration: { pixels: 240, meters: 10 } }, boundary)
    expect(large.capacity).toBeGreaterThan(small.capacity)
  })
  it('renders generated row centres inside the actual boundary with real row spacing', () => {
    const config = { ...defaultVenue, calibration: { pixels: 200, meters: 10 }, rowSpacing: 1.2 }
    const result = generateAutoLayout(config, boundary)
    const seats = generateSeatLayout({ ...config, ...result, geometry: 'straight' })
    for (const seat of seats) {
      const x = 500 + seat.position[0] * 20, y = 150 + seat.position[2] * 20
      expect(x).toBeGreaterThanOrEqual(300); expect(x).toBeLessThanOrEqual(700)
      expect(y).toBeGreaterThanOrEqual(180); expect(y).toBeLessThanOrEqual(500)
    }
    const first = seats.find((seat) => seat.row === 0)!, second = seats.find((seat) => seat.row === 1)!
    expect(second.position[2] - first.position[2]).toBeCloseTo(1.2)
  })
})
