import { architecturalDetailGeometry } from './architecturalDetails'
import { validateRoomOpenings, wallSegments } from './roomOpenings'
import type { VenueConfig } from '../types/venue'
import type { ArchitectureBox } from './levelGeometry'
export function roomGeometry(config: VenueConfig): ArchitectureBox[] {
  const details = architecturalDetailGeometry(config.architecturalDetails)
  const r = config.room; if (!r) return details
  const openings = validateRoomOpenings(r.openings, r)
  const angle = r.rotation * Math.PI / 180, t = .2
  const box = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, color: string): ArchitectureBox => ({ name, position: [r.x + x * Math.cos(angle) + z * Math.sin(angle), y, r.z - x * Math.sin(angle) + z * Math.cos(angle)], size: [width, height, depth], rotation: angle, color })
  const boxes = [box('VT_ROOM_FLOOR', 0, -.1, 0, r.width + 2 * t, .2, r.depth + 2 * t, r.floorColor)]
  for (const side of [-1, 1]) {
    const sideWall = side === -1 ? 'left' : 'right', endWall = side === -1 ? 'front' : 'back'
    const sideOpenings = openings.filter((o) => o.wall === sideWall), endOpenings = openings.filter((o) => o.wall === endWall)
    wallSegments(r.depth + 2 * t, r.height, sideOpenings).forEach((piece, index) => boxes.push(box(`VT_ROOM_SHELL_SIDE_${side}${sideOpenings.length ? '_' + index : ''}`, side * (r.width / 2 + t / 2), piece.bottom + piece.height / 2, piece.offset, t, piece.height, piece.width, r.wallColor)))
    wallSegments(r.width, r.height, endOpenings).forEach((piece, index) => boxes.push(box(`VT_ROOM_SHELL_END_${side}${endOpenings.length ? '_' + index : ''}`, piece.offset, piece.bottom + piece.height / 2, side * (r.depth / 2 + t / 2), piece.width, piece.height, t, r.wallColor)))
  }
  if (r.ceiling) boxes.push(box('VT_ROOM_SHELL_CEILING', 0, r.height + .1, 0, r.width + 2 * t, .2, r.depth + 2 * t, r.wallColor))
  return [...boxes, ...details]
}
