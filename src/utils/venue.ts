import type { SeatRef, VenueConfig } from '../types/venue'

export type PositionedSeat = SeatRef & {
  position: [number, number, number]
  rotation: number
}

export function getRowLabel(config: VenueConfig, row: number): string {
  const ticketRow = config.rowOverrides[row]?.ticketRow
  if (ticketRow) return ticketRow
  let label = '', index = row + 1
  while (index > 0) { index--; label = String.fromCharCode(65 + index % 26) + label; index = Math.floor(index / 26) }
  return label
}

export function getSeatLabel(config: VenueConfig, row: number, seat: number): string {
  const override = config.rowOverrides[row]
  if (!override?.ticketRow) return `${getRowLabel(config, row)}${seat + 1}`
  const level = config.seatingLevels?.find((l) => l.id === override.levelId)
  return `${level?.name ?? 'Main floor'} · ${override.ticketRow}/${seat + 1}`
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
  const spacing = config.seatSpacing ?? 0.72
  const rowSpacing = config.rowSpacing ?? 0.92
  const aisleWidth = config.aisleWidth ?? 0.9
  const sections = Math.max(1, Math.min(3, config.sectors))
  for (let row = 0; row < config.rows; row += 1) {
    const rowWidth = getRowSeats(config, row)
    const rowOverride = config.rowOverrides?.[row]
    const rowCurve = rowOverride?.curve ?? config.curve
    const rowAngle = ((rowOverride?.rotation ?? 0) * Math.PI) / 180
    const rowOffsetX = rowOverride?.offsetX ?? 0
    const rowOffsetZ = rowOverride?.offsetY ?? 0
    const level = config.seatingLevels?.find((item) => item.id === rowOverride?.levelId)
    const elevation = (level?.elevation ?? 0) + (rowOverride?.elevation ?? row * config.rake)
    for (let seat = 0; seat < rowWidth; seat += 1) {
      const normalized = rowWidth === 1 ? 0 : seat / (rowWidth - 1) - 0.5
      const fanAmount = config.geometry === 'fan' ? rowCurve * normalized : 0
      const sectionIndex = Math.min(sections - 1, Math.floor((seat * sections) / rowWidth))
      const aisleOffset = (sectionIndex - (sections - 1) / 2) * aisleWidth
      const radius = rowOverride?.arcRadius
      const arc = normalized * (rowOverride?.arcDegrees ?? 140) * Math.PI / 180
      const localX = radius ? Math.sin(arc) * radius : (seat - (rowWidth - 1) / 2) * spacing + aisleOffset
      const localZ = radius ? Math.cos(arc) * radius : normalized * fanAmount * 2
      output.push({
        row,
        seat,
        label: getSeatLabel(config, row, seat),
        position: [
          localX * Math.cos(rowAngle) + localZ * Math.sin(rowAngle) + rowOffsetX,
          0.25 + elevation,
          -localX * Math.sin(rowAngle) + localZ * Math.cos(rowAngle) + (radius ? 0 : row * rowSpacing) + rowOffsetZ,
        ],
        rotation: rowAngle + (radius ? arc : config.geometry === 'fan' ? -normalized * rowCurve : 0),
      })
    }
  }
  return output
}
