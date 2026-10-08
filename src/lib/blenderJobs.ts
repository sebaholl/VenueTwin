import type { VenueConfig } from '../types/venue'
import { blenderBlueprint } from '../utils/blenderBridge'
import { geometrySignature } from '../utils/customerViewer'

type Status = { id: string; state: 'running' | 'completed' | 'failed' | 'cancelled'; stage: string; signature: string; error?: string }
async function json(response: Response): Promise<Status> {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? 'Local Blender build failed.')
  return data
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Cancelled', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1000)
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
}
export async function buildLocalModel(config: VenueConfig, signal: AbortSignal, progress: (stage: string) => void, fetcher: typeof fetch = fetch) {
  let id = '', completed = false
  const cancel = async () => { if (id) await fetcher(`/api/blender/jobs/${id}`, { method: 'DELETE' }).catch(() => {}) }
  try {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    // Obtain the job ID even when cancellation arrives during submission, then cancel it.
    let status = await json(await fetcher('/api/blender/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config }) }))
    id = status.id
    while (status.state === 'running') {
      progress(status.stage)
      await pause(signal)
      status = await json(await fetcher(`/api/blender/jobs/${id}`, { signal }))
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (status.state !== 'completed') throw new Error(status.error ?? 'Blender build did not complete.')
    if (status.signature !== geometrySignature(config)) throw new Error('Build layout does not match the requested venue. Rebuild it.')
    progress('Importing model into Studio')
    const response = await fetcher(`/api/blender/jobs/${id}/model`, { signal })
    if (!response.ok) throw new Error('Could not retrieve the generated model. Try building again.')
    const blob = await response.blob()
    if (blob.size > 25 * 1024 * 1024) throw new Error('The generated model exceeds 25 MB.')
    completed = true
    return { file: new File([blob], 'venue-built.glb', { type: 'model/gltf-binary' }), signature: status.signature }
  } finally { if (!completed) await cancel() }
}

export function assertBuildCurrent(original: VenueConfig, current: VenueConfig) {
  if (JSON.stringify(blenderBlueprint(original)) !== JSON.stringify(blenderBlueprint(current))) throw new Error('The layout changed during this build. The existing model was kept. Build again for the current layout.')
}
