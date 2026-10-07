import { describe, expect, it } from 'vitest'
import { createNationalTheatreSeatingStudy, hasSourcedStallsNumbering, ND_STALLS_COUNTS } from './nationalTheatreSeating'
import { createNationalTheatreStudy } from './nationalTheatreStudy'
import { generateSeatLayout, getRowLabel, getSeatLabel } from './venue'
import { geometrySignature, parseViewerConfig } from './customerViewer'
import { blenderBlueprint } from './blenderBridge'

describe('official stalls numbering', () => {
  it('transcribes all 13 numbered stalls rows without the two row-7 service places', () => {
    const c = createNationalTheatreSeatingStudy()
    const seats = generateSeatLayout(c).filter((s) => c.rowOverrides[s.row].levelId === 'stalls')
    expect(ND_STALLS_COUNTS).toEqual([21, 22, 21, 22, 21, 22, 19, 22, 21, 20, 19, 18, 15])
    expect(seats).toHaveLength(263)
    expect(seats.filter((s) => s.row === 6).at(-1)?.label).toBe('Parterre · 7/19')
    expect(seats.at(-1)?.label).toBe('Parterre · 13/15')
    expect(Array.from({ length: 13 }, (_, row) => hasSourcedStallsNumbering(c, row))).not.toContain(false)
  })
  it('keeps the original study unchanged and upper tiers without a verified claim', () => {
    const original = createNationalTheatreStudy(), c = createNationalTheatreSeatingStudy()
    expect(original.rows).toBe(24)
    expect(generateSeatLayout(original)).toHaveLength(862)
    expect(c.rows).toBe(27)
    expect(hasSourcedStallsNumbering(c, 13)).toBe(false)
    expect(getRowLabel(c, 26)).toBe('AA')
    expect(new Set(generateSeatLayout(c).map((s) => s.label)).size).toBe(887)
  })
  it('withdraws the source claim when counts, levels or row identities change', () => {
    const c = createNationalTheatreSeatingStudy()
    c.rowOverrides[0].seats = 20
    expect(hasSourcedStallsNumbering(c, 0)).toBe(false)
    c.rowOverrides[1].levelId = 'balcony1'
    expect(hasSourcedStallsNumbering(c, 1)).toBe(false)
    c.rowOverrides[2].ticketRow = '13'
    expect(hasSourcedStallsNumbering(c, 12)).toBe(false)
  })
  it('rejects duplicate or malformed labels in published files', () => {
    const c = createNationalTheatreSeatingStudy()
    c.rowOverrides[1].ticketRow = '1'
    expect(() => parseViewerConfig(c)).toThrow('Duplicate')
    c.rowOverrides[1].ticketRow = ' '.repeat(31)
    expect(() => parseViewerConfig(c)).toThrow('Invalid ticket')
  })
  it('roundtrips into the viewer and exports exactly matching Blender seat transforms', () => {
    const c = parseViewerConfig(JSON.parse(JSON.stringify(createNationalTheatreSeatingStudy())))
    const seats = generateSeatLayout(c)
    expect(blenderBlueprint(c, true).seats).toEqual(seats.map(({ row, seat, label, position, rotation }) => ({ row, seat, label, position, rotation })))
    expect(geometrySignature(c)).not.toBe(geometrySignature(createNationalTheatreStudy()))
    expect(getSeatLabel(c, 0, 0)).toBe(seats[0].label)
  })
  it('curves both sides of the stalls towards the stage symmetrically', () => {
    const c = createNationalTheatreSeatingStudy()
    const row = generateSeatLayout(c).filter((s) => s.row === 0)
    for (let i = 0; i < row.length; i++) {
      const opposite = row[row.length - 1 - i]
      expect(row[i].position[0]).toBeCloseTo(-opposite.position[0])
      expect(row[i].position[2]).toBeCloseTo(opposite.position[2])
      expect(row[i].rotation).toBeCloseTo(-opposite.rotation)
    }
    expect(row[0].position[2]).toBeLessThan(row[10].position[2])
  })
})
