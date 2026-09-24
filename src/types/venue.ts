export type GeometryType = 'straight' | 'fan' | 'blocks'

export type RowOverride = {
  seats?: number
  offsetX?: number
  offsetY?: number
  rotation?: number
  curve?: number
}

export type PlanCalibration = {
  meters: number
  pixels: number
}

export type PlanPoint = { x: number; y: number }

export type StagePosition = {
  offsetX: number
  offsetY: number
  rotation: number
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
  planBoundary?: PlanPoint[]
  stagePosition?: StagePosition
  seatSpacing?: number
  rowSpacing?: number
  edgeClearance?: number
  aisleWidth?: number
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
  planBoundary: [],
  stagePosition: { offsetX: 0, offsetY: 0, rotation: 0 },
  seatSpacing: 0.72,
  rowSpacing: 0.92,
  edgeClearance: 0.6,
  aisleWidth: 0.9,
}
