import { describe, expect, it } from 'vitest'
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
import { defaultVenue, type VenueObstacle } from '../types/venue'
import { getObstacles, newObstacle, obstacleBoxes, obstaclePlanTransform } from './obstacles'
import { renderVenuePlanSvg } from './projectExport'

const column: VenueObstacle = { id: 'column', name: 'Column', kind: 'column', x: 0, z: -1, elevation: 0, width: .5, depth: .5, height: 3, rotation: 0 }
describe('venue obstacles', () => {
  it('leaves older projects unchanged', () => expect(getObstacles(defaultVenue)).toEqual([]))
  it('creates independent presets', () => { const a = newObstacle('column'), b = newObstacle('railing'); expect(a.id).not.toBe(b.id); expect(b.height).toBe(1.1); expect(a.width).toBe(.5) })
  it('sanitizes invalid dimensions and duplicate IDs', () => {
    const items = getObstacles({ ...defaultVenue, obstacles: [{ ...column, width: -4, height: Infinity, x: NaN }, column] })
    expect(items).toHaveLength(1); expect(items[0]).toMatchObject({ width: .05, height: 3, x: 0 })
  })
  it('caps geometry and obstacle counts', () => { expect(getObstacles({ ...defaultVenue, obstacles: Array.from({ length: 100 }, (_, i) => ({ ...column, id: String(i), width: 999 })) })).toHaveLength(50) })
  it('uses matching plan translation and rotation handedness', () => expect(obstaclePlanTransform({ ...column, x: 2, z: 3, rotation: 90 })).toBe('translate(548 222) rotate(-90)'))
  it('builds open railings with no solid panel', () => {
    const boxes = obstacleBoxes({ ...column, kind: 'railing', width: 4, height: 1.1 })
    expect(boxes[0].height).toBe(.06); expect(boxes.slice(1).every((b) => b.width === .06)).toBe(true)
    expect(boxes.every((b) => b.y + b.height / 2 <= 1.1)).toBe(true)
  })
  it('a column blocks the centre sightline while one to the side does not', () => {
    function intersects(x: number) {
      const o = { ...column, x }; const group = new Group(); group.position.set(o.x, o.elevation, o.z)
      const material = new MeshBasicMaterial()
      for (const b of obstacleBoxes(o)) { const mesh = new Mesh(new BoxGeometry(b.width, b.height, b.depth), material); mesh.position.set(b.x, b.y, 0); group.add(mesh) }
      group.updateMatrixWorld(true)
      const hits = new Raycaster(new Vector3(0, 1.15, 2), new Vector3(0, 0, -1), 0, 5).intersectObject(group, true).length
      group.children.forEach((child) => (child as Mesh).geometry.dispose()); material.dispose()
      return hits > 0
    }
    expect(intersects(0)).toBe(true); expect(intersects(3)).toBe(false)
  })
  it('persists through JSON and escapes names in export', () => {
    const config = { ...defaultVenue, obstacles: [{ ...column, name: '<script>alert(1)</script>' }] }
    expect(getObstacles(JSON.parse(JSON.stringify(config)))).toEqual(getObstacles(config))
    const svg = renderVenuePlanSvg(config); expect(svg).toContain('&lt;script&gt;'); expect(svg).not.toContain('<script>'); expect(svg).toContain('translate(500 126)')
  })
})
