import type { VenueConfig } from '../types/venue'
import { generatePhysicalSeatLayout } from './venue'
import { stageGeometry } from './stageGeometry'
export type LayoutFinding = { id: string; severity: 'warning' | 'info'; title: string; detail: string; count?: number; examples?: string[] }
type Footprint = { x: number; z: number; halfX: number; halfZ: number; angle: number; bottom: number; top: number; label: string }
// Conservative envelopes of the Studio chair meshes, not occupant or regulatory clearances.
function overlap(a: Footprint, b: Footprint) {
  if (a.bottom >= b.top - .001 || b.bottom >= a.top - .001) return false
  const axes = (angle: number) => [[Math.cos(angle), -Math.sin(angle)], [Math.sin(angle), Math.cos(angle)]]
  const aa = axes(a.angle), bb = axes(b.angle)
  for (const [x, z] of [...aa, ...bb]) {
    const extent = (box: Footprint, basis: number[][]) => box.halfX * Math.abs(x * basis[0][0] + z * basis[0][1]) + box.halfZ * Math.abs(x * basis[1][0] + z * basis[1][1])
    if (Math.abs((b.x - a.x) * x + (b.z - a.z) * z) >= extent(a, aa) + extent(b, bb) - .001) return false
  }
  return true
}
export function layoutChecks(config: VenueConfig): LayoutFinding[] {
  const findings: LayoutFinding[] = []
  const seats: Footprint[] = generatePhysicalSeatLayout(config).map((seat) => ({ x: seat.position[0] - Math.sin(seat.rotation) * .035, z: seat.position[2] - Math.cos(seat.rotation) * .035, halfX: .26, halfZ: .275, angle: seat.rotation, bottom: seat.position[1] - .04, top: seat.position[1] + .58, label: seat.label + (seat.service ? ' (service)' : '') })).sort((a, b) => a.x - b.x)
  let pairs = 0; const pairExamples: string[] = []
  for (let i = 0; i < seats.length; i++) for (let j = i + 1; j < seats.length && seats[j].x - seats[i].x < .76; j++) {
    if (Math.abs(seats[j].z - seats[i].z) > .76 || !overlap(seats[i], seats[j])) continue
    pairs++; if (pairExamples.length < 8) pairExamples.push(`${seats[i].label} / ${seats[j].label}`)
  }
  if (pairs) findings.push({ id: 'seat-overlap', severity: 'warning', title: 'Possible seat overlaps', detail: 'Conservative chair envelopes intersect. Check row spacing, offsets and rotations in the 3D view; tier heights are taken into account.', count: pairs, examples: pairExamples })
  const pose = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }, angle = pose.rotation * Math.PI / 180
  const dimensions = stageGeometry(config)
  const stage = { x: pose.offsetX - Math.sin(angle) * 2.2, z: pose.offsetY - Math.cos(angle) * 2.2, halfX: config.stageWidth / 2, halfZ: dimensions.depth / 2, angle, bottom: -.225, top: .225, label: 'Stage' }
  const intersections = seats.filter((seat) => overlap(seat, stage))
  if (intersections.length) findings.push({ id: 'stage-overlap', severity: 'warning', title: 'Seats may intersect the stage platform', detail: 'Chair envelopes intersect the configured stage volume. Adjust stage position/depth or the affected rows, then inspect the result.', count: intersections.length, examples: intersections.slice(0, 8).map((s) => s.label) })
  const defaults = (['stageDepth', 'screenWidth', 'screenHeight', 'screenBottom'] as const).filter((key) => config[key] === undefined)
  if (defaults.length) findings.push({ id: 'default-dimensions', severity: 'info', title: 'Some dimensions use template defaults', detail: defaults.map((key) => ({ stageDepth: 'stage depth', screenWidth: 'screen width', screenHeight: 'screen height', screenBottom: 'screen bottom elevation' })[key]).join(', ') + '. Confirm these in Layout → Stage. Explicitly configured values are not automatically verified measurements.' })
  if (dimensions.width > config.stageWidth) findings.push({ id: 'wide-screen', severity: 'info', title: 'Screen is wider than the stage', detail: 'This can be intentional. Compare both widths with the source plan.' })
  return findings
}
export function layoutRepairBrief(findings: LayoutFinding[]) {
  return 'Review these local geometry warnings against the current layout and accepted source findings. Propose only supported fixes; ask for missing dimensions rather than inventing them. Preserve unrelated settings. These are conservative modelling checks, not verified measurements.\n\n' + findings.filter((f) => f.severity === 'warning').map((f) => `${f.title}: ${f.count ?? ''}. ${f.detail} Examples: ${(f.examples ?? []).join(', ')}`).join('\n')
}
