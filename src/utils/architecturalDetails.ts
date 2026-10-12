import type { ArchitectureBox } from './levelGeometry'

export type ArchitecturalDetail = {
  id: string; name: string; kind: 'panel' | 'portal' | 'coffer' | 'column' | 'curved-wall';
  x: number; z: number; bottom: number; width: number; height: number; depth: number; rotation: number;
  color: string; trimColor: string; roughness: number; metalness: number; trimRoughness: number; trimMetalness: number; trim: number; radius: number | null; span: number | null; segments: number;
  basis: 'provided' | 'estimated'; source: string;
}
export function validateArchitecturalDetails(value: unknown): ArchitecturalDetail[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 40) throw new Error('Use at most 40 architectural details.')
  const ids = new Set<string>()
  const finite = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max
  for (const d of value) {
    if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !d.id.trim() || d.id.length > 80 || ids.has(d.id) || typeof d.name !== 'string' || !d.name.trim() || d.name.length > 80) throw new Error('Details need distinct IDs and names.')
    ids.add(d.id)
    if (!['panel', 'portal', 'coffer', 'column', 'curved-wall'].includes(d.kind) || !['x', 'z'].every((k) => finite(d[k], -100, 100)) || !finite(d.bottom, 0, 100) || !finite(d.rotation, -180, 180) || !['width', 'height', 'depth'].every((k) => finite(d[k], .05, 100)) || !finite(d.trim, .01, 1)) throw new Error('Invalid architectural dimensions.')
    if (!['color', 'trimColor'].every((k) => typeof d[k] === 'string' && /^#[0-9a-f]{6}$/i.test(d[k])) || !['provided', 'estimated'].includes(d.basis) || typeof d.source !== 'string' || !d.source.trim() || d.source.length > 500) throw new Error('Details need colours and a source or estimate description.')
    if (!['roughness', 'metalness', 'trimRoughness', 'trimMetalness'].every((k) => finite(d[k], 0, 1))) throw new Error('Material roughness and metalness must be between zero and one.')
    if (!Number.isInteger(d.segments) || d.segments < 1 || d.segments > 48) throw new Error('Invalid detail segment count.')
    if (d.kind === 'curved-wall') {
      if (!finite(d.radius, 1, 50) || !finite(d.span, 5, 180) || d.segments < 8 || d.depth >= d.radius || d.trim * 2 >= d.height) throw new Error('Invalid curved wall radius, span, thickness or trim.')
    } else {
      if (d.radius !== null || d.span !== null || (d.kind === 'column' ? d.segments < 8 : d.segments !== 1)) throw new Error('Only curved walls use radius/span; only columns and curved walls use multiple segments.')
      if (2 * d.trim >= Math.min(d.width, d.height, ...(d.kind === 'coffer' || d.kind === 'column' ? [d.depth] : []))) throw new Error('Trim must fit inside the detail dimensions.')
    }
  }
  return structuredClone(value) as ArchitecturalDetail[]
}

// Y-up metres, same boxes in live Studio and the trusted Blender exporter.
export function architecturalDetailGeometry(value: unknown): ArchitectureBox[] {
  const boxes: ArchitectureBox[] = []
  for (const d of validateArchitecturalDetails(value)) {
    const a = d.rotation * Math.PI / 180, t = d.trim
    let index = 0
    const box = (x: number, y: number, z: number, w: number, h: number, depth: number, color: string, rotation = 0, trimMaterial = false) => {
      boxes.push({ name: `${d.kind === 'coffer' ? 'VT_ROOM_SHELL_' : 'VT_DETAIL_'}${d.id}_${index++}`, position: [d.x + x * Math.cos(a) + z * Math.sin(a), d.bottom + y, d.z - x * Math.sin(a) + z * Math.cos(a)], size: [w, h, depth], rotation: a + rotation, color, roughness: trimMaterial ? d.trimRoughness : d.roughness, metalness: trimMaterial ? d.trimMetalness : d.metalness })
    }
    if (d.kind === 'panel' || d.kind === 'portal') {
      if (d.kind === 'panel') box(0, d.height / 2, 0, d.width, d.height, d.depth, d.color)
      if (d.kind === 'portal') {
        for (const sign of [-1, 1]) box(sign * (d.width - t) / 2, d.height / 2, 0, t, d.height, d.depth, d.color)
        box(0, d.height - t / 2, 0, d.width - 2 * t, t, d.depth, d.color)
      }
      for (const sign of [-1, 1]) box(sign * (d.width - t) / 2, d.height / 2, -d.depth / 2, t, d.height, t, d.trimColor, 0, true)
      box(0, d.height - t / 2, -d.depth / 2, d.width - 2 * t, t, t, d.trimColor, 0, true)
      if (d.kind === 'panel') box(0, t / 2, -d.depth / 2, d.width - 2 * t, t, t, d.trimColor, 0, true)
    } else if (d.kind === 'coffer') {
      box(0, d.height - t / 2, 0, d.width, t, d.depth, d.color)
      for (const sign of [-1, 1]) {
        box(sign * (d.width - t) / 2, (d.height - t) / 2, 0, t, d.height - t, d.depth, d.trimColor, 0, true)
        box(0, (d.height - t) / 2, sign * (d.depth - t) / 2, d.width - 2 * t, d.height - t, t, d.trimColor, 0, true)
      }
    } else if (d.kind === 'column') {
      for (const y of [t / 2, d.height - t / 2]) box(0, y, 0, d.width, t, d.depth, d.trimColor, 0, true)
      // Faceted shaft assembled as radial wedges approximated by overlapping bars.
      // Min(width, depth) is the shaft diameter; capitals keep the supplied rectangular footprint.
      const r = (Math.min(d.width, d.depth) - 2 * t) / 2
      for (let i = 0; i < d.segments; i++) {
        const angle = i * 2 * Math.PI / d.segments
        box(Math.sin(angle) * r / 2, d.height / 2, Math.cos(angle) * r / 2, 2 * r * Math.tan(Math.PI / d.segments), d.height - 2 * t, r, d.color, angle)
      }
    } else {
      const step = d.span! * Math.PI / 180 / d.segments
      for (let i = 0; i < d.segments; i++) {
        const angle = -d.span! * Math.PI / 360 + (i + .5) * step
        const length = 2 * (d.radius! + d.depth / 2 + t / 2) * Math.tan(step / 2)
        const x = Math.sin(angle) * d.radius!, z = Math.cos(angle) * d.radius!
        box(x, d.height / 2, z, length, d.height, d.depth, d.color, angle)
        for (const y of [t / 2, d.height - t / 2]) box(x, y, z, length, t, d.depth + t, d.trimColor, angle, true)
      }
    }
  }
  if (boxes.length > 1400 || boxes.some((b) => b.size.some((s) => s < .001))) throw new Error('Architectural detail exceeds the geometry budget or has pieces below 1 mm. Reduce components/segments or increase dimensions.')
  return boxes
}
