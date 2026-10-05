import { useMemo } from 'react'
import type { VenueConfig } from '../types/venue'
import { seatCategory } from '../utils/seatCategories'
import { generateSeatLayout } from '../utils/venue'

export function SharedPlan({ config }: { config: VenueConfig }) {
  const seats = useMemo(() => generateSeatLayout(config), [config])
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const boundary = (config.planBoundary ?? []).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))

  return <div className="shared-plan"><svg viewBox="0 0 1000 620" role="img" aria-label={`Read-only seating plan for ${config.name}`}>
    <defs><pattern id="shared-grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(126,158,169,.12)" /></pattern></defs>
    <rect width="1000" height="620" fill="url(#shared-grid)" />
    {boundary.length >= 3 && <polygon className="shared-boundary" points={boundary.map((point) => `${point.x},${point.y}`).join(' ')} />}
    <g className="shared-stage" transform={`translate(${500 + stage.offsetX * 24}, ${76 + stage.offsetY * 24}) rotate(${stage.rotation})`}><rect x={-(150 + config.stageWidth * 10)} y="-34" width={300 + config.stageWidth * 20} height="68" rx="7" /><text x="0" y="6">STAGE</text></g>
    {seats.map((seat) => <circle key={seat.label} className="shared-seat" style={{ fill: seatCategory(config, seat.row, seat.seat).color }} cx={500 + seat.position[0] * 24} cy={150 + seat.position[2] * 24} r="5.2"><title>{seat.label}</title></circle>)}
  </svg></div>
}
