import type { VenueConfig } from '../types/venue'
import { getObstacles, obstaclePlanTransform } from '../utils/obstacles'

export function ObstaclePlan({ config }: { config: VenueConfig }) {
  return <g pointerEvents="none">{getObstacles(config).map((o) => <g key={o.id} transform={obstaclePlanTransform(o)}><rect x={-o.width * 12} y={-o.depth * 12} width={o.width * 24} height={o.depth * 24} fill="#f5bc66" fillOpacity={.65} stroke="#f5bc66" strokeWidth="1.5" strokeDasharray={o.kind === 'railing' ? '4 2' : undefined} /><title>{o.name} · {o.height} m high · base {o.elevation} m</title></g>)}</g>
}
