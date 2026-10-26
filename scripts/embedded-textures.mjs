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
  const inspect = (texture, material, sha = null) => {
    assert.equal(texture.texCoord ?? 0, 0, 'Texture must use primary UV channel')
    const entry = json.textures?.[texture.index], image = json.images?.[entry?.source]
    assert.ok(entry && image && Number.isInteger(image.bufferView) &&
      ['image/png', 'image/jpeg'].includes(image.mimeType), 'Texture must embed PNG or JPEG')
    if (source !== null) assert.equal(image.mimeType, 'image/png', 'Reviewed source texture must embed PNG')
    const view = json.bufferViews?.[image.bufferView]
    assert.ok(view && (view.buffer ?? 0) === 0 && Number.isInteger(view.byteLength) && view.byteLength > 0, 'Invalid image buffer view')
    const start = binStart + (view.byteOffset ?? 0), end = start + view.byteLength
    assert.ok(start >= binStart && end <= binStart + binLength, 'Image exceeds GLB binary chunk')
    const imageBytes = bytes.subarray(start, end)
    assert.ok(image.mimeType === 'image/jpeg' ? imageBytes[0] === 0xff && imageBytes[1] === 0xd8 : imageBytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Image signature does not match MIME type')
    const actual = createHash('sha256').update(imageBytes).digest('hex')
    if (sha) assert.equal(actual, sha, `Embedded texture differs from source ${material.name}`)
    seenTextures.add(texture.index); seenImages.add(entry.source)
  }
  for (const material of json.materials ?? []) {
    const texture = material.pbrMetallicRoughness?.baseColorTexture
    assert.ok((source === null || !material.normalTexture) && !material.occlusionTexture && !material.emissiveTexture &&
      !material.pbrMetallicRoughness?.metallicRoughnessTexture, 'Unsupported material texture map')
    if (!texture && !material.normalTexture) continue
    const sha = expected.get(material.name)
    assert.ok((source === null || sha) && !seenMaterials.has(material.name), `Unexpected textured material ${material.name}`)
    if (texture) inspect(texture, material, sha)
    if (material.normalTexture) inspect(material.normalTexture, material)
    seenMaterials.add(material.name)
  }
  if (source !== null) assert.equal(seenMaterials.size, expected.size, 'Missing source-linked texture')
  assert.equal(seenTextures.size, json.textures?.length ?? 0, 'Unexpected texture')
  assert.equal(seenImages.size, json.images?.length ?? 0, 'Unexpected image')
  // Node has no DOM image decoder. Strip texture references only in the copy used
  // for numeric Three.js checks; the original GLB is hashed and published intact.
  const stripped = structuredClone(json)
  for (const material of stripped.materials ?? []) { delete material.pbrMetallicRoughness?.baseColorTexture; delete material.normalTexture }
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
