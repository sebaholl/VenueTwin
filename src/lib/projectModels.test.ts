import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadProjectModel, removeProjectModel, saveProjectModel, validateProjectModel } from './projectModels'

const record = { file: new Blob([new Uint8Array(32)]), name: 'theatre.glb', signature: 'original-geometry', savedAt: '2026-10-07' }
afterEach(() => vi.unstubAllGlobals())

// Controlled IndexedDB events exercise completion/error handling without pretending
// to replace a real browser's storage implementation.
function storage(result: unknown = record) {
  const request = { result, onsuccess: () => {} }
  const store = { get: vi.fn(() => request), put: vi.fn(() => request), delete: vi.fn(() => request) }
  const transaction = { objectStore: () => store, oncomplete: () => {}, onabort: () => {}, onerror: () => {} }
  const db = { transaction: vi.fn(() => transaction), close: vi.fn() }
  const open = { result: db, onsuccess: () => {} }
  vi.stubGlobal('indexedDB', { open: () => { queueMicrotask(() => open.onsuccess()); return open } })
  return { request, store, transaction, db }
}
async function started() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }

describe('project model persistence', () => {
  it('keeps the original geometry signature when restoring a saved record', async () => {
    const mock = storage(), pending = loadProjectModel('project-a')
    await started(); mock.request.onsuccess(); mock.transaction.oncomplete()
    expect(await pending).toEqual(record)
    expect(mock.store.get).toHaveBeenCalledWith('project-a')
    expect(mock.db.close).toHaveBeenCalledOnce()
  })
  it('reports a save only after the write transaction commits', async () => {
    const mock = storage('project-b'), done = vi.fn()
    const pending = saveProjectModel('project-b', record).then(done)
    await started(); mock.request.onsuccess(); await started()
    expect(done).not.toHaveBeenCalled()
    expect(mock.store.put).toHaveBeenCalledWith(record, 'project-b')
    mock.transaction.oncomplete(); await pending
    expect(done).toHaveBeenCalledOnce()
  })
  it('rejects an aborted save and closes its connection', async () => {
    const mock = storage(), pending = saveProjectModel('project-a', record)
    const check = expect(pending).rejects.toThrow('Could not update')
    await started(); mock.transaction.onabort(); await check
    expect(mock.db.close).toHaveBeenCalledOnce()
  })
  it('removes only the requested project record', async () => {
    const mock = storage(), pending = removeProjectModel('project-a')
    await started(); mock.request.onsuccess(); mock.transaction.oncomplete(); await pending
    expect(mock.store.delete).toHaveBeenCalledWith('project-a')
  })
  it('rejects corrupt saved metadata and oversized models', () => {
    for (const invalid of [null, { ...record, file: 'not a blob' }, { ...record, signature: '' }, { ...record, name: 'model.txt' }, { ...record, file: new Blob([new Uint8Array(26 * 1024 * 1024)]) }]) expect(() => validateProjectModel(invalid)).toThrow()
  })
})
