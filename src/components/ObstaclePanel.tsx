import type { VenueConfig, VenueObstacle } from '../types/venue'
import { getObstacles, newObstacle } from '../utils/obstacles'

export function ObstaclePanel({ config, onChange }: { config: VenueConfig; onChange: (patch: Partial<VenueConfig>) => void }) {
  const obstacles = getObstacles(config)
  const update = (id: string, patch: Partial<VenueObstacle>) => onChange({ obstacles: obstacles.map((o) => o.id === id ? { ...o, ...patch } : o) })
  const fields = [['x', 'X position', -50, 50], ['z', 'Depth position', -50, 50], ['elevation', 'Base elevation', 0, 30], ['width', 'Width', .05, 50], ['depth', 'Thickness / depth', .05, 50], ['height', 'Height', .1, 30], ['rotation', 'Rotation (°)', -180, 180]] as const
  return <section className="control-section category-panel"><h2>Structures & obstacles</h2><p>Dimensions in metres. X = left/right; depth = toward the back of the hall. The centre of the first row is depth 0. Elevation is measured from the venue floor, not the row floor.</p>
    <div className="obstacle-add">{(['column', 'wall', 'railing'] as const).map((kind) => <button type="button" key={kind} disabled={obstacles.length >= 50} onClick={() => onChange({ obstacles: [...obstacles, newObstacle(kind)] })}>+ {kind}</button>)}</div>
    {obstacles.map((o) => <details key={o.id} className="obstacle-details" open={obstacles.length === 1 ? true : undefined}><summary>{o.name} · {o.kind}</summary><label>Name<input maxLength={60} value={o.name} onChange={(e) => update(o.id, { name: e.target.value })} /></label><div className="category-fields">{fields.map(([key, title, min, max]) => <label key={key}>{title}<input type="number" step={key === 'rotation' ? 5 : .05} min={min} max={max} value={o[key]} onChange={(e) => { if (e.target.value !== '') update(o.id, { [key]: Math.min(max, Math.max(min, Number(e.target.value))) }) }} /></label>)}</div><button type="button" onClick={() => onChange({ obstacles: [...obstacles, { ...o, id: crypto.randomUUID(), name: `${o.name} copy`, x: Math.min(50, o.x + 1) }] })} disabled={obstacles.length >= 50}>Duplicate</button> <button type="button" onClick={() => onChange({ obstacles: obstacles.filter((item) => item.id !== o.id) })}>Remove</button></details>)}
    <small>Railings use simple posts and a top rail. Auto layout does not avoid obstacles yet: check for overlapping seats manually. Undo restores removed structures.</small>
  </section>
}
