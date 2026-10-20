import { parseViewerConfig, type ViewerSnapshot } from '../utils/customerViewer'

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('venuetwin-viewer', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('previews')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Local preview storage is unavailable in this browser.'))
    request.onblocked = () => reject(new Error('Close other VenueTwin tabs and try again.'))
  })
}

export async function saveViewerSnapshot(snapshot: ViewerSnapshot) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('previews', 'readwrite')
      transaction.objectStore('previews').put({ ...snapshot, config: parseViewerConfig(snapshot.config) }, 'latest')
      transaction.oncomplete = () => resolve()
      transaction.onabort = transaction.onerror = () => reject(new Error('Could not store the local preview. Check available browser storage.'))
    })
  } finally { db.close() }
}

export async function loadViewerSnapshot(): Promise<ViewerSnapshot> {
  const db = await database()
  try {
    const snapshot = await new Promise<ViewerSnapshot | undefined>((resolve, reject) => {
      const request = db.transaction('previews').objectStore('previews').get('latest')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(new Error('Could not read the local preview.'))
    })
    if (!snapshot) throw new Error('Open Studio and choose Customer preview to prepare this viewer.')
    if (snapshot.model && (!(snapshot.model instanceof Blob) || snapshot.model.size > 25 * 1024 * 1024)) throw new Error('Invalid stored model. Prepare the preview again in Studio.')
    return { ...snapshot, config: parseViewerConfig(snapshot.config) }
  } finally { db.close() }
}
