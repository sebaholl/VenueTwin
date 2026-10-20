import { expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { stageGeometry } from './stageGeometry'
import { blenderBlueprint } from './blenderBridge'
import { getSeatView, modelOffset } from './seatView'
import { geometrySignature, parseViewerConfig } from './customerViewer'
import { applyPilotPlan } from './studioPilot'
it('preserves legacy stage and screen geometry', () => {
  const boxes = blenderBlueprint(defaultVenue).boxes
  expect(boxes[0].size).toEqual([12, .45, 2.2])
  expect(boxes[1].position[2]).toBe(-3.25)
  expect(stageGeometry(defaultVenue).screenY).toBeCloseTo(2.7)
})
it('uses the same rotated screen centre for camera and Blender', () => {
  const config = { ...defaultVenue, stageDepth: 4.5, screenWidth: 9, screenHeight: 3.8, screenBottom: 1, stagePosition: { offsetX: 3, offsetY: 2, rotation: 35 } }
  const screen = blenderBlueprint(config).boxes[1]
  const camera = getSeatView(config, { row: 0, seat: 0, label: "A1" })!
  screen.position.forEach((v, i) => expect(camera.target[i]).toBeCloseTo(v + modelOffset[i]))
  expect(screen.size).toEqual([9, 3.8, .05])
  expect(geometrySignature(config)).not.toBe(geometrySignature(defaultVenue))
  expect(() => blenderBlueprint(config, true)).toThrow('general')
})
it('validates dimensions and applies partial Pilot updates', () => {
  expect(() => parseViewerConfig({ ...defaultVenue, stageDepth: -1 })).toThrow()
  const next = applyPilotPlan(defaultVenue, { summary: 'Stage', actions: [{ tool: 'set_stage_dimensions', depth: 4.5, screenWidth: 9, screenHeight: 3.8, screenBottom: null, basis: 'provided', source: 'Brief' }], questions: [], limitations: [], expectedSeatCount: null }, false)
  expect(next.stageDepth).toBe(4.5)
  expect(next.screenBottom).toBeUndefined()
  expect(next.stagePosition).toEqual(defaultVenue.stagePosition)
})
