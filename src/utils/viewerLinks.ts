import type { SeatRef, VenueConfig } from '../types/venue'
import { generateSeatLayout } from './venue'
import { assetUrl } from './customerViewer'

// Row/seat indices belong to a fixed, versioned venue manifest, not display labels.
export function seatId(seat: Pick<SeatRef, 'row' | 'seat'>) {
  return `r${seat.row + 1}-s${seat.seat + 1}`
}
export function resolveSeatLink(config: VenueConfig, id: string | null) {
  if (!id || !/^r[1-9]\d{0,2}-s[1-9]\d{0,2}$/.test(id)) return null
  return generateSeatLayout(config).find((seat) => seatId(seat) === id) ?? null
}
export function seatLink(origin: string, manifest: string, seat: Pick<SeatRef, 'row' | 'seat'>) {
  const host = new URL(origin)
  if (!['http:', 'https:'].includes(host.protocol) || host.username || host.password) throw new Error('Use the viewer website address.')
  const source = assetUrl(manifest, host.origin, host.origin)
  const url = new URL('/viewer', host.origin)
  url.searchParams.set('venue', new URL(source).pathname)
  url.searchParams.set('seat', seatId(seat))
  return url.href
}
