import type { VenueConfig } from '../types/venue'
import type { ArchitectureBox } from './levelGeometry'
export function roomGeometry(config: VenueConfig): ArchitectureBox[] {
  const r = config.room; if (!r) return []
  const angle = r.rotation * Math.PI / 180, t = .2
  const box = (name: string, x: number, y: number, z: number, width: number, height: number, depth: number, color: string): ArchitectureBox => ({ name, position: [r.x + x * Math.cos(angle) + z * Math.sin(angle), y, r.z - x * Math.sin(angle) + z * Math.cos(angle)], size: [width, height, depth], rotation: angle, color })
  const boxes = [box('VT_ROOM_FLOOR', 0, -.1, 0, r.width + 2 * t, .2, r.depth + 2 * t, r.floorColor)]
  for (const side of [-1, 1]) {
    boxes.push(box(`VT_ROOM_SHELL_SIDE_${side}`, side * (r.width / 2 + t / 2), r.height / 2, 0, t, r.height, r.depth + 2 * t, r.wallColor))
    boxes.push(box(`VT_ROOM_SHELL_END_${side}`, 0, r.height / 2, side * (r.depth / 2 + t / 2), r.width, r.height, t, r.wallColor))
  }
  if (r.ceiling) boxes.push(box('VT_ROOM_SHELL_CEILING', 0, r.height + .1, 0, r.width + 2 * t, .2, r.depth + 2 * t, r.wallColor))
  return boxes
}
