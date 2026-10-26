import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export function inspectEmbeddedTextures(bytes, source = null) {
  const jsonLength = bytes.readUInt32LE(12)
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  assert.ok(!json.buffers?.some(buffer => buffer.uri), 'External buffers are forbidden')
  assert.ok(!json.images?.some(image => image.uri), 'External images are forbidden')
  assert.ok(!json.extensionsRequired?.length, 'Unexpected glTF extensions')
  const binHeader = 20 + jsonLength
  assert.equal(bytes.readUInt32LE(binHeader + 4), 0x004e4942, 'Missing GLB binary chunk')
  const binStart = binHeader + 8, binLength = bytes.readUInt32LE(binHeader)
  assert.ok(binStart + binLength <= bytes.length, 'Truncated GLB binary chunk')
  const expected = new Map((source?.materials ?? []).filter(material => material.base_color_texture_source_id).map(material => {
    const record = source.sources?.find(item => item.id === material.base_color_texture_source_id)
    assert.ok(record?.sha256, `Missing source for ${material.id}`)
    return [`VT_${material.id}`, record.sha256]
  }))
  const seenImages = new Set(), seenTextures = new Set(), seenMaterials = new Set()
  for (const material of json.materials ?? []) {
    const texture = material.pbrMetallicRoughness?.baseColorTexture
    assert.ok(!material.normalTexture && !material.occlusionTexture && !material.emissiveTexture &&
      !material.pbrMetallicRoughness?.metallicRoughnessTexture, 'Unsupported material texture map')
    if (!texture) continue
    const sha = expected.get(material.name)
    assert.ok((source === null || sha) && !seenMaterials.has(material.name), `Unexpected textured material ${material.name}`)
    assert.equal(texture.texCoord ?? 0, 0, 'Texture must use primary UV channel')
    const entry = json.textures?.[texture.index], image = json.images?.[entry?.source]
    assert.ok(entry && image?.mimeType === 'image/png' && Number.isInteger(image.bufferView), 'Texture must embed PNG')
    const view = json.bufferViews?.[image.bufferView]
    assert.ok(view && (view.buffer ?? 0) === 0 && Number.isInteger(view.byteLength) && view.byteLength > 0, 'Invalid PNG buffer view')
    const start = binStart + (view.byteOffset ?? 0), end = start + view.byteLength
    assert.ok(start >= binStart && end <= binStart + binLength, 'PNG exceeds GLB binary chunk')
    const actual = createHash('sha256').update(bytes.subarray(start, end)).digest('hex')
    if (source !== null) assert.equal(actual, sha, `Embedded texture differs from source ${material.name}`)
    seenMaterials.add(material.name); seenTextures.add(texture.index); seenImages.add(entry.source)
  }
  if (source !== null) assert.equal(seenMaterials.size, expected.size, 'Missing source-linked texture')
  assert.equal(seenTextures.size, json.textures?.length ?? 0, 'Unexpected texture')
  assert.equal(seenImages.size, json.images?.length ?? 0, 'Unexpected image')
  // Node has no DOM image decoder. Strip texture references only in the copy used
  // for numeric Three.js checks; the original GLB is hashed and published intact.
  const stripped = structuredClone(json)
  for (const material of stripped.materials ?? []) delete material.pbrMetallicRoughness?.baseColorTexture
  delete stripped.images; delete stripped.textures; delete stripped.samplers
  const encoded = Buffer.from(JSON.stringify(stripped))
  const padding = (4 - encoded.length % 4) % 4
  const jsonBytes = Buffer.concat([encoded, Buffer.alloc(padding, 0x20)])
  const tail = bytes.subarray(binHeader)
  const output = Buffer.alloc(20)
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4)
  output.writeUInt32LE(20 + jsonBytes.length + tail.length, 8)
  output.writeUInt32LE(jsonBytes.length, 12); output.writeUInt32LE(0x4e4f534a, 16)
  return { json, textureCount: seenImages.size, parseBytes: Buffer.concat([output, jsonBytes, tail]) }
}
