import { expect, it } from 'vitest'
import { defaultVenue, type VenueConfig } from '../types/venue'
import { roomGeometry } from './roomGeometry'
import { blenderBlueprint } from './blenderBridge'
import { geometrySignature, parseViewerConfig } from './customerViewer'
import { applyPilotPlan } from './studioPilot'
import { layoutChecks } from './layoutChecks'
const room = { width: 16, depth: 24, height: 8, x: 2, z: 7, rotation: 90, ceiling: true, wallColor: '#433c43', floorColor: '#292d35' }
const config: VenueConfig = { ...defaultVenue, room }
it('preserves legacy projects without room geometry', () => { expect(roomGeometry(defaultVenue)).toEqual([]) })
it('keeps wall thickness outside the interior dimensions and rotates around the room centre', () => {
  const boxes = roomGeometry(config)
  expect(boxes).toHaveLength(6)
  const side = boxes.find((b) => b.name === 'VT_ROOM_SHELL_SIDE_1')!
  expect(side.position[0]).toBeCloseTo(2)
  expect(side.position[2]).toBeCloseTo(7 - 8.1)
  expect(side.size).toEqual([.2, 8, 24.4])
  expect(boxes.find((b) => b.name.endsWith('CEILING'))?.position[1]).toBe(8.1)
})
it('exports the same boxes to Blender and invalidates a previously built model', () => {
  expect(blenderBlueprint(config).boxes.filter((b) => b.name.startsWith('VT_ROOM_'))).toEqual(roomGeometry(config))
  expect(geometrySignature(config)).not.toBe(geometrySignature(defaultVenue))
  expect(() => blenderBlueprint(config, true)).toThrow('general')
})
it('rejects invalid dimensions, colours and missing fields', () => {
  for (const patch of [{height: 0}, {width: Infinity}, {wallColor: 'url(test)'}, {ceiling: undefined}]) expect(() => parseViewerConfig({ ...config, room: { ...room, ...patch } })).toThrow('room')
})
it('applies and removes a room without moving seats', () => {
  const plan = { summary: 'Room', questions: [], limitations: [], expectedSeatCount: null }
  const next = applyPilotPlan(defaultVenue, { ...plan, actions: [{ tool: 'set_room', room, basis: 'provided', source: 'Test brief' }] }, false)
  expect(next.room).toEqual(room)
  expect(next.rowOverrides).toEqual(defaultVenue.rowOverrides)
  expect(applyPilotPlan(next, { ...plan, actions: [{ tool: 'remove_room', basis: 'provided', source: 'Remove request' }] }, false).room).toBeUndefined()
})
it('flags seats outside a small room without labelling missing rooms as errors', () => {
  expect(layoutChecks({ ...config, room: { ...room, width: 1, depth: 1, height: 1 } }).find((f) => f.id === 'room-bounds')?.count).toBeGreaterThan(0)
  expect(layoutChecks(defaultVenue).find((f) => f.id === 'room-bounds')).toBeUndefined()
})
