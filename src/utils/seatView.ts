import type { SeatRef, VenueConfig } from '../types/venue'
import { generateSeatLayout } from './venue'

export const modelOffset: [number, number, number] = [0, -1.4, -2.8]
export function getSeatView(config: VenueConfig, selected: SeatRef | null, eyeHeight = 1.15) {
  if (!selected) return null
  const seat = generateSeatLayout(config).find((s) => s.row === selected.row && s.seat === selected.seat)
  if (!seat) return null
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const angle = stage.rotation * Math.PI / 180
  const position: [number, number, number] = [seat.position[0], seat.position[1] - .25 + eyeHeight + modelOffset[1], seat.position[2] + modelOffset[2]]
  const target: [number, number, number] = [stage.offsetX - Math.sin(angle) * 3.25, 2.7 + modelOffset[1], stage.offsetY - Math.cos(angle) * 3.25 + modelOffset[2]]
  const dx = target[0] - position[0], dy = target[1] - position[1], dz = target[2] - position[2]
  return { position, target, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
}

export function lookDirection(yaw: number, pitch: number): [number, number, number] {
  const limitedPitch = Math.max(-Math.PI / 2 + .05, Math.min(Math.PI / 2 - .05, pitch))
  return [Math.sin(yaw) * Math.cos(limitedPitch), Math.sin(limitedPitch), -Math.cos(yaw) * Math.cos(limitedPitch)]
}
