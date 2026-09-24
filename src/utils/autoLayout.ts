import type { PlanPoint, RowOverride, VenueConfig } from '../types/venue'

const pixelsPerMeter = 24

export type AutoLayoutResult = {
  rows: number
  capacity: number
  rowOverrides: Record<number, RowOverride>
}

function rotate(point: PlanPoint, center: PlanPoint, degrees: number): PlanPoint {
  const angle = degrees * Math.PI / 180
  const x = point.x - center.x
  const y = point.y - center.y
  return { x: center.x + x * Math.cos(angle) - y * Math.sin(angle), y: center.y + x * Math.sin(angle) + y * Math.cos(angle) }
}

function horizontalIntersections(polygon: PlanPoint[], y: number) {
  const intersections: number[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    if ((start.y <= y && end.y > y) || (end.y <= y && start.y > y)) {
      intersections.push(start.x + ((y - start.y) / (end.y - start.y)) * (end.x - start.x))
    }
  }
  return intersections.sort((a, b) => a - b)
}

export function generateAutoLayout(config: VenueConfig, boundary = config.planBoundary ?? []): AutoLayoutResult {
  if (boundary.length < 3) return { rows: 0, capacity: 0, rowOverrides: {} }

  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const stageCenter = { x: 500 + stage.offsetX * pixelsPerMeter, y: 76 + stage.offsetY * pixelsPerMeter }
  const rotation = stage.rotation
  const aligned = boundary.map((point) => rotate(point, stageCenter, -rotation))
  const minY = Math.min(...aligned.map((point) => point.y))
  const maxY = Math.max(...aligned.map((point) => point.y))
  const rowSpacing = Math.max(0.5, config.rowSpacing ?? 0.92) * pixelsPerMeter
  const seatSpacing = Math.max(0.45, config.seatSpacing ?? 0.72) * pixelsPerMeter
  const clearance = Math.max(0, config.edgeClearance ?? 0.6) * pixelsPerMeter
  const aisleWidth = Math.max(0, config.aisleWidth ?? 0.9) * pixelsPerMeter
  const sections = Math.max(1, Math.min(3, config.sectors))
  const candidates: Array<{ center: PlanPoint; seats: number }> = []

  for (let y = minY + clearance; y <= maxY - clearance; y += rowSpacing) {
    const intersections = horizontalIntersections(aligned, y)
    let best: [number, number] | null = null
    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const interval: [number, number] = [intersections[index] + clearance, intersections[index + 1] - clearance]
      if (interval[1] > interval[0] && (!best || interval[1] - interval[0] > best[1] - best[0])) best = interval
    }
    if (!best) continue
    const usableWidth = best[1] - best[0] - (sections - 1) * aisleWidth
    const seats = Math.floor(usableWidth / seatSpacing) + 1
    if (seats < 2) continue
    candidates.push({ center: rotate({ x: (best[0] + best[1]) / 2, y }, stageCenter, rotation), seats })
  }

  const rows = Math.min(24, candidates.length)
  const rowGap = Math.min(34, 350 / Math.max(rows - 1, 1))
  const rowOverrides: Record<number, RowOverride> = {}
  let capacity = 0
  candidates.slice(0, rows).forEach((candidate, row) => {
    rowOverrides[row] = {
      seats: Math.min(60, candidate.seats),
      offsetX: Math.round(((candidate.center.x - 500) / pixelsPerMeter) * 10) / 10,
      offsetY: Math.round(((candidate.center.y - (170 + row * rowGap)) / pixelsPerMeter) * 10) / 10,
      rotation,
      curve: 0,
    }
    capacity += rowOverrides[row].seats ?? 0
  })
  return { rows, capacity, rowOverrides }
}
