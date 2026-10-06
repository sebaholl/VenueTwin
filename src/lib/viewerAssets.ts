import { assetUrl, parseViewerConfig, sha256, type ViewerSnapshot } from '../utils/customerViewer'

async function limitedFetch(url: string, limit: number, signal: AbortSignal) {
  const response = await fetch(url, { signal, credentials: 'omit', redirect: 'error' })
  if (!response.ok) throw new Error(`Could not load viewer file (${response.status}).`)
  if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); throw new Error('Viewer file exceeds the size limit.') }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty viewer file.')
  const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) { await reader.cancel(); throw new Error('Viewer file exceeds the size limit.') }
    chunks.push(new Uint8Array(value))
  }
  return new Blob(chunks)
}

export async function loadPublishedViewer(path: string, signal: AbortSignal): Promise<ViewerSnapshot> {
  const manifestUrl = assetUrl(path, location.origin, location.origin)
  const data = JSON.parse(await (await limitedFetch(manifestUrl, 2 * 1024 * 1024, signal)).text())
  if (data?.format !== 'venuetwin-viewer' || data.version !== 1) throw new Error('Unsupported viewer manifest.')
  const config = parseViewerConfig(data.config)
  let model: Blob | null = null
  if (data.model !== undefined) {
    if (typeof data.model?.file !== 'string' || !/^[a-f0-9]{64}$/.test(data.model?.sha256)) throw new Error('Invalid model manifest.')
    model = await limitedFetch(assetUrl(data.model.file, manifestUrl, location.origin), 25 * 1024 * 1024, signal)
    if (await sha256(model) !== data.model.sha256) throw new Error('The model does not match this viewer project. Upload the matching venue.json and venue.glb.')
  }
  return { config, model, createdAt: '' }
}
