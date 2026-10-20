import type { VenueConfig } from '../types/venue'
import { createNationalTheatreStudy } from './nationalTheatreStudy'
import { getRowSeats } from './venue'

export const ND_SEATING_SOURCE = 'https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste'
export const ND_SEATING_PDF = 'https://media.narodni-divadlo.cz/11302/1764234380-nd-gold.pdf'
// Numbered sale seats only. Row 7 ends at 19; the two service symbols are not ticket seats.
export const ND_STALLS_COUNTS = [21, 22, 21, 22, 21, 22, 19, 22, 21, 20, 19, 18, 15] as const

export function createNationalTheatreSeatingStudy(): VenueConfig {
  const config = createNationalTheatreStudy()
  const old = config.rowOverrides
  config.rowOverrides = {}
  ND_STALLS_COUNTS.forEach((seats, row) => {
    config.rowOverrides[row] = {
      levelId: 'stalls', ticketRow: String(row + 1), numberingSource: 'nd-stalls-2025',
      seats, elevation: row * .09, offsetY: 1, offsetX: row === 6 ? -.55 : 0,
      curve: -.9, categoryId: 'stalls',
    }
  })
  // Keep the existing upper-tier study, explicitly without sourced numbering.
  for (let row = 10; row < config.rows; row++) config.rowOverrides[row + 3] = { ...old[row] }
  config.rows += 3
  config.geometry = 'fan'
  config.rowSpacing = .62
  config.name = 'National Theatre Prague · sourced stalls study'
  config.studyNotice = 'Stalls rows 1–13 and numbered sale seats transcribed from the official plan (checked 7 October 2026). Upper tiers use placeholder numbering; boxes and standing places are not mapped. Two row-7 service places are shown as non-ticket geometry. All 3D positions, dimensions and decoration are estimated; seat views are not verified.'
  return config
}

// Recheck the row against the catalogue after editing/import; a source tag alone is not proof.
export function hasSourcedStallsNumbering(config: VenueConfig, row: number): boolean {
  const r = config.rowOverrides[row]
  if (r?.numberingSource !== 'nd-stalls-2025' || r.levelId !== 'stalls') return false
  const number = Number(r.ticketRow)
  if (!Number.isInteger(number) || number < 1 || number > 13 || r.ticketRow !== String(number)) return false
  if (getRowSeats(config, row) !== ND_STALLS_COUNTS[number - 1]) return false
  return Object.entries(config.rowOverrides).filter(([key, other]) => Number(key) < config.rows && other.levelId === 'stalls' && other.ticketRow === r.ticketRow).length === 1
}
