import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { generateSeatLayout } from './venue'
import { assignRowRange, removeSeatingLevel, saveSeatingLevel } from './levelManagement'
const level = { id: 'balcony', name: 'Balcony', elevation: 4, parapetHeight: .8 }
describe('level management', () => {
  it('creates a level without adding or moving seats', () => {
    const config = saveSeatingLevel(defaultVenue, level)
    expect(generateSeatLayout(config)).toEqual(generateSeatLayout(defaultVenue))
  })
  it('assigns only the chosen rows and keeps their metadata', () => {
    const config = saveSeatingLevel({ ...defaultVenue, rowOverrides: { 2: { seats: 8, elevation: .5, accessibleSeats: { 0: true } } } }, level)
    const next = assignRowRange(config, 2, 3, level.id)
    expect(next.rowOverrides[2]).toMatchObject({ seats: 8, elevation: .5, levelId: level.id, accessibleSeats: { 0: true } })
    expect(next.rowOverrides[1]).toBeUndefined()
    expect(generateSeatLayout(next).find((seat) => seat.row === 2)?.position[1]).toBe(4.75)
  })
  it('preserves seat coordinates when removing a populated level', () => {
    const config = assignRowRange(saveSeatingLevel(defaultVenue, level), 1, 5, level.id)
    const next = removeSeatingLevel(config, level.id)
    expect(generateSeatLayout(next).map((seat) => seat.position)).toEqual(generateSeatLayout(config).map((seat) => seat.position))
    expect(next.seatingLevels).toEqual([])
  })
  it('rejects invalid ranges, dimensions and duplicate names', () => {
    const config = saveSeatingLevel(defaultVenue, level)
    expect(() => assignRowRange(config, 5, 2, level.id)).toThrow()
    expect(() => assignRowRange(config, 0, 2, 'missing')).toThrow()
    expect(() => saveSeatingLevel(config, { ...level, id: 'other', name: ' balcony ' })).toThrow()
    expect(() => saveSeatingLevel(config, { ...level, elevation: NaN })).toThrow()
  })
  it('blocks changes that would produce ambiguous ticket row labels', () => {
    const config = { ...defaultVenue, seatingLevels: [level], rowOverrides: { 0: { ticketRow: '1' }, 1: { ticketRow: '1', levelId: level.id } } }
    expect(() => removeSeatingLevel(config, level.id)).toThrow('Duplicate ticket row')
  })
})
