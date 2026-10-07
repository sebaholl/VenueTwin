import type { VenueConfig } from '../types/venue'
import { generateSeatLayout, getSeatLabel } from './venue'

export type ViewerSnapshot = { config: VenueConfig; model: Blob | null; createdAt: string }
export type ViewerManifest = { format: 'venuetwin-viewer'; version: 1; config: VenueConfig; model?: { file: string; sha256: string } }
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const finite = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max

// Validate before generating geometry: published manifests are untrusted input.
export function parseViewerConfig(value: unknown): VenueConfig {
  if (!record(value) || typeof value.name !== 'string' || value.name.length > 200 || !finite(value.rows, 1, 50) || !Number.isInteger(value.rows) || !finite(value.seatsPerRow, 1, 200) || !Number.isInteger(value.seatsPerRow) || !finite(value.sectors, 1, 3) || !Number.isInteger(value.sectors) || !finite(value.rake, 0, 3) || !finite(value.curve, -5, 5) || !finite(value.stageWidth, 1, 100) || !['straight', 'fan', 'blocks'].includes(String(value.geometry)) || !record(value.rowOverrides)) throw new Error('Invalid venue geometry in the viewer project.')
  for (const field of ['seatSpacing', 'rowSpacing', 'aisleWidth']) if (value[field] !== undefined && !finite(value[field], .01, 20)) throw new Error('Invalid seat spacing.')
  if (value.seatingLevels !== undefined && (!Array.isArray(value.seatingLevels) || value.seatingLevels.length > 30 || value.seatingLevels.some((level) => !record(level) || typeof level.id !== 'string' || typeof level.name !== 'string' || !finite(level.elevation, 0, 100)))) throw new Error('Invalid seating levels.')
  if (Array.isArray(value.seatingLevels) && (new Set(value.seatingLevels.map((l) => l.id)).size !== value.seatingLevels.length || value.seatingLevels.some((l) => l.id === '__main'))) throw new Error('Seating levels need unique IDs.')
  if (Object.keys(value.rowOverrides).length > 50) throw new Error('Too many row overrides.')
  let count = 0
  for (let row = 0; row < value.rows; row++) {
    const r = value.rowOverrides[row] ?? {}
    if (!record(r)) throw new Error('Invalid row.')
    if (r.ticketRow !== undefined && (typeof r.ticketRow !== 'string' || !r.ticketRow.trim() || r.ticketRow.length > 30)) throw new Error('Invalid ticket row label.')
    if (r.numberingSource !== undefined && r.numberingSource !== 'nd-stalls-2025') throw new Error('Unknown numbering source.')
    if (r.seats !== undefined && (!finite(r.seats, 1, 200) || !Number.isInteger(r.seats))) throw new Error('Invalid row seat count.')
    for (const field of ['elevation', 'offsetX', 'offsetY', 'rotation', 'curve']) if (r[field] !== undefined && !finite(r[field], -100, 100)) throw new Error('Invalid row position.')
    if (r.arcRadius !== undefined && !finite(r.arcRadius, .1, 100)) throw new Error('Invalid row radius.')
    if (r.arcDegrees !== undefined && !finite(r.arcDegrees, 1, 360)) throw new Error('Invalid row arc.')
    if (r.levelId !== undefined && typeof r.levelId !== 'string') throw new Error('Invalid row level.')
    count += (r.seats as number | undefined) ?? value.seatsPerRow
  }
  if (count > 2000) throw new Error('The viewer supports up to 2,000 seats.')
  const labels = new Set<string>()
  for (let row = 0; row < value.rows; row++) {
    const label = getSeatLabel(value as VenueConfig, row, 0)
    if (labels.has(label)) throw new Error('Duplicate ticket row labels on the same level.')
    labels.add(label)
  }
  if (value.stagePosition !== undefined && (!record(value.stagePosition) || ['offsetX', 'offsetY', 'rotation'].some((f) => !finite((value.stagePosition as Record<string, unknown>)[f], -100, 100)))) throw new Error('Invalid stage position.')
  if (value.studyNotice !== undefined && typeof value.studyNotice !== 'string') throw new Error('Invalid study notice.')
  if (value.categories !== undefined && !Array.isArray(value.categories)) throw new Error('Invalid seat categories.')
  if (value.obstacles !== undefined && (!Array.isArray(value.obstacles) || value.obstacles.length > 100 || value.obstacles.some((o) => !record(o) || typeof o.id !== 'string' || !['column', 'wall', 'railing'].includes(String(o.kind)) || ['x', 'z', 'elevation', 'rotation'].some((f) => !finite(o[f], -100, 100)) || ['width', 'height', 'depth'].some((f) => !finite(o[f], .01, 100))))) throw new Error('Invalid structures.')
  return structuredClone(value) as VenueConfig
}

export function geometrySignature(config: VenueConfig) {
  return JSON.stringify({ seats: generateSeatLayout(config).map((s) => [s.row, s.seat, s.position, s.rotation]), stage: config.stagePosition, width: config.stageWidth, rowSpacing: config.rowSpacing, obstacles: (config.obstacles ?? []).map((o) => [o.kind, o.x, o.z, o.elevation, o.width, o.height, o.depth, o.rotation]) })
}

export function viewerLevels(config: VenueConfig) {
  const seats = generateSeatLayout(config)
  const known = config.seatingLevels ?? []
  const levels = known.map((level) => ({ id: level.id, name: level.name, seats: seats.filter((s) => config.rowOverrides[s.row]?.levelId === level.id) })).filter((level) => level.seats.length)
  const unassigned = seats.filter((s) => !known.some((level) => level.id === config.rowOverrides[s.row]?.levelId))
  if (unassigned.length) levels.unshift({ id: '__main', name: known.length ? 'Other seats' : 'Main floor', seats: unassigned })
  return levels
}

export async function sha256(blob: Blob) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function viewerManifest(snapshot: ViewerSnapshot): Promise<ViewerManifest> {
  return { format: 'venuetwin-viewer', version: 1, config: snapshot.config, ...(snapshot.model ? { model: { file: 'venue.glb', sha256: await sha256(snapshot.model) } } : {}) }
}

export function assetUrl(path: string, base: string, origin: string) {
  const url = new URL(path, base)
  if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.startsWith('/venues/')) throw new Error('Viewer files must be hosted under /venues/ on this website.')
  return url.href
}

export function embedCode(origin: string, folder: string) {
  if (!/^\/venues\/[a-zA-Z0-9/_-]+$/.test(folder)) throw new Error('Use a folder such as /venues/national-theatre.')
  const src = `${origin}/viewer?venue=${encodeURIComponent(folder.replace(/\/$/, '') + '/venue.json')}`
  return `<iframe src="${src}" title="Interactive venue and seat views" width="100%" height="720" style="border:0;border-radius:16px" loading="lazy" allow="fullscreen" allowfullscreen></iframe>`
}

export function downloadViewerFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
