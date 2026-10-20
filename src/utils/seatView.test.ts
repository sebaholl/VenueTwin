import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { generateSeatLayout } from './venue'
import { getSeatView, lookDirection, modelOffset } from './seatView'

const selected = { row: 2, seat: 3, label: 'C4' }
describe('seat-level camera', () => {
  it('requires an existing seat', () => { expect(getSeatView(defaultVenue, null)).toBeNull(); expect(getSeatView(defaultVenue, { ...selected, row: 99 })).toBeNull() })
  it('positions the eye above the selected row floor', () => {
    const seat = generateSeatLayout(defaultVenue).find((s) => s.row === 2 && s.seat === 3)!
    const view = getSeatView(defaultVenue, selected)!
    expect(view.position[0]).toBe(seat.position[0]); expect(view.position[1]).toBeCloseTo(2 * defaultVenue.rake + 1.15 + modelOffset[1]); expect(view.position[2]).toBeCloseTo(seat.position[2] + modelOffset[2])
  })
  it('tracks row translations and rotation', () => {
    const config = { ...defaultVenue, rowOverrides: { 2: { offsetX: 4, offsetY: 2, rotation: 35 } } }
    const seat = generateSeatLayout(config).find((s) => s.row === 2 && s.seat === 3)!
    expect(getSeatView(config, selected)!.position[0]).toBe(seat.position[0])
    expect(getSeatView(config, selected)!.position[2]).toBeCloseTo(seat.position[2] - 2.8)
  })
  it('aims at the rotated screen in world coordinates', () => {
    const view = getSeatView({ ...defaultVenue, stagePosition: { offsetX: 5, offsetY: 2, rotation: 90 } }, selected)!
    expect(view.target[0]).toBeCloseTo(1.75); expect(view.target[2]).toBeCloseTo(-.8)
    const direction = lookDirection(view.yaw, view.pitch)
    const delta = view.target.map((v, i) => v - view.position[i]); const length = Math.hypot(...delta)
    direction.forEach((v, i) => expect(v).toBeCloseTo(delta[i] / length))
  })
  it('eye height changes only vertical position', () => {
    const low = getSeatView(defaultVenue, selected, .95)!, high = getSeatView(defaultVenue, selected, 1.35)!
    expect(high.position[1] - low.position[1]).toBeCloseTo(.4); expect(high.position[0]).toBe(low.position[0]); expect(high.position[2]).toBe(low.position[2])
  })
  it('limits vertical rotation and keeps direction normalized', () => { const d = lookDirection(12, 99); expect(Math.hypot(...d)).toBeCloseTo(1); expect(d.every(Number.isFinite)).toBe(true); expect(d[1]).toBeLessThan(1) })
})
