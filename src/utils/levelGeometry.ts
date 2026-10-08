import type { VenueConfig } from '../types/venue'
import { generatePhysicalSeatLayout } from './venue'

export type ArchitectureBox = { name: string; position: number[]; size: number[]; rotation: number; color: string }

export function rowHasFrontRailing(config: VenueConfig, row: number) {
  const override = config.rowOverrides[row] ?? {}
  if (typeof override.frontRailing === 'boolean') return override.frontRailing
  const first = !Array.from({ length: row }, (_, index) => config.rowOverrides[index]?.levelId).includes(override.levelId)
  const level = config.seatingLevels?.find((item) => item.id === override.levelId)
  return first && (!!override.arcRadius || (level?.elevation ?? 0) > 0)
}

// Short rectangular segments follow each arc, leaving the centre open for stalls.
// Shared by the live viewer and Blender to avoid divergent geometry.
export function levelArchitecture(config: VenueConfig): ArchitectureBox[] {
  if (!config.seatingLevels?.length) return []
  const seats = generatePhysicalSeatLayout(config), boxes: ArchitectureBox[] = []
  if (config.studyNotice) {
    const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
    const angle = stage.rotation * Math.PI / 180
    for (const side of [-1, 1]) boxes.push({ name: 'Estimated portal side', position: [stage.offsetX + side * config.stageWidth / 2 * Math.cos(angle) - 3.25 * Math.sin(angle), 3.1, stage.offsetY - side * config.stageWidth / 2 * Math.sin(angle) - 3.25 * Math.cos(angle)], size: [.55, 6.2, .7], rotation: angle, color: '#bca16b' })
    boxes.push({ name: 'Estimated portal top', position: [stage.offsetX - 3.25 * Math.sin(angle), 6.3, stage.offsetY - 3.25 * Math.cos(angle)], size: [config.stageWidth + .55, .5, .7], rotation: angle, color: '#bca16b' })
  }
  for (let row = 0; row < config.rows; row++) {
    const override = config.rowOverrides[row] ?? {}
    const points = seats.filter((s) => s.row === row)
    if (!points.length) continue
    const floor = points[0].position[1] - .25
    const radius = override.arcRadius
    const railing = rowHasFrontRailing(config, row)
    if (!radius) {
      const rotation = (override.rotation ?? 0) * Math.PI / 180
      const cos = Math.cos(rotation), sin = Math.sin(rotation)
      // Work in the row's local frame, then transform back. World-axis bounds
      // made rotated rows acquire large rectangular slabs across adjacent aisles.
      const local = points.map((seat) => ({ x: seat.position[0] * cos - seat.position[2] * sin, z: seat.position[0] * sin + seat.position[2] * cos }))
      const minX = Math.min(...local.map((point) => point.x)) - .35, maxX = Math.max(...local.map((point) => point.x)) + .35
      const minZ = Math.min(...local.map((point) => point.z)) - (config.rowSpacing ?? .92) / 2, maxZ = Math.max(...local.map((point) => point.z)) + (config.rowSpacing ?? .92) / 2
      const x = (minX + maxX) / 2, z = (minZ + maxZ) / 2
      boxes.push({ name: `Deck ${row + 1}`, position: [x * cos + z * sin, floor - .12, -x * sin + z * cos], size: [maxX - minX, .24, maxZ - minZ], rotation, color: '#572c35' })
      if (railing) {
        const height = config.seatingLevels?.find((level) => level.id === override.levelId)?.parapetHeight ?? .8
        boxes.push({ name: `Straight parapet ${row + 1}`, position: [x * cos + minZ * sin, floor + height / 2, -x * sin + minZ * cos], size: [maxX - minX, height, .12], rotation, color: '#bca16b' })
      }
      continue
    }
    const span = (override.arcDegrees ?? 140) * Math.PI / 180
    const rotation = (override.rotation ?? 0) * Math.PI / 180
    const segments = 48
    for (let i = 0; i < segments; i++) {
      const theta = -span / 2 + (i + .5) * span / segments
      const angle = theta + rotation
      boxes.push({ name: `Balcony deck ${row + 1}/${i}`, position: [(override.offsetX ?? 0) + Math.sin(angle) * radius, floor - .14, (override.offsetY ?? 0) + Math.cos(angle) * radius], size: [radius * span / segments + .03, .28, .87], rotation: angle, color: '#572c35' })
      if (railing) {
        const front = radius - .48
        const height = config.seatingLevels?.find((l) => l.id === override.levelId)?.parapetHeight ?? .8
        boxes.push({ name: `Balcony parapet ${row + 1}/${i}`, position: [(override.offsetX ?? 0) + Math.sin(angle) * front, floor + height / 2, (override.offsetY ?? 0) + Math.cos(angle) * front], size: [front * span / segments + .03, height, .12], rotation: angle, color: '#bca16b' })
      }
    }
  }
  return boxes
}
