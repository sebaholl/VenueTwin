import type { VenueConfig } from '../types/venue'
import { parseViewerConfig, sha256 } from './customerViewer'
import { blenderBlueprint } from './blenderBridge'
import { getRowLabel } from './venue'

/** One-way opt-in draft adapter. This never upgrades concept data to measurements.
 * Canonical validation lives in services/planner; its generated JSON Schema is in contracts/.
 * Seat IDs are stable only within this legacy snapshot; row edits require reconciliation.
 */
export async function productionDraft(value: VenueConfig, venueId: string, revision: number) {
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(venueId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid production identity.')
  const config = parseViewerConfig(value)
  if (!config.name.trim() || config.seatingLevels?.some(level => !/^[A-Za-z0-9_.:-]{1,100}$/.test(level.id) || !level.name.trim())) throw new Error('Production names and level IDs must be non-empty and valid.')
  const blueprint = blenderBlueprint(config)
  const evidence = () => ({ status: 'inferred' as const, source_ids: ['legacy-config'], uncertainty_m: null })
  const unknown = () => ({ status: 'unknown' as const, source_ids: [], uncertainty_m: null })
  const levels = (config.seatingLevels ?? []).map(level => ({ id: level.id, name: level.name, elevation_m: level.elevation, evidence: evidence() }))
  const levelFor = (row: number) => levels.find(level => level.id === config.rowOverrides[row]?.levelId)?.id ?? 'legacy-main'
  if (levels.some(level => level.id === 'legacy-main')) throw new Error('Rename the reserved legacy-main level ID before export.')
  const seats = blueprint.seats.map(seat => ({
    id: `legacy-r${seat.row}-s${seat.seat}`, label: seat.label, level_id: levelFor(seat.row),
    row_label: getRowLabel(config, seat.row), position_m: seat.position, yaw_rad: seat.rotation,
    eye_position_m: null, evidence: evidence(),
  }))
  if (seats.some(seat => seat.level_id === 'legacy-main')) levels.push({ id: 'legacy-main', name: 'Legacy main floor', elevation_m: 0, evidence: evidence() })
  return {
    format: 'venuetwin-production' as const, version: '1.0.0' as const, venue_id: venueId, revision,
    name: config.name, units: 'metres' as const, axes: 'right-handed-y-up' as const,
    origin: 'Legacy model origin before viewer modelOffset; geometry is unmeasured.',
    sources: [{ id: 'legacy-config', kind: 'legacy-concept' as const, sha256: await sha256(new Blob([JSON.stringify(config)])), description: 'Legacy VenueConfig snapshot; not a survey.' }],
    levels, seats,
    structures: blueprint.boxes.map((box, index) => ({ id: `legacy-box-${index}`, kind: 'other' as const, position_m: box.position, size_m: box.size, yaw_rad: box.rotation, evidence: evidence() })),
    stage_target_m: null, stage_target_evidence: unknown(),
    coverage: { scale: unknown(), seat_inventory: unknown(), occluders: unknown(), materials: unknown(), lighting: unknown() },
  }
}
