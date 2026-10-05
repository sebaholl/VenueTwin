import type { VenueConfig } from '../types/venue'
import { generateSeatLayout } from './venue'

export type ArchitectureBox = { name: string; position: number[]; size: number[]; rotation: number; color: string }

// Short rectangular segments follow each arc, leaving the centre open for stalls.
// Shared by the live viewer and Blender to avoid divergent geometry.
export function levelArchitecture(config: VenueConfig): ArchitectureBox[] {
  if (!config.seatingLevels?.length) return []
  const seats = generateSeatLayout(config), boxes: ArchitectureBox[] = []
  if (config.studyNotice) {
    const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
    const angle = stage.rotation * Math.PI / 180
    for (const side of [-1, 1]) boxes.push({ name: 'Estimated portal side', position: [stage.offsetX + side * config.stageWidth / 2 * Math.cos(angle) - 3.25 * Math.sin(angle), 3.1, stage.offsetY - side * config.stageWidth / 2 * Math.sin(angle) - 3.25 * Math.cos(angle)], size: [.55, 6.2, .7], rotation: angle, color: '#bca16b' })
    boxes.push({ name: 'Estimated portal top', position: [stage.offsetX - 3.25 * Math.sin(angle), 6.3, stage.offsetY - 3.25 * Math.cos(angle)], size: [config.stageWidth + .55, .5, .7], rotation: angle, color: '#bca16b' })
  }
  const seen = new Set<string>()
  for (let row = 0; row < config.rows; row++) {
    const override = config.rowOverrides[row] ?? {}
    const points = seats.filter((s) => s.row === row)
    if (!points.length) continue
    const floor = points[0].position[1] - .25
    const radius = override.arcRadius
    const first = !seen.has(override.levelId ?? '')
    seen.add(override.levelId ?? '')
    if (!radius) {
      const xs = points.map((s) => s.position[0]), zs = points.map((s) => s.position[2])
      boxes.push({ name: `Deck ${row + 1}`, position: [(Math.min(...xs) + Math.max(...xs)) / 2, floor - .12, (Math.min(...zs) + Math.max(...zs)) / 2], size: [Math.max(...xs) - Math.min(...xs) + .7, .24, Math.max(...zs) - Math.min(...zs) + (config.rowSpacing ?? .92)], rotation: 0, color: '#572c35' })
      continue
    }
    const span = (override.arcDegrees ?? 140) * Math.PI / 180
    const rotation = (override.rotation ?? 0) * Math.PI / 180
    const segments = 48
    for (let i = 0; i < segments; i++) {
      const theta = -span / 2 + (i + .5) * span / segments
      const angle = theta + rotation
      boxes.push({ name: `Balcony deck ${row + 1}/${i}`, position: [(override.offsetX ?? 0) + Math.sin(angle) * radius, floor - .14, (override.offsetY ?? 0) + Math.cos(angle) * radius], size: [radius * span / segments + .03, .28, .87], rotation: angle, color: '#572c35' })
      if (first) {
        const front = radius - .48
        boxes.push({ name: `Balcony parapet ${row + 1}/${i}`, position: [(override.offsetX ?? 0) + Math.sin(angle) * front, floor + .4, (override.offsetY ?? 0) + Math.cos(angle) * front], size: [front * span / segments + .03, .8, .12], rotation: angle, color: '#bca16b' })
      }
    }
  }
  return boxes
}
