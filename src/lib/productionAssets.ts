import { limitedFetch } from './viewerAssets'
import { assetUrl, sha256 } from '../utils/customerViewer'
import { parseProductionManifest, productionCameras } from '../utils/productionViewer'
import { disposeLocalModel, loadLocalGlb } from '../utils/localGlb'
export async function loadProductionVenue(path: string, signal: AbortSignal) {
  const timeout = AbortSignal.timeout(45000)
  const combined = AbortSignal.any([signal, timeout])
  const url = assetUrl(path, location.origin, location.origin)
  const manifest = parseProductionManifest(JSON.parse(await (await limitedFetch(url, 2 * 1024 * 1024, combined)).text()))
  const blob = await limitedFetch(assetUrl(manifest.model.file, url, location.origin), 25 * 1024 * 1024, combined)
  if (await sha256(blob) !== manifest.model.sha256) throw new Error('The model does not match this venue version.')
  const model = await loadLocalGlb(new File([blob], 'venue.glb'))
  try {
    combined.throwIfAborted()
    const { cameras, bounds } = productionCameras(model, manifest)
    return { manifest, model, cameras, bounds }
  } catch (error) { disposeLocalModel(model); throw error }
}
export type LoadedProduction = Awaited<ReturnType<typeof loadProductionVenue>>
