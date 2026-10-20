import { acceptedFindings, parseReferenceAnalysis, type AnalysisRecord, type AnalysisSource } from '../utils/referenceAnalysis'
import type { ReferenceAsset } from './projectReferences'
const key = (id: string) => `venuetwin-analysis:${id}`
export async function sourceFor(asset: ReferenceAsset): Promise<AnalysisSource> {
  const bytes = await new Blob([asset.name, '\n', asset.caption, '\n', asset.file]).arrayBuffer()
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('')
  return { id: asset.id, name: asset.name, mime: asset.file.type, hash }
}
export function loadAnalysis(id: string): AnalysisRecord | null {
  const raw = localStorage.getItem(key(id)); if (!raw) return null
  const value = JSON.parse(raw) as AnalysisRecord
  if (!Array.isArray(value.sources) || value.sources.length > 4 || value.sources.some((s) => !s || typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.mime !== 'string' || !/^[a-f0-9]{64}$/.test(s.hash)) || new Set(value.sources.map((s) => s.id)).size !== value.sources.length) throw new Error('Saved analysis is invalid. Analyse your files again.')
  value.analysis = parseReferenceAnalysis(value.analysis, value.sources)
  if (!Array.isArray(value.accepted) || value.accepted.some((i) => !Number.isInteger(i) || i < 0 || i >= value.analysis.findings.length)) throw new Error('Saved review is invalid.')
  return value
}
export function saveAnalysis(id: string, value: AnalysisRecord) { localStorage.setItem(key(id), JSON.stringify(value)) }
export async function reviewedFindings(id: string, assets: ReferenceAsset[]) {
  const report = loadAnalysis(id); if (!report) return []
  const sources = await Promise.all(assets.filter((asset) => report.sources.some((s) => s.id === asset.id)).map(sourceFor))
  const valid = sources.filter((s) => report.sources.some((old) => old.id === s.id && old.hash === s.hash)).map((s) => s.id)
  return acceptedFindings(report, valid)
}
export function fileData(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Cannot read this reference file.')); reader.readAsDataURL(file) })
}
