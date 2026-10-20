import { planScale } from '../utils/planScale'
import type { VenueConfig } from '../types/venue'
import { getObstacles, obstaclePlanTransform } from '../utils/obstacles'

export function ObstaclePlan({ config }: { config: VenueConfig }) {
  const scale = planScale(config.calibration)
  return <g pointerEvents="none">{getObstacles(config).map((o) => <g key={o.id} transform={obstaclePlanTransform(o, scale)}><rect x={-o.width * scale / 2} y={-o.depth * scale / 2} width={o.width * scale} height={o.depth * scale} fill="#f5bc66" fillOpacity={.65} stroke="#f5bc66" strokeWidth="1.5" strokeDasharray={o.kind === 'railing' ? '4 2' : undefined} /><title>{o.name} · {o.height} m high · base {o.elevation} m</title></g>)}</g>
}
