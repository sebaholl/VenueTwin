import type { ArchitecturalDetail } from './architecturalDetails'
import type { VenueConfig, RowOverride, VenueObstacle, RoomOpening } from '../types/venue'
import { parseViewerConfig } from './customerViewer'
import { assignRowRange, saveSeatingLevel, removeSeatingLevel } from './levelManagement'
import { getCategories, removeCategory } from './seatCategories'
import { generateSeatLayout, getRowSeats } from './venue'

type Evidence = { basis: 'provided' | 'estimated'; source: string }
export type PilotAction = Evidence & (
  | { tool: 'save_architectural_detail'; detail: Omit<ArchitecturalDetail, 'basis' | 'source'> }
  | { tool: 'remove_architectural_detail'; id: string }
  | { tool: 'set_room'; room: Omit<NonNullable<VenueConfig['room']>, 'openings'> }
  | { tool: 'save_room_opening'; opening: RoomOpening }
  | { tool: 'remove_room_opening'; id: string }
  | { tool: 'remove_room' }
  | { tool: 'set_stage_dimensions'; depth: number | null; screenWidth: number | null; screenHeight: number | null; screenBottom: number | null }
  | { tool: 'set_stage'; width: number; x: number | null; z: number | null; rotation: number | null }
  | { tool: 'set_seating'; rows: number; seatsPerRow: number; sectors: number; geometry: 'straight' | 'fan' | 'blocks'; rake: number; curve: number; seatSpacing: number; rowSpacing: number; aisleWidth: number }
  | { tool: 'edit_row'; row: number; seats: number | null; elevation: number | null; offsetX: number | null; offsetY: number | null; rotation: number | null; curve: number | null; frontRailing: boolean | null }
  | { tool: 'save_level'; id: string; name: string; elevation: number; parapetHeight: number }
  | { tool: 'assign_rows'; firstRow: number; lastRow: number; levelId: string }
  | { tool: 'save_obstacle'; obstacle: VenueObstacle }
  | { tool: 'remove_obstacle'; id: string }
  | { tool: 'remove_level'; id: string }
  | { tool: 'set_row_arc'; row: number; radius: number | null; degrees: number | null }
  | { tool: 'set_row_label'; row: number; label: string | null }
  | { tool: 'save_category'; id: string; name: string; color: string; price: number | null }
  | { tool: 'remove_category'; id: string }
  | { tool: 'assign_row_category'; firstRow: number; lastRow: number; categoryId: string }
  | { tool: 'assign_seat_category'; row: number; seat: number; categoryId: string | null }
  | { tool: 'label_accessible_seat'; row: number; seat: number; accessible: boolean }
  | { tool: 'set_currency'; currency: NonNullable<VenueConfig['currency']> }
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
    action('save_architectural_detail', { detail: object({ id: string(80), name: string(80), kind: choice('panel', 'portal', 'coffer', 'column', 'curved-wall'), x: number(-100, 100), z: number(-100, 100), bottom: number(0, 100), width: number(.05, 100), height: number(.05, 100), depth: number(.05, 100), rotation: number(-180, 180), color: string(7), trimColor: string(7), roughness: number(0, 1), metalness: number(0, 1), trimRoughness: number(0, 1), trimMetalness: number(0, 1), trim: number(.01, 1), radius: nullable(number(1, 50)), span: nullable(number(5, 180)), segments: integer(1, 48) }) }),
    action('remove_architectural_detail', { id: string(80) }),
    action('set_room', { room: object({ width: number(1, 100), depth: number(1, 100), height: number(1, 100), x: number(-100, 100), z: number(-100, 100), rotation: number(-100, 100), ceiling: { type: 'boolean' }, wallColor: string(7), floorColor: string(7) }) }),
    action('remove_room', {}),
    action('save_room_opening', { opening: object({ id: string(80), wall: choice('front', 'back', 'left', 'right'), offset: number(-100, 100), width: number(.1, 100), height: number(.1, 100), bottom: number(0, 100) }) }),
    action('remove_room_opening', { id: string(80) }),
    action('set_stage_dimensions', { depth: nullable(number(.1, 100)), screenWidth: nullable(number(.1, 100)), screenHeight: nullable(number(.1, 100)), screenBottom: nullable(number(0, 100)) }),
    action('set_stage', { width: number(1, 100), x: nullable(number(-100, 100)), z: nullable(number(-100, 100)), rotation: nullable(number(-100, 100)) }),
    action('set_seating', { rows: integer(1, 50), seatsPerRow: integer(1, 200), sectors: integer(1, 3), geometry: choice('straight', 'fan', 'blocks'), rake: number(0, 3), curve: number(-5, 5), seatSpacing: number(.1, 20), rowSpacing: number(.1, 20), aisleWidth: number(.1, 20) }),
    action('edit_row', { row: integer(1, 50), seats: nullable(integer(1, 200)), elevation: nullable(number(0, 100)), offsetX: nullable(number(-100, 100)), offsetY: nullable(number(-100, 100)), rotation: nullable(number(-100, 100)), curve: nullable(number(-5, 5)), frontRailing: nullable({ type: 'boolean' }) }),
    action('save_level', { id: string(80), name: string(80), elevation: number(0, 100), parapetHeight: number(.2, 2) }),
    action('assign_rows', { firstRow: integer(1, 50), lastRow: integer(1, 50), levelId: { type: 'string', maxLength: 80 } }),
    action('remove_obstacle', { id: string(80) }),
    action('remove_level', { id: string(80) }),
    action('set_row_arc', { row: integer(1, 50), radius: nullable(number(.1, 100)), degrees: nullable(number(1, 360)) }),
    action('set_row_label', { row: integer(1, 50), label: nullable(string(30)) }),
    action('save_category', { id: string(80), name: string(40), color: string(7), price: nullable(number(0, 1000000)) }),
    action('remove_category', { id: string(80) }),
    action('assign_row_category', { firstRow: integer(1, 50), lastRow: integer(1, 50), categoryId: string(80) }),
    action('assign_seat_category', { row: integer(1, 50), seat: integer(1, 200), categoryId: nullable(string(80)) }),
    action('label_accessible_seat', { row: integer(1, 50), seat: integer(1, 200), accessible: { type: 'boolean' } }),
    action('set_currency', { currency: choice('CZK', 'EUR', 'DKK', 'USD', 'GBP') }),
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
  let config = parseViewerConfig(base, true)
  for (const item of plan.actions) {
    switch (item.tool) {
      case 'save_architectural_detail': config = { ...config, architecturalDetails: [...(config.architecturalDetails ?? []).filter((d) => d.id !== item.detail.id), { ...item.detail, basis: item.basis, source: item.source }] }; break
      case 'remove_architectural_detail': {
        if (!config.architecturalDetails?.some((d) => d.id === item.id)) throw new Error('That architectural detail does not exist.')
        config = { ...config, architecturalDetails: config.architecturalDetails.filter((d) => d.id !== item.id) }; break
      }
      case 'set_room': config = { ...config, room: { ...structuredClone(item.room), ...(config.room?.openings ? { openings: config.room.openings } : {}) } }; break
      case 'save_room_opening': {
        if (!config.room) throw new Error('Create the room before adding openings.')
        const openings = config.room.openings ?? []
        config = { ...config, room: { ...config.room, openings: [...openings.filter((o) => o.id !== item.opening.id), structuredClone(item.opening)] } }; break
      }
      case 'remove_room_opening': {
        if (!config.room?.openings?.some((o) => o.id === item.id)) throw new Error('That room opening does not exist.')
        config = { ...config, room: { ...config.room, openings: config.room.openings.filter((o) => o.id !== item.id) } }; break
      }
      case 'remove_room': config = { ...config, room: undefined }; break
    case 'set_stage_dimensions': config = { ...config, ...(item.depth === null ? {} : { stageDepth: item.depth }), ...(item.screenWidth === null ? {} : { screenWidth: item.screenWidth }), ...(item.screenHeight === null ? {} : { screenHeight: item.screenHeight }), ...(item.screenBottom === null ? {} : { screenBottom: item.screenBottom }) }; break
      case 'set_stage': config = { ...config, stageWidth: item.width, stagePosition: { offsetX: item.x ?? config.stagePosition?.offsetX ?? 0, offsetY: item.z ?? config.stagePosition?.offsetY ?? 0, rotation: item.rotation ?? config.stagePosition?.rotation ?? 0 } }; break
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
      case 'remove_obstacle': {
        if (!config.obstacles?.some((o) => o.id === item.id)) throw new Error('That obstacle does not exist.')
        config = { ...config, obstacles: config.obstacles.filter((o) => o.id !== item.id) }; break
      }
      case 'remove_level': config = removeSeatingLevel(config, item.id); break
      case 'set_currency': config = { ...config, currency: item.currency }; break
      case 'save_category': {
        if (!item.name.trim() || !/^#[0-9a-f]{6}$/i.test(item.color)) throw new Error('Use a category name and a #RRGGBB colour.')
        const categories = getCategories(config)
        const category = { id: item.id, name: item.name.trim(), color: item.color, ...(item.price === null ? {} : { price: item.price }) }
        const next = categories.some((c) => c.id === item.id) ? categories.map((c) => c.id === item.id ? category : c) : [...categories, category]
        if (next.length > 8) throw new Error('Use at most 8 seat categories.')
        config = { ...config, categories: next }; break
      }
      case 'remove_category': {
        if (item.id === 'standard' || !getCategories(config).some((c) => c.id === item.id)) throw new Error('Choose an existing non-Standard category to remove.')
        config = { ...config, ...removeCategory(config, item.id) }; break
      }
      case 'assign_row_category': {
        if (item.firstRow > item.lastRow || item.lastRow > config.rows) throw new Error('Choose an existing row range.')
        if (!getCategories(config).some((c) => c.id === item.categoryId)) throw new Error('That category does not exist.')
        for (let row = item.firstRow - 1; row < item.lastRow; row++) config.rowOverrides[row] = { ...config.rowOverrides[row], categoryId: item.categoryId, seatCategories: {} }
        break
      }
      case 'set_row_arc': case 'set_row_label': case 'assign_seat_category': case 'label_accessible_seat': {
        const row = item.row - 1
        if (row >= config.rows) throw new Error(`Row ${item.row} does not exist.`)
        const override = { ...config.rowOverrides[row] }
        if (item.tool === 'set_row_arc') {
          if ((item.radius === null) !== (item.degrees === null)) throw new Error('Supply both arc radius and span, or null for both to remove the arc.')
          override.arcRadius = item.radius ?? undefined; override.arcDegrees = item.degrees ?? undefined
        } else if (item.tool === 'set_row_label') override.ticketRow = item.label ?? undefined
        else {
          const seat = item.seat - 1
          if (!generateSeatLayout(config).some((s) => s.row === row && s.seat === seat)) throw new Error('That seat does not exist in this row.')
          if (item.tool === 'label_accessible_seat') override.accessibleSeats = { ...override.accessibleSeats, [seat]: item.accessible }
          else {
            if (item.categoryId !== null && !getCategories(config).some((c) => c.id === item.categoryId)) throw new Error('That category does not exist.')
            override.seatCategories = { ...override.seatCategories }
            if (item.categoryId === null) delete override.seatCategories[seat]
            else override.seatCategories[seat] = item.categoryId
          }
        }
        config.rowOverrides[row] = override; break
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
    config = parseViewerConfig(config, true)
  }
  for (let row = 0; row < config.rows; row++) if (getRowSeats(config, row) < 1) throw new Error('Each row must contain at least one seat. Reduce the fan taper or provide explicit row counts.')
  const seats = generateSeatLayout(config)
  if ((config.rows > 0 && !seats.length) || seats.some((seat) => seat.position.some((n) => !Number.isFinite(n)))) throw new Error('The proposed layout has invalid seat geometry.')
  if (plan.actions.length && plan.expectedSeatCount !== null && seats.length !== plan.expectedSeatCount) throw new Error(`Seat count check failed: requested ${plan.expectedSeatCount}, generated ${seats.length}. Nothing was changed.`)
  if (plan.actions.some((a) => a.basis === 'estimated')) config.studyNotice = [config.studyNotice, 'Pilot draft includes estimated geometry; seat views have not been validated against identified-seat photos.'].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join('\n')
  return config
}
// Resolve the same implicit defaults as Studio, without claiming they are measured facts.
export function pilotEffectiveConfig(config: VenueConfig): VenueConfig {
  return { ...config, stagePosition: config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }, seatSpacing: config.seatSpacing ?? .72, rowSpacing: config.rowSpacing ?? .92, aisleWidth: config.aisleWidth ?? .9 }
}
export function pilotSnapshot(config: VenueConfig) {
  const value: Partial<VenueConfig> = pilotEffectiveConfig(config)
  // These descriptions do not affect any Pilot operation; apply always retains current values.
  delete value.name
  delete value.studyNotice
  const canonical = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(canonical)
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
    return item
  }
  return JSON.stringify(canonical(value))
}
export function checkPilotBase(current: VenueConfig, snapshot: string) {
  if (pilotSnapshot(current) !== snapshot) throw new Error('The venue changed after this proposal was requested. Generate a fresh proposal to keep your edits.')
}
export function pilotActionLabel(action: PilotAction) {
  switch (action.tool) {
    case 'save_architectural_detail': return `Architectural ${action.detail.kind}: ${action.detail.name}`
    case 'remove_architectural_detail': return `Remove architectural detail ${action.id}`
    case 'set_room': return `Room: ${action.room.width} × ${action.room.depth} × ${action.room.height} m`
    case 'save_room_opening': return `Opening ${action.opening.id}: ${action.opening.wall} wall, ${action.opening.width} × ${action.opening.height} m`
    case 'remove_room_opening': return `Remove opening ${action.id}`
    case 'remove_room': return 'Remove room shell'
    case 'set_stage_dimensions': return 'Stage depth and screen dimensions (metres; null preserves existing values)'
    case 'set_stage': return `Stage: ${action.width} m wide; offsets ${action.x ?? 'unchanged'}, ${action.z ?? 'unchanged'}; rotation ${action.rotation === null ? 'unchanged' : action.rotation + '°'}`
    case 'set_seating': return `Seating: ${action.rows} rows, ${action.seatsPerRow} default seats; ${action.geometry}`
    case 'edit_row': return `Edit row ${action.row}`
    case 'save_level': return `Level: ${action.name}, ${action.elevation} m above ground`
    case 'assign_rows': return `Assign rows ${action.firstRow}–${action.lastRow} to ${action.levelId || 'main floor'}`
    case 'remove_obstacle': return `Remove obstacle ${action.id}`
    case 'remove_level': return `Remove level ${action.id}; preserve row world heights`
    case 'set_row_arc': return action.radius === null ? `Remove arc from row ${action.row}` : `Row ${action.row}: ${action.radius} m radius, ${action.degrees}° arc`
    case 'set_row_label': return `Row ${action.row}: ticket label ${action.label ?? 'default'}`
    case 'save_category': return `Category: ${action.name}, ${action.price === null ? 'unpriced' : action.price}`
    case 'remove_category': return `Remove category ${action.id}; reassign to Standard`
    case 'assign_row_category': return `Rows ${action.firstRow}–${action.lastRow}: category ${action.categoryId}; replace seat overrides`
    case 'assign_seat_category': return `Row ${action.row}, seat position ${action.seat}: ${action.categoryId ?? 'inherit row category'}`
    case 'label_accessible_seat': return `Row ${action.row}, seat position ${action.seat}: ${action.accessible ? 'add' : 'remove'} accessibility label only`
    case 'set_currency': return `Display prices in ${action.currency} (no conversion)`
    case 'save_obstacle': return `${action.obstacle.kind}: ${action.obstacle.name}`
  }
}
