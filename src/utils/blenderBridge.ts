import type { VenueConfig } from '../types/venue'
import { generateSeatLayout, generatePhysicalSeatLayout } from './venue'
import { projectSlug } from './projectExport'
import { levelArchitecture } from './levelGeometry'

type Box = { name: string; position: number[]; size: number[]; rotation: number; color: string }
export function blenderBlueprint(config: VenueConfig, detailed = false) {
  if (detailed && Object.values(config.rowOverrides).some((row) => typeof row.frontRailing === 'boolean')) throw new Error('Custom row railings require the general Blender scene export.')
  const seats = generateSeatLayout(config)
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const angle = stage.rotation * Math.PI / 180
  const stagePoint = (z: number, y: number) => [stage.offsetX + Math.sin(angle) * z, y, stage.offsetY + Math.cos(angle) * z]
  const boxes: Box[] = [
    { name: 'Stage', position: stagePoint(-2.2, 0), size: [config.stageWidth, .45, 2.2], rotation: angle, color: '#17243a' },
    { name: 'Screen / curtain reference', position: stagePoint(-3.25, 2.7), size: [config.stageWidth * .84, 4.6, .05], rotation: angle, color: config.studyNotice ? '#702b3b' : '#e8f0f3' },
  ]
  boxes.push(...levelArchitecture(config))
  for (let row = 0; !config.seatingLevels?.length && row < config.rows; row++) {
    const points = seats.filter((s) => s.row === row)
    if (!points.length) continue
    const xs = points.map((s) => s.position[0]), zs = points.map((s) => s.position[2])
    const height = row * config.rake + .1
    boxes.push({ name: `Approximate row deck ${row + 1}`, position: [(Math.min(...xs) + Math.max(...xs)) / 2, height / 2 - .1, (Math.min(...zs) + Math.max(...zs)) / 2], size: [Math.max(...xs) - Math.min(...xs) + .8, height, Math.max(...zs) - Math.min(...zs) + (config.rowSpacing ?? .92)], rotation: 0, color: '#253447' })
  }
  const xs = [...seats.map((s) => s.position[0]), -config.stageWidth / 2 + stage.offsetX, config.stageWidth / 2 + stage.offsetX]
  const zs = [...seats.map((s) => s.position[2]), stage.offsetY - 5]
  boxes.push({ name: 'Base floor', position: [(Math.min(...xs) + Math.max(...xs)) / 2, -.22, (Math.min(...zs) + Math.max(...zs)) / 2], size: [Math.max(...xs) - Math.min(...xs) + 4, .2, Math.max(...zs) - Math.min(...zs) + 4], rotation: 0, color: '#111e2b' })
  const detail = detailed && config.studyNotice && config.seatingLevels?.length ? {
    profile: 'nd-photo-study-v1', stageWidth: config.stageWidth, stage,
    rows: Array.from({ length: config.rows }, (_, row) => {
      const points = seats.filter((seat) => seat.row === row)
      return { ...config.rowOverrides[row], parapetHeight: config.seatingLevels?.find((l) => l.id === config.rowOverrides[row]?.levelId)?.parapetHeight ?? .8, floor: points[0]?.position[1] - .25, row }
    }),
  } : undefined
  return { format: 'venuetwin-blender', version: 1, name: config.name, studyNotice: config.studyNotice, units: 'metres', axes: 'three-y-up', detail, boxes, serviceSeats: generatePhysicalSeatLayout(config).filter((s) => s.service), seats: seats.map((s) => ({ row: s.row, seat: s.seat, label: s.label, position: s.position, rotation: s.rotation })) }
}

export function downloadBlenderBlueprint(config: VenueConfig, detailed = false) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(blenderBlueprint(config, detailed), null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${projectSlug(config.name)}.venuetwin-blender.json`; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
