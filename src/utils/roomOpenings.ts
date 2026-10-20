import type { RoomOpening } from '../types/venue'
export function validateRoomOpenings(value: unknown, room: { width: number; depth: number; height: number }): RoomOpening[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20) throw new Error('Use at most 20 wall openings.')
  const ids = new Set<string>()
  for (const opening of value) {
    if (!opening || typeof opening !== 'object' || typeof opening.id !== 'string' || !opening.id.trim() || opening.id.length > 80 || ids.has(opening.id) || !['front', 'back', 'left', 'right'].includes(opening.wall) || !['offset', 'width', 'height', 'bottom'].every((key) => typeof opening[key] === 'number' && Number.isFinite(opening[key])) || opening.width < .1 || opening.height < .1 || opening.bottom < 0) throw new Error('Invalid wall opening. Supply a unique ID, wall and numeric dimensions.')
    const length = ['front', 'back'].includes(opening.wall) ? room.width : room.depth
    if (Math.abs(opening.offset) + opening.width / 2 > length / 2 + 1e-8 || opening.bottom + opening.height > room.height + 1e-8) throw new Error('An opening extends beyond its wall. Resize or remove it before shrinking the room.')
    ids.add(opening.id)
  }
  for (const wall of ['front', 'back', 'left', 'right']) {
    const length = ['front', 'back'].includes(wall) ? room.width : room.depth
    if (wallSegments(length, room.height, value.filter((o) => o.wall === wall)).some((p) => p.width < .001 || p.height < .001)) throw new Error('Leave at least 1 mm of wall between opening edges, or align the edges exactly.')
  }
  return structuredClone(value) as RoomOpening[]
}
// Split into vertical strips, subtract the union of opening height intervals.
// Overlapping openings form one hole without overlapping wall solids.
export function wallSegments(length: number, height: number, openings: RoomOpening[]) {
  const edges = [...new Set([-length / 2, length / 2, ...openings.flatMap((o) => [o.offset - o.width / 2, o.offset + o.width / 2])])].sort((a,b) => a-b)
  const boxes: { offset: number; bottom: number; width: number; height: number }[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    const left = edges[i], right = edges[i + 1], middle = (left + right) / 2
    if (right - left < 1e-8) continue
    const holes = openings.filter((o) => middle > o.offset - o.width / 2 && middle < o.offset + o.width / 2).map((o) => [o.bottom, o.bottom + o.height]).sort((a,b) => a[0]-b[0])
    let bottom = 0
    for (const [start, end] of [...holes, [height, height]]) {
      if (start > bottom + 1e-8) boxes.push({ offset: middle, bottom, width: right-left, height: start-bottom })
      bottom = Math.max(bottom, end)
    }
  }
  return boxes
}
