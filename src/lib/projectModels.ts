export type ProjectModel = { file: Blob; name: string; signature: string; savedAt: string }

export function validateProjectModel(value: unknown): ProjectModel {
  const record = value as Partial<ProjectModel> | null
  if (!record || !(record.file instanceof Blob) || record.file.size > 25 * 1024 * 1024 || record.file.size < 20 || typeof record.name !== 'string' || !record.name.toLowerCase().endsWith('.glb') || typeof record.signature !== 'string' || !record.signature || typeof record.savedAt !== 'string') throw new Error('The saved model is invalid. Remove it and import your GLB again.')
  return record as ProjectModel
}

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('venuetwin-project-models', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('models')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Model storage is unavailable. Your browser may be out of space or blocking storage.'))
    request.onblocked = () => reject(new Error('Close other VenueTwin tabs and retry model storage.'))
  })
}
async function operation<T>(projectId: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (!projectId) throw new Error('A project is required to store a model.')
  const db = await database()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction('models', mode)
      const request = action(transaction.objectStore('models'))
      let result: T
      request.onsuccess = () => { result = request.result }
      transaction.oncomplete = () => resolve(result)
      transaction.onabort = transaction.onerror = () => reject(new Error('Could not update model storage. Check browser storage space and try again.'))
    })
  } finally { db.close() }
}
export async function loadProjectModel(projectId: string) {
  const record = await operation<unknown>(projectId, 'readonly', (store) => store.get(projectId))
  return record === undefined ? null : validateProjectModel(record)
}
export async function saveProjectModel(projectId: string, record: ProjectModel) {
  validateProjectModel(record)
  await operation(projectId, 'readwrite', (store) => store.put(record, projectId))
}
export async function removeProjectModel(projectId: string) {
  await operation(projectId, 'readwrite', (store) => store.delete(projectId))
}
