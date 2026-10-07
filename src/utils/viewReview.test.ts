import { describe, it, expect } from 'vitest'
import { createNationalTheatreSeatingStudy } from './nationalTheatreSeating'
import { generateSeatLayout } from './venue'
import { geometrySignature, parseViewerConfig } from './customerViewer'
import { offsetSeating, representativeSeats } from './viewReview'
import { levelArchitecture } from './levelGeometry'
import { blenderBlueprint } from './blenderBridge'
import { getSeatView } from './seatView'

describe('view comparison drafts', () => {
  it('offers three model viewpoints without choosing a service place', () => {
    const views = representativeSeats(createNationalTheatreSeatingStudy())
    expect(views).toHaveLength(3)
    expect(views.every((v) => v.seat && !v.seat.service)).toBe(true)
    expect(views[1].seat.row).toBe(13)
  })
  it('moves every row by the same setback without mutating the project or moving the stage', () => {
    const c = createNationalTheatreSeatingStudy(), before = JSON.stringify(c), draft = offsetSeating(c, 1.5)
    const original = generateSeatLayout(c), shifted = generateSeatLayout(draft)
    expect(JSON.stringify(c)).toBe(before)
    expect(draft.stagePosition).toEqual(c.stagePosition)
    shifted.forEach((s, i) => { expect(s.position[2] - original[i].position[2]).toBeCloseTo(1.5); expect(s.label).toBe(original[i].label) })
  })
  it('updates the camera when a level height changes', () => {
    const c = createNationalTheatreSeatingStudy(), seat = representativeSeats(c)[1].seat
    const before = getSeatView(c, seat)!
    c.seatingLevels![1].elevation += .3
    expect(getSeatView(c, seat)!.position[1] - before.position[1]).toBeCloseTo(.3)
  })
  it('exports a parapet edit to Blender and invalidates the attached model signature', () => {
    const c = createNationalTheatreSeatingStudy(), before = geometrySignature(c)
    c.seatingLevels![1].parapetHeight = 1.2
    const parapets = levelArchitecture(c).filter((b) => b.name.startsWith('Balcony parapet 14/'))
    expect(parapets).toHaveLength(48)
    expect(parapets.every((b) => b.size[1] === 1.2)).toBe(true)
    expect(blenderBlueprint(c, true).detail?.rows[13].parapetHeight).toBe(1.2)
    expect(geometrySignature(c)).not.toBe(before)
    expect(parseViewerConfig(c).seatingLevels![1].parapetHeight).toBe(1.2)
    c.seatingLevels![1].parapetHeight = -1
    expect(() => parseViewerConfig(c)).toThrow('Invalid seating levels')
  })
})
