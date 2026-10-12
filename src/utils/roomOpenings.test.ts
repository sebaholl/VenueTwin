import { expect, it } from 'vitest'
import { validateRoomOpenings, wallSegments } from './roomOpenings'
import { roomGeometry } from './roomGeometry'
import { blenderBlueprint } from './blenderBridge'
import { defaultVenue, type RoomOpening } from '../types/venue'
import { applyPilotPlan } from './studioPilot'
const room = { width: 10, depth: 20, height: 5, x: 1, z: 3, rotation: 30, ceiling: true, wallColor: '#444444', floorColor: '#222222' }
const opening: RoomOpening = { id: 'entry', wall: 'front', offset: 1, width: 2, height: 2, bottom: 0 }
const area = (pieces: ReturnType<typeof wallSegments>) => pieces.reduce((n,p) => n + p.width * p.height, 0)
it('cuts a doorway and a raised aperture with the expected remaining area', () => {
  expect(area(wallSegments(10, 5, [opening]))).toBeCloseTo(46)
  expect(area(wallSegments(10, 5, [{ ...opening, bottom: 1 }]))).toBeCloseTo(46)
  const raised = wallSegments(10, 5, [{ ...opening, bottom: 1 }])
  expect(raised.some((p) => p.offset === 1 && p.bottom === 0 && p.height === 1)).toBe(true)
})
it('subtracts overlapping apertures as a union', () => {
  expect(area(wallSegments(10, 5, [opening, { ...opening, id: 'other', offset: 2 }]))).toBeCloseTo(44)
  expect(area(wallSegments(10, 5, [opening, { ...opening, id: 'other', bottom: 1 }]))).toBeCloseTo(44)
})
it('supports touching full-height openings without zero-sized solids', () => {
  const holes = [{ ...opening, offset: -2.5, width: 5, height: 5 }, { ...opening, id: 'b', offset: 2.5, width: 5, height: 5 }]
  expect(wallSegments(10, 5, holes)).toEqual([])
})
it('rejects out-of-bounds, duplicate, non-finite and oversized lists', () => {
  for (const value of [[{ ...opening, offset: 5 }], [{ ...opening, bottom: 4 }], [opening, opening], [{ ...opening, width: NaN }], Array.from({length:21},(_,i)=>({...opening,id:String(i)}))]) expect(() => validateRoomOpenings(value, room)).toThrow()
  expect(validateRoomOpenings([{ ...opening, wall: 'left', offset: 8 }], room)).toHaveLength(1)
})
it('uses identical transformed solids in Studio and Blender', () => {
  const config = { ...defaultVenue, room: { ...room, openings: [opening] } }
  expect(blenderBlueprint(config).boxes.filter((b) => b.name.startsWith('VT_ROOM_'))).toEqual(roomGeometry(config))
  const walls = roomGeometry(config).filter((b) => b.name.startsWith('VT_ROOM_SHELL_END_-1'))
  expect(walls).toHaveLength(3)
  walls.forEach((b) => { expect(b.rotation).toBeCloseTo(Math.PI / 6); expect(b.size.every((n) => n > 0)).toBe(true) })
})
it('preserves openings on room updates and rejects a shrink that would cut them off', () => {
  const base = { ...defaultVenue, room: { ...room, openings: [opening] } }
  const header = { summary: 'Room', questions: [], limitations: [], expectedSeatCount: null }
  const action = { tool: 'set_room' as const, room: { ...room, height: 6 }, basis: 'provided' as const, source: 'Brief' }
  expect(applyPilotPlan(base, { ...header, actions: [action] }, false).room?.openings).toEqual([opening])
  expect(() => applyPilotPlan(base, { ...header, actions: [{ ...action, room: { ...room, height: 1 } }] }, false)).toThrow('beyond')
})
it('upserts and removes openings through validated Pilot actions', () => {
  const header = { summary: 'Opening', questions: [], limitations: [], expectedSeatCount: null }
  const save = { tool: 'save_room_opening' as const, opening, basis: 'provided' as const, source: 'Plan' }
  expect(() => applyPilotPlan(defaultVenue, { ...header, actions: [save] }, false)).toThrow('Create the room')
  const next = applyPilotPlan({ ...defaultVenue, room }, { ...header, actions: [save, { ...save, opening: { ...opening, width: 1 } }] }, false)
  expect(next.room?.openings).toHaveLength(1)
  expect(next.room?.openings?.[0].width).toBe(1)
  expect(applyPilotPlan(next, { ...header, actions: [{ tool: 'remove_room_opening', id: 'entry', basis: 'provided', source: 'Remove request' }] }, false).room?.openings).toEqual([])
})
it('rejects wall slivers below the Blender minimum size', () => {
  expect(() => validateRoomOpenings([{ ...opening, offset: 3.9999 }], room)).toThrow('1 mm')
})
