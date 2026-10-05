import { LoadingManager, Mesh, Texture, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export function validateGlb(data: ArrayBuffer) {
  if (data.byteLength < 20 || data.byteLength > 25 * 1024 * 1024) throw new Error('Choose a GLB file smaller than 25 MB.')
  const view = new DataView(data)
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== data.byteLength) throw new Error('This is not a valid glTF 2 GLB file.')
  const length = view.getUint32(12, true)
  if (view.getUint32(16, true) !== 0x4e4f534a || length > data.byteLength - 20) throw new Error('Invalid GLB JSON chunk.')
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, length)))
  if (!json || typeof json !== 'object' || json.asset?.version !== '2.0') throw new Error('Unsupported model version.')
  // Only fully embedded geometry/textures: never fetch URLs referenced by a model.
  for (const list of [json.buffers ?? [], json.images ?? []]) {
    if (!Array.isArray(list) || list.some((item) => !item || item.uri !== undefined)) throw new Error('External resources are not supported. Export a self-contained GLB.')
  }
  if ((json.nodes?.length ?? 0) > 10000 || (json.accessors ?? []).reduce((sum: number, a: { count?: number }) => sum + (a.count ?? 0), 0) > 6000000) throw new Error('Model is too complex. Simplify it in Blender first.')
  return json
}

export async function loadLocalGlb(file: File) {
  if (!file.name.toLowerCase().endsWith('.glb') || file.size > 25 * 1024 * 1024) throw new Error('Choose a .glb file smaller than 25 MB.')
  const data = await file.arrayBuffer()
  validateGlb(data)
  const manager = new LoadingManager()
  manager.setURLModifier((url) => { if (!url.startsWith('blob:')) throw new Error('External model resources are blocked.'); return url })
  return (await new GLTFLoader(manager).parseAsync(data, '')).scene
}

export function disposeLocalModel(root: Object3D) {
  const textures = new Set<Texture>()
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    object.geometry.dispose()
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value)
      material.dispose()
    }
  })
  for (const texture of textures) { texture.dispose(); if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close() }
}
