export type GeometryType = 'straight' | 'fan' | 'blocks'

export type VenueConfig = {
  name: string
  rows: number
  seatsPerRow: number
  sectors: number
  rake: number
  curve: number
  stageWidth: number
  geometry: GeometryType
}

export type SeatRef = {
  row: number
  seat: number
  label: string
}

export const defaultVenue: VenueConfig = {
  name: 'New venue concept',
  rows: 10,
  seatsPerRow: 14,
  sectors: 2,
  rake: 0.28,
  curve: 0.32,
  stageWidth: 12,
  geometry: 'fan',
}
