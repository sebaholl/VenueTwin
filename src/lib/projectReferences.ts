export type ReferenceAsset = { id: string; kind: 'plan' | 'photo'; name: string; file: Blob; caption: string }
export type ReferenceMeasurement = { id: string; label: string; meters: number; source: string; confidence: 'measured' | 'estimated' }
export type ProjectReferences = { assets: ReferenceAsset[]; activePlanId: string | null; notes: string; measurements: ReferenceMeasurement[] }
export const emptyReferences = (): ProjectReferences => ({ assets: [], activePlanId: null, notes: '', measurements: [] })

export function validateReferences(value: ProjectReferences) {
  if (!value || !Array.isArray(value.assets) || value.assets.length > 20 || !Array.isArray(value.measurements) || value.measurements.length > 30 || typeof value.notes !== 'string' || value.notes.length > 10000) throw new Error('Use up to 20 reference files, 30 measurements and 10,000 characters of notes.')
  let bytes = 0
  const ids = new Set<string>()
  for (const asset of value.assets) {
    if (!asset || typeof asset.id !== 'string' || ids.has(asset.id) || !['plan', 'photo'].includes(asset.kind) || typeof asset.name !== 'string' || typeof asset.caption !== 'string' || asset.caption.length > 1000 || !(asset.file instanceof Blob) || !asset.file.size || asset.file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', ...(asset.kind === 'plan' ? ['application/pdf'] : [])].includes(asset.file.type)) throw new Error('Use JPG, PNG or WebP images, or a PDF plan, up to 10 MB each. Captions allow 1,000 characters.')
    ids.add(asset.id); bytes += asset.file.size
  }
  if (bytes > 40 * 1024 * 1024) throw new Error('Keep project references below 40 MB in total.')
  if (value.activePlanId !== null && !value.assets.some((asset) => asset.id === value.activePlanId && asset.kind === 'plan')) throw new Error('The selected floor plan is missing.')
  for (const item of value.measurements) if (!item || typeof item.id !== 'string' || typeof item.label !== 'string' || !item.label.trim() || item.label.length > 100 || !Number.isFinite(item.meters) || item.meters <= 0 || item.meters > 1000 || typeof item.source !== 'string' || item.source.length > 500 || !['measured', 'estimated'].includes(item.confidence)) throw new Error('Measurements need a name and a positive value up to 1,000 metres.')
  return value
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('venuetwin-project-references', 1)
    let failed = false
    request.onupgradeneeded = () => request.result.createObjectStore('references')
    request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result) }
    request.onerror = request.onblocked = () => { failed = true; reject(new Error('Reference storage is unavailable. Close other VenueTwin tabs or check browser storage.')) }
  })
}
export async function projectReferences(projectId: string, next?: ProjectReferences): Promise<ProjectReferences> {
  if (!projectId) throw new Error('Choose a project first.')
  if (next) validateReferences(next)
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('references', next ? 'readwrite' : 'readonly')
      const store = transaction.objectStore('references')
      const request = next ? store.put(next, projectId) : store.get(projectId)
      let result: ProjectReferences | undefined
      request.onsuccess = () => { if (!next) result = request.result }
      transaction.oncomplete = () => { try { resolve(validateReferences(next ?? result ?? emptyReferences())) } catch (error) { reject(error) } }
      transaction.onerror = transaction.onabort = () => reject(new Error('References were not saved. Free browser storage and retry; your previous saved references are unchanged.'))
    })
  } finally { db.close() }
}
