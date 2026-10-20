import type { VenueConfig } from '../types/venue'
import { generateSeatLayout } from './venue'

export type ReviewCamera = { fov: number; eyeHeight: number; yaw: number; pitch: number }
export const defaultReviewCamera: ReviewCamera = { fov: 65, eyeHeight: 1.15, yaw: 0, pitch: 0 }
export const reviewSources = [
  { name: 'National Theatre · curtain and boxes', url: 'https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo', image: 'https://media.narodni-divadlo.cz/11302/1762521984-narodnidivadlooponahlediste2-2560px.jpg?auto=compress%2Cformat&fit=fillmax&h=756&w=1024', note: 'Official gallery. Side viewpoint is visible, but exact level, row, seat, camera height and lens are not supplied. Architectural reference only.' },
  { name: 'National Theatre · Google Arts & Culture', url: 'https://artsandculture.google.com/streetview/prague-national-theatre-interior/KgH8C9a4VWANjw', image: '', note: 'Interior tour linked from the theatre’s partner collection. Panorama camera positions are not verified ticket seats. Open the source in another tab.' },
  { name: 'National Theatre · second interior tour', url: 'https://artsandculture.google.com/streetview/prague-national-theatre-interior/ogGklw813u2hhg', image: '', note: 'Additional interior tour. No verified seat ID, camera height or perspective field of view retrieved.' },
] as const

export function representativeSeats(config: VenueConfig) {
  const seats = generateSeatLayout(config)
  const firstLevel = config.seatingLevels?.[0]?.id
  const stalls = seats.filter((s) => !firstLevel || config.rowOverrides[s.row]?.levelId === firstLevel)
  const rows = [...new Set(stalls.map((s) => s.row))]
  const centre = stalls.filter((s) => s.row === rows[Math.floor(rows.length / 2)])
  const balconyId = config.seatingLevels?.[1]?.id
  const upper = balconyId ? seats.filter((s) => config.rowOverrides[s.row]?.levelId === balconyId) : []
  const front = upper.filter((s) => s.row === upper[0]?.row)
  return [
    { name: 'Central stalls', seat: centre[Math.floor(centre.length / 2)] },
    { name: 'Front balcony centre', seat: front[Math.floor(front.length / 2)] },
    { name: 'Side balcony', seat: front[0] },
  ].filter((item) => item.seat)
}

export function offsetSeating(config: VenueConfig, metres: number): VenueConfig {
  return { ...config, rowOverrides: Object.fromEntries(Array.from({ length: config.rows }, (_, row) => [row, { ...config.rowOverrides[row], offsetY: (config.rowOverrides[row]?.offsetY ?? 0) + metres }])) }
}
