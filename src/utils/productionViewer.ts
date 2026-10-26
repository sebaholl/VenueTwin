import { Box3, Group, PerspectiveCamera, Vector3 } from 'three'
export type ProductionSeat = { id: string; label: string; row: string; level_id: string; position: [number, number, number]; eye: [number, number, number]; yaw: number; vertical_fov_deg: number }
export type ProductionManifest = { format: 'venuetwin-customer'; version: 2; venue_id: string; revision: number; name: string; quality: 'demonstration' | 'study' | 'reviewed'; notice: string; model: { file: string; sha256: string }; levels: { id: string; name: string }[]; seats: ProductionSeat[]; target: [number, number, number] }
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown, max = 500): v is string => typeof v === 'string' && !!v.trim() && v.length <= max
const id = (v: unknown): v is string => text(v, 100) && /^[A-Za-z0-9_.:-]+$/.test(v)
const vector = (v: unknown): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 500)
function keys(v: unknown, expected: string[]): v is Record<string, unknown> { return record(v) && Object.keys(v).length === expected.length && expected.every(k => Object.hasOwn(v, k)) }
export function parseProductionManifest(value: unknown): ProductionManifest {
  const fail = () => { throw new Error('Invalid customer venue package.') }
  if (!keys(value, ['format', 'version', 'venue_id', 'revision', 'name', 'quality', 'notice', 'model', 'levels', 'seats', 'target'])) return fail()
  if (value.format !== 'venuetwin-customer' || value.version !== 2 || !id(value.venue_id) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1 || !text(value.name) || !['demonstration', 'study', 'reviewed'].includes(String(value.quality)) || !text(value.notice) || !vector(value.target)) return fail()
  if (!keys(value.model, ['file', 'sha256']) || value.model.file !== 'venue.glb' || typeof value.model.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(value.model.sha256)) return fail()
  if (!Array.isArray(value.levels) || !value.levels.length || value.levels.length > 30 || value.levels.some(x => !keys(x, ['id', 'name']) || !id(x.id) || !text(x.name))) return fail()
  const levels = new Set(value.levels.map(x => x.id))
  if (levels.size !== value.levels.length) return fail()
  if (!Array.isArray(value.seats) || !value.seats.length || value.seats.length > 2000 || value.seats.some(s => !keys(s, ['id', 'label', 'row', 'level_id', 'position', 'eye', 'yaw', 'vertical_fov_deg']) || !id(s.id) || !text(s.label) || !text(s.row) || !levels.has(s.level_id) || !vector(s.position) || !vector(s.eye) || typeof s.yaw !== 'number' || !Number.isFinite(s.yaw) || Math.abs(s.yaw) > Math.PI * 2 || typeof s.vertical_fov_deg !== 'number' || !Number.isFinite(s.vertical_fov_deg) || s.vertical_fov_deg < 10 || s.vertical_fov_deg > 120)) return fail()
  if (new Set(value.seats.map(s => s.id)).size !== value.seats.length) return fail()
  return structuredClone(value) as ProductionManifest
}
export function productionCameras(model: Group, manifest: ProductionManifest) {
  model.updateMatrixWorld(true)
  const cameras = new Map<string, PerspectiveCamera>(), anchors = new Map<string, Vector3>()
  model.traverse(o => {
    if (!o.matrixWorld.elements.every(Number.isFinite)) throw new Error('Invalid model transform.')
    const cameraId = o.userData.venueTwinCameraSeatId, seatId = o.userData.venueTwinSeatId
    if (cameraId !== undefined) {
      if (!(o instanceof PerspectiveCamera) || cameras.has(cameraId)) throw new Error('Invalid or duplicate seat camera.')
      cameras.set(cameraId, o)
    }
    if (seatId !== undefined) {
      if (anchors.has(seatId)) throw new Error('Duplicate seat anchor.')
      anchors.set(seatId, o.getWorldPosition(new Vector3()))
    }
  })
  if (cameras.size !== manifest.seats.length || anchors.size !== manifest.seats.length) throw new Error('The model does not contain the expected seat views.')
  for (const seat of manifest.seats) {
    const camera = cameras.get(seat.id), anchor = anchors.get(seat.id)
    const expected = new Vector3(...manifest.target).sub(new Vector3(...seat.eye)).normalize()
    if (!camera || !anchor || anchor.distanceTo(new Vector3(...seat.position)) > .0001 || camera.getWorldPosition(new Vector3()).distanceTo(new Vector3(...seat.eye)) > .0001 || camera.getWorldDirection(new Vector3()).distanceTo(expected) > .0001 || !Number.isFinite(camera.fov) || Math.abs(camera.fov - seat.vertical_fov_deg) > .0001) throw new Error('Seat views do not match this venue package.')
  }
  const bounds = new Box3().setFromObject(model)
  if (bounds.isEmpty() || ![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)) throw new Error('Venue geometry is missing.')
  return { cameras, bounds }
}
export function productionSeatLink(origin: string, path: string, seat: string) {
  const url = new URL('/venue', origin)
  url.searchParams.set('venue', path); url.searchParams.set('seat', seat)
  return url.href
}
