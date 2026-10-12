import { expect, it } from 'vitest'
import { architecturalDetailGeometry, type ArchitecturalDetail } from './architecturalDetails'
import { defaultVenue } from '../types/venue'
import { applyPilotPlan } from './studioPilot'
import { blenderBlueprint } from './blenderBridge'
import { geometrySignature, parseViewerConfig } from './customerViewer'
import { roomGeometry } from './roomGeometry'
const detail: ArchitecturalDetail = { id: 'panel', name: 'Side panel', kind: 'panel', x: 0, z: 0, bottom: 1, width: 2, height: 3, depth: .2, rotation: 0, color: '#333333', trimColor: '#bb8844', trim: .1, radius: null, span: null, segments: 1, roughness: .8, metalness: 0, trimRoughness: .3, trimMetalness: .7, basis: 'estimated', source: 'Illustrative test fixture, not a measured venue' }
it('shares transformed geometry and surfaces between live Studio and Blender', () => {
  const d = { ...detail, x: 5, z: 3, rotation: 90 }
  const config = { ...defaultVenue, architecturalDetails: [d] }
  const boxes = roomGeometry(config)
  expect(boxes).toHaveLength(5)
  expect(boxes[0].position).toEqual([5, 2.5, 3])
  expect(boxes[1].position[0]).toBeCloseTo(4.9)
  expect(boxes[1].position[2]).toBeCloseTo(3.95)
  expect(boxes[1]).toMatchObject({ roughness: .3, metalness: .7 })
  expect(blenderBlueprint(config).boxes.filter((b) => b.name.startsWith('VT_DETAIL_'))).toEqual(boxes)
  expect(() => blenderBlueprint(config, true)).toThrow('general')
})
it('preserves separate material properties even with identical colours', () => {
  const boxes = architecturalDetailGeometry([{ ...detail, trimColor: detail.color }])
  expect(boxes[0].metalness).toBe(0)
  expect(boxes[1].metalness).toBe(.7)
})
it('creates open portals, downward coffers, faceted columns and curved fascia within budget', () => {
  for (const kind of ['portal', 'coffer', 'column', 'curved-wall'] as const) {
    const d = { ...detail, kind, depth: .8, segments: kind === 'column' || kind === 'curved-wall' ? 24 : 1, radius: kind === 'curved-wall' ? 10 : null, span: kind === 'curved-wall' ? 120 : null }
    const boxes = architecturalDetailGeometry([d])
    expect(boxes.length).toBeGreaterThan(2)
    expect(boxes.every((b) => b.size.every((s) => s >= .001) && b.position.every(Number.isFinite))).toBe(true)
    if (kind === 'coffer') expect(boxes.every((b) => b.name.startsWith('VT_ROOM_SHELL_'))).toBe(true)
    if (kind === 'portal') expect(boxes.every((b) => Math.abs(b.position[0]) > .5 || b.position[1] > 3)).toBe(true)
    if (kind === 'curved-wall') expect(Math.hypot(boxes[0].position[0], boxes[0].position[2])).toBeCloseTo(10)
  }
})
it('rejects corrupt details and excessive geometry before rendering or exporting', () => {
  for (const d of [{ ...detail, width: 0 }, { ...detail, trim: 1 }, { ...detail, roughness: 2 }, { ...detail, source: '' }, { ...detail, radius: 2 }, { ...detail, segments: 48 }]) expect(() => parseViewerConfig({ ...defaultVenue, architecturalDetails: [d] })).toThrow()
  expect(() => architecturalDetailGeometry([detail, detail])).toThrow('distinct')
  const curves = Array.from({ length: 20 }, (_, i) => ({ ...detail, id: String(i), kind: 'curved-wall' as const, radius: 10, span: 120, segments: 48 }))
  expect(() => architecturalDetailGeometry(curves)).toThrow('budget')
})
it('retains evidence, gates estimates, invalidates models and removes only named components', () => {
  const { basis, source, ...shape } = detail
  const action = { tool: 'save_architectural_detail', detail: shape, basis, source }
  const plan = { summary: 'Add one test panel', actions: [action], questions: [], limitations: [], expectedSeatCount: null }
  expect(() => applyPilotPlan(defaultVenue, plan, false)).toThrow('estimates')
  const next = applyPilotPlan(defaultVenue, plan, true)
  expect(next.architecturalDetails).toEqual([detail])
  expect(geometrySignature(next)).not.toBe(geometrySignature(defaultVenue))
  const removed = applyPilotPlan(next, { ...plan, actions: [{ tool: 'remove_architectural_detail', id: detail.id, basis: 'provided', source: 'Explicit removal request' }] }, false)
  expect(removed.architecturalDetails).toEqual([])
  expect(geometrySignature(removed)).toBe(geometrySignature(defaultVenue))
  expect(next.architecturalDetails).toHaveLength(1)
})
