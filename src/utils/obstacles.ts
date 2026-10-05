import type { VenueConfig, VenueObstacle } from '../types/venue'

const bounded = (v: unknown, fallback: number, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
export function getObstacles(config: VenueConfig): VenueObstacle[] {
  if (!Array.isArray(config.obstacles)) return []
  const seen = new Set<string>()
  return config.obstacles.filter((o) => {
    if (!o || typeof o.id !== 'string' || seen.has(o.id)) return false
    seen.add(o.id); return true
  }).slice(0, 50).map((o) => ({
    id: o.id, name: typeof o.name === 'string' ? o.name.slice(0, 60) : 'Obstacle',
    kind: o.kind === 'column' || o.kind === 'railing' ? o.kind : 'wall',
    x: bounded(o.x, 0, -50, 50), z: bounded(o.z, 0, -50, 50), elevation: bounded(o.elevation, 0, 0, 30),
    width: bounded(o.width, .5, .05, 50), depth: bounded(o.depth, .5, .05, 50), height: bounded(o.height, 3, .1, 30), rotation: bounded(o.rotation, 0, -180, 180),
  }))
}
export function newObstacle(kind: VenueObstacle['kind']): VenueObstacle {
  return { id: crypto.randomUUID(), name: kind === 'column' ? 'Column' : kind === 'wall' ? 'Wall' : 'Railing', kind, x: 0, z: -1, elevation: 0, width: kind === 'column' ? .5 : 4, depth: kind === 'column' ? .5 : .15, height: kind === 'railing' ? 1.1 : 3, rotation: 0 }
}

// SVG y increases along world z, reversing the sign of a Three.js Y rotation.
export function obstaclePlanTransform(o: VenueObstacle) {
  return `translate(${500 + o.x * 24} ${150 + o.z * 24}) rotate(${-o.rotation})`
}

export function obstacleBoxes(o: VenueObstacle) {
  if (o.kind !== 'railing') return [{ x: 0, y: o.height / 2, width: o.width, height: o.height, depth: o.depth }]
  const thickness = Math.min(.06, o.height / 3, o.width / 3)
  const count = Math.max(2, Math.ceil(o.width / 1.2) + 1)
  return [
    { x: 0, y: o.height - thickness / 2, width: o.width, height: thickness, depth: o.depth },
    ...Array.from({ length: count }, (_, i) => ({ x: -o.width / 2 + thickness / 2 + i * (o.width - thickness) / (count - 1), y: o.height / 2, width: thickness, height: o.height, depth: o.depth })),
  ]
}
