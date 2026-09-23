import type { SeatRef, VenueConfig } from '../types/venue'

export type PositionedSeat = SeatRef & {
  position: [number, number, number]
  rotation: number
}

export function getDefaultRowSeats(config: VenueConfig, row: number) {
  return config.geometry === 'fan'
    ? config.seatsPerRow - Math.floor((config.rows - row - 1) * 0.18)
    : config.seatsPerRow
}

export function getRowSeats(config: VenueConfig, row: number) {
  return config.rowOverrides?.[row]?.seats ?? getDefaultRowSeats(config, row)
}

export function estimateCapacity(config: VenueConfig) {
  return Array.from({ length: config.rows }, (_, row) => getRowSeats(config, row))
    .reduce((total, seats) => total + seats, 0)
}

export function estimateSeatScore(seat: SeatRef, config: VenueConfig) {
  return Math.max(58, Math.round(96 - Math.abs(seat.seat - config.seatsPerRow / 2) * 2.4 - seat.row * 0.6))
}

export function generateSeatLayout(config: VenueConfig): PositionedSeat[] {
  const output: PositionedSeat[] = []
  const spacing = 0.72
  for (let row = 0; row < config.rows; row += 1) {
    const rowWidth = getRowSeats(config, row)
    const rowOverride = config.rowOverrides?.[row]
    for (let seat = 0; seat < rowWidth; seat += 1) {
      const normalized = rowWidth === 1 ? 0 : seat / (rowWidth - 1) - 0.5
      const fanAmount = config.geometry === 'fan' ? config.curve * normalized : 0
      const aisleGap = config.sectors > 1 && seat >= rowWidth / 2 ? 0.65 : 0
      output.push({
        row,
        seat,
        label: `${String.fromCharCode(65 + row)}${seat + 1}`,
        position: [
          (seat - (rowWidth - 1) / 2) * spacing + Math.sign(normalized) * aisleGap + (rowOverride?.offsetX ?? 0),
          0.25 + row * config.rake,
          row * 0.92 + Math.abs(normalized) * fanAmount * 2,
        ],
        rotation: config.geometry === 'fan' ? -normalized * (rowOverride?.curve ?? config.curve) : 0,
      })
    }
  }
  return output
}
