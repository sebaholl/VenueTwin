export type GeometryType = 'straight' | 'fan' | 'blocks'

export type RowOverride = {
  seats?: number
  offsetX?: number
  curve?: number
}

export type PlanCalibration = {
  meters: number
  pixels: number
}

export type VenueConfig = {
  name: string
  rows: number
  seatsPerRow: number
  sectors: number
  rake: number
  curve: number
  stageWidth: number
  geometry: GeometryType
  rowOverrides: Record<number, RowOverride>
  calibration: PlanCalibration | null
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
  rowOverrides: {},
  calibration: null,
}
