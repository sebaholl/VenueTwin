import type { VenueConfig, RowOverride, VenueObstacle } from '../types/venue'
import { parseViewerConfig } from './customerViewer'
import { assignRowRange, saveSeatingLevel } from './levelManagement'
import { generateSeatLayout, getRowSeats } from './venue'

type Evidence = { basis: 'provided' | 'estimated'; source: string }
export type PilotAction = Evidence & (
  | { tool: 'set_stage'; width: number; x: number; z: number; rotation: number }
  | { tool: 'set_seating'; rows: number; seatsPerRow: number; sectors: number; geometry: 'straight' | 'fan' | 'blocks'; rake: number; curve: number; seatSpacing: number; rowSpacing: number; aisleWidth: number }
  | { tool: 'edit_row'; row: number; seats: number | null; elevation: number | null; offsetX: number | null; offsetY: number | null; rotation: number | null; curve: number | null; frontRailing: boolean | null }
  | { tool: 'save_level'; id: string; name: string; elevation: number; parapetHeight: number }
  | { tool: 'assign_rows'; firstRow: number; lastRow: number; levelId: string }
  | { tool: 'save_obstacle'; obstacle: VenueObstacle }
)
export type PilotPlan = { summary: string; actions: PilotAction[]; questions: string[]; limitations: string[]; expectedSeatCount: number | null }

// This small schema subset is shared by the API tool and its runtime validator.
// No arbitrary config paths, code, URLs to fetch, or shell commands are executable.
type Schema = { type?: string; enum?: unknown[]; properties?: Record<string, Schema>; required?: string[]; additionalProperties?: false; items?: Schema; anyOf?: Schema[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; maxItems?: number }
const number = (minimum: number, maximum: number): Schema => ({ type: 'number', minimum, maximum })
const integer = (minimum: number, maximum: number): Schema => ({ type: 'integer', minimum, maximum })
const string = (maxLength = 500): Schema => ({ type: 'string', minLength: 1, maxLength })
const choice = (...values: string[]): Schema => ({ type: 'string', enum: values })
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] })
const object = (properties: Record<string, Schema>): Schema => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false })
const action = (tool: string, properties: Record<string, Schema>) => object({ tool: choice(tool), basis: choice('provided', 'estimated'), source: string(), ...properties })
export const pilotPlanSchema = object({
  summary: string(1200),
  actions: { type: 'array', maxItems: 80, items: { anyOf: [
    action('set_stage', { width: number(1, 100), x: number(-100, 100), z: number(-100, 100), rotation: number(-100, 100) }),
    action('set_seating', { rows: integer(1, 50), seatsPerRow: integer(1, 200), sectors: integer(1, 3), geometry: choice('straight', 'fan', 'blocks'), rake: number(0, 3), curve: number(-5, 5), seatSpacing: number(.1, 20), rowSpacing: number(.1, 20), aisleWidth: number(.1, 20) }),
    action('edit_row', { row: integer(1, 50), seats: nullable(integer(1, 200)), elevation: nullable(number(0, 100)), offsetX: nullable(number(-100, 100)), offsetY: nullable(number(-100, 100)), rotation: nullable(number(-100, 100)), curve: nullable(number(-5, 5)), frontRailing: nullable({ type: 'boolean' }) }),
    action('save_level', { id: string(80), name: string(80), elevation: number(0, 100), parapetHeight: number(.2, 2) }),
    action('assign_rows', { firstRow: integer(1, 50), lastRow: integer(1, 50), levelId: { type: 'string', maxLength: 80 } }),
    action('save_obstacle', { obstacle: object({ id: string(80), name: string(100), kind: choice('column', 'wall', 'railing'), x: number(-100, 100), z: number(-100, 100), elevation: number(0, 100), width: number(.01, 100), depth: number(.01, 100), height: number(.01, 100), rotation: number(-100, 100) }) }),
  ] } },
  questions: { type: 'array', maxItems: 10, items: string() },
  limitations: { type: 'array', maxItems: 15, items: string() },
  expectedSeatCount: nullable(integer(1, 2000)),
})
function matches(value: unknown, schema: Schema): boolean {
  if (schema.anyOf) return schema.anyOf.some((item) => matches(value, item))
  if (schema.enum && !schema.enum.includes(value)) return false
  switch (schema.type) {
    case 'null': return value === null
    case 'boolean': return typeof value === 'boolean'
    case 'string': return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity)
    case 'number': case 'integer': return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isInteger(value)) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity)
    case 'array': return Array.isArray(value) && value.length <= (schema.maxItems ?? Infinity) && value.every((item) => matches(item, schema.items!))
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const record = value as Record<string, unknown>, properties = schema.properties!
      return Object.keys(record).every((key) => Object.hasOwn(properties, key)) && schema.required!.every((key) => Object.hasOwn(record, key) && matches(record[key], properties[key]))
    }
    default: return false
  }
}
export function parsePilotPlan(value: unknown): PilotPlan {
  if (!matches(value, pilotPlanSchema)) throw new Error('Pilot returned an invalid action plan. Nothing was changed; try a more specific brief.')
  return structuredClone(value) as PilotPlan
}
export function applyPilotPlan(base: VenueConfig, value: unknown, allowEstimates: boolean): VenueConfig {
  const plan = parsePilotPlan(value)
  if (!allowEstimates && plan.actions.some((item) => item.basis === 'estimated')) throw new Error('This plan contains estimates. Allow estimates or supply the missing measurements.')
  let config = parseViewerConfig(base)
  for (const item of plan.actions) {
    switch (item.tool) {
      case 'set_stage': config = { ...config, stageWidth: item.width, stagePosition: { offsetX: item.x, offsetY: item.z, rotation: item.rotation } }; break
      case 'set_seating': {
        // Keep edits and ticket metadata on surviving rows; this is never a silent reset.
        const rowOverrides = Object.fromEntries(Object.entries(config.rowOverrides).filter(([key]) => Number(key) < item.rows))
        config = { ...config, rows: item.rows, seatsPerRow: item.seatsPerRow, sectors: item.sectors, geometry: item.geometry, rake: item.rake, curve: item.curve, seatSpacing: item.seatSpacing, rowSpacing: item.rowSpacing, aisleWidth: item.aisleWidth, rowOverrides }
        break
      }
      case 'edit_row': {
        const row = item.row - 1
        if (row >= config.rows) throw new Error(`Row ${item.row} does not exist. Nothing was changed.`)
        const patch: RowOverride = {}
        for (const key of ['seats', 'elevation', 'offsetX', 'offsetY', 'rotation', 'curve'] as const) if (item[key] !== null) patch[key] = item[key]
        if (item.frontRailing !== null) patch.frontRailing = item.frontRailing
        config = { ...config, rowOverrides: { ...config.rowOverrides, [row]: { ...config.rowOverrides[row], ...patch } } }
        break
      }
      case 'save_level': config = saveSeatingLevel(config, { id: item.id, name: item.name, elevation: item.elevation, parapetHeight: item.parapetHeight }); break
      case 'assign_rows': config = assignRowRange(config, item.firstRow - 1, item.lastRow - 1, item.levelId); break
      case 'save_obstacle': {
        const obstacles = config.obstacles ?? []
        config = { ...config, obstacles: obstacles.some((o) => o.id === item.obstacle.id) ? obstacles.map((o) => o.id === item.obstacle.id ? item.obstacle : o) : [...obstacles, item.obstacle] }
        break
      }
    }
    // Validate each intermediate state before any geometry is generated.
    config = parseViewerConfig(config)
  }
  for (let row = 0; row < config.rows; row++) if (getRowSeats(config, row) < 1) throw new Error('Each row must contain at least one seat. Reduce the fan taper or provide explicit row counts.')
  const seats = generateSeatLayout(config)
  if (!seats.length || seats.some((seat) => seat.position.some((n) => !Number.isFinite(n)))) throw new Error('The proposed layout has invalid seat geometry.')
  if (plan.actions.length && plan.expectedSeatCount !== null && seats.length !== plan.expectedSeatCount) throw new Error(`Seat count check failed: requested ${plan.expectedSeatCount}, generated ${seats.length}. Nothing was changed.`)
  if (plan.actions.some((a) => a.basis === 'estimated')) config.studyNotice = [config.studyNotice, 'Pilot draft includes estimated geometry; seat views have not been validated against identified-seat photos.'].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n')
  return config
}
export function checkPilotBase(current: VenueConfig, snapshot: string) {
  if (JSON.stringify(current) !== snapshot) throw new Error('The venue changed after this proposal was requested. Generate a fresh proposal to keep your edits.')
}
export function pilotActionLabel(action: PilotAction) {
  switch (action.tool) {
    case 'set_stage': return `Stage: ${action.width} m wide; position ${action.x}, ${action.z} m; ${action.rotation}°`
    case 'set_seating': return `Seating: ${action.rows} rows, ${action.seatsPerRow} default seats; ${action.geometry}`
    case 'edit_row': return `Edit row ${action.row}`
    case 'save_level': return `Level: ${action.name}, ${action.elevation} m above ground`
    case 'assign_rows': return `Assign rows ${action.firstRow}–${action.lastRow} to ${action.levelId || 'main floor'}`
    case 'save_obstacle': return `${action.obstacle.kind}: ${action.obstacle.name}`
  }
}
