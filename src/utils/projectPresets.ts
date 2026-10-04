import { defaultVenue, type GeometryType, type VenueConfig, type VenueType } from '../types/venue'

export type ProjectPresetInput = {
  name: string
  venueType: VenueType
  geometry?: GeometryType
  rows?: number
  seatsPerRow?: number
  sectors?: number
}

const presets: Record<VenueType, Pick<VenueConfig, 'geometry' | 'rows' | 'seatsPerRow' | 'sectors' | 'rake' | 'curve' | 'stageWidth'>> = {
  cinema: { geometry: 'straight', rows: 10, seatsPerRow: 16, sectors: 2, rake: 0.32, curve: 0.08, stageWidth: 14 },
  theatre: { geometry: 'fan', rows: 12, seatsPerRow: 15, sectors: 2, rake: 0.28, curve: 0.32, stageWidth: 12 },
  conference: { geometry: 'blocks', rows: 8, seatsPerRow: 12, sectors: 3, rake: 0.08, curve: 0, stageWidth: 10 },
  other: { geometry: 'straight', rows: 8, seatsPerRow: 12, sectors: 1, rake: 0.18, curve: 0, stageWidth: 10 },
}

export function createProjectConfig(input: ProjectPresetInput): VenueConfig {
  const preset = presets[input.venueType]
  return {
    ...defaultVenue,
    ...preset,
    name: input.name.trim() || 'Untitled venue',
    venueType: input.venueType,
    geometry: input.geometry ?? preset.geometry,
    rows: input.rows ?? preset.rows,
    seatsPerRow: input.seatsPerRow ?? preset.seatsPerRow,
    sectors: input.sectors ?? preset.sectors,
    rowOverrides: {},
    planBoundary: [],
    calibration: null,
    stagePosition: { offsetX: 0, offsetY: 0, rotation: 0 },
  }
}

export function venueTypeLabel(type?: VenueType) {
  return ({ cinema: 'Cinema', theatre: 'Theatre', conference: 'Conference', other: 'Other venue' } as const)[type ?? 'other']
}
