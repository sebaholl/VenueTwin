import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { createNationalTheatreStudy } from './nationalTheatreStudy'
import { generateSeatLayout, estimateCapacity } from './venue'
import { getSeatView } from './seatView'
import { levelArchitecture } from './levelGeometry'
import { blenderBlueprint } from './blenderBridge'

describe('multi-level study', () => {
  it('keeps legacy row heights unchanged', () => { const seat = generateSeatLayout(defaultVenue).find((s) => s.row === 4)!; expect(seat.position[1]).toBeCloseTo(.25 + 4 * defaultVenue.rake) })
  it('has five named levels and only estimated seat labels', () => { const c = createNationalTheatreStudy(); expect(c.seatingLevels).toHaveLength(5); expect(c.studyNotice).toContain('estimated'); expect(generateSeatLayout(c)).toHaveLength(estimateCapacity(c)) })
  it('combines level elevation with local row rise', () => { const c = createNationalTheatreStudy(); const seat = generateSeatLayout(c).find((s) => s.row === 11)!; expect(seat.position[1]).toBeCloseTo(.25 + 3.7 + .24) })
  it('places arc seats at the specified radius', () => { const c = createNationalTheatreStudy(); const row = generateSeatLayout(c).filter((s) => s.row === 10); for (const seat of row) expect(Math.hypot(seat.position[0], seat.position[2] + 1.8)).toBeCloseTo(10.6) })
  it('arc seats face towards their centre', () => { const c = createNationalTheatreStudy(); const s = generateSeatLayout(c).find((s) => s.row === 10)!; const dx = -Math.sin(s.rotation), dz = -Math.cos(s.rotation); expect(dx * s.position[0] + dz * (s.position[2] + 1.8)).toBeCloseTo(-10.6) })
  it('camera follows a balcony height edit', () => { const c = createNationalTheatreStudy(); const s = generateSeatLayout(c).find((s) => s.row === 10)!; const before = getSeatView(c, s)!; c.seatingLevels![1].elevation += 2; expect(getSeatView(c, s)!.position[1] - before.position[1]).toBeCloseTo(2) })
  it('leaves the central void open instead of filling it with a balcony slab', () => { const boxes = levelArchitecture(createNationalTheatreStudy()).filter((b) => b.name.startsWith('Balcony deck')); expect(boxes.length).toBeGreaterThan(100); expect(boxes.every((b) => b.size[2] < 1 && Math.hypot(b.position[0], b.position[2] + 1.8) > 10)).toBe(true) })
  it('uses the same structures in Blender and the live model', () => { const c = createNationalTheatreStudy(); const boxes = levelArchitecture(c); const blueprint = blenderBlueprint(c); expect(blueprint.boxes.slice(2, 2 + boxes.length)).toEqual(boxes); expect(blueprint.boxes.length).toBeLessThan(2000); expect(blueprint.seats.length).toBeLessThan(2000) })
  it('survives project JSON roundtrip', () => { const c = createNationalTheatreStudy(); expect(generateSeatLayout(JSON.parse(JSON.stringify(c)))).toEqual(generateSeatLayout(c)) })
})
