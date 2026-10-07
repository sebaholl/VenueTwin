export type GeometryType = 'straight' | 'fan' | 'blocks'
export type VenueType = 'cinema' | 'theatre' | 'conference' | 'other'

export type RowOverride = {
  ticketRow?: string
  numberingSource?: 'nd-stalls-2025'
  levelId?: string
  elevation?: number
  arcRadius?: number
  arcDegrees?: number
  categoryId?: string
  seatCategories?: Record<number, string>
  accessibleSeats?: Record<number, boolean>
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
  seatingLevels?: { id: string; name: string; elevation: number; parapetHeight?: number }[]
  studyNotice?: string
  obstacles?: VenueObstacle[]
  categories?: SeatCategory[]
  currency?: 'CZK' | 'EUR' | 'DKK' | 'USD' | 'GBP'
  name: string
  venueType?: VenueType
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

export type SeatCategory = { id: string; name: string; color: string; price?: number }

export type VenueObstacle = {
  id: string
  name: string
  kind: 'column' | 'wall' | 'railing'
  x: number
  z: number
  elevation: number
  width: number
  depth: number
  height: number
  rotation: number
}

export type SeatRef = {
  row: number
  seat: number
  label: string
}

export const defaultVenue: VenueConfig = {
  name: 'New venue concept',
  venueType: 'theatre',
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
