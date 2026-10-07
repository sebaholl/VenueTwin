import { useState } from 'react'
import type { ReferenceMeasurement } from '../lib/projectReferences'
import type { VenueConfig } from '../types/venue'

export function StageSetupPanel({ config, measurements, onChange }: { config: VenueConfig; measurements: ReferenceMeasurement[]; onChange: (patch: Partial<VenueConfig>) => void }) {
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const [draft, setDraft] = useState({ width: String(config.stageWidth), x: String(stage.offsetX), z: String(stage.offsetY), angle: String(stage.rotation) })
  const [reference, setReference] = useState('')
  const chosen = measurements.find((item) => item.id === reference)
  const width = Number(draft.width), x = Number(draft.x), z = Number(draft.z), angle = Number(draft.angle)
  const valid = Object.values(draft).every((value) => value.trim() !== '' && Number.isFinite(Number(value))) && width >= 1 && width <= 100 && Math.abs(x) <= 100 && Math.abs(z) <= 100 && Math.abs(angle) <= 100
  const changed = width !== config.stageWidth || x !== stage.offsetX || z !== stage.offsetY || angle !== stage.rotation
  const field = (key: keyof typeof draft, label: string, min: number, max: number, step: number) => <label>{label}<input type="number" min={min} max={max} step={step} value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>
  return <section className="control-section stage-setup"><h2>Stage setup</h2>
    <p className="workflow-hint">Place the stage before arranging seats. Apply changes, then switch to 3D to inspect the result. You can also drag the stage on the plan.</p>
    <form onSubmit={(event) => { event.preventDefault(); if (valid && changed) onChange({ stageWidth: width, stagePosition: { offsetX: x, offsetY: z, rotation: angle } }) }}>
      {field('width', 'Stage width (m)', 1, 100, .1)}
      <details><summary>Use a saved measurement</summary>{measurements.length ? <><label>Width reference<select value={reference} onChange={(event) => { const item = measurements.find((entry) => entry.id === event.target.value); setReference(event.target.value); if (item) setDraft({ ...draft, width: String(item.meters) }) }}><option value="">Choose a reference…</option>{measurements.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.meters} m · {item.confidence}</option>)}</select></label>{chosen && <p className="workflow-hint">{chosen.confidence === 'estimated' ? 'Estimated dimension' : 'Recorded measurement'} · {chosen.source || 'No source recorded'}. Confirm that this describes the stage width before applying.</p>}</> : <p className="workflow-hint">Add and save measurements under Project → Venue references first.</p>}</details>
      {field('x', 'Horizontal offset (m)', -100, 100, .1)}
      {field('z', 'Depth offset (m)', -100, 100, .1)}
      <p className="workflow-hint">Positive horizontal offset moves right on an unrotated plan. Positive depth moves towards the rear of the audience.</p>
      {field('angle', 'Rotation (degrees)', -100, 100, 1)}
      {!valid && <p role="alert">Enter a width of 1–100 m, offsets within ±100 m and a rotation within ±100°.</p>}
      <button className="button button-primary" disabled={!valid || !changed}>Apply stage changes</button>
      <button type="button" className="button button-secondary" onClick={() => setDraft({ ...draft, x: '0', z: '0', angle: '0' })}>Reset position draft</button>
      {changed && <p role="status" className="workflow-hint">Stage edits are not applied yet. Apply them before leaving this tool.</p>}
    </form>
    <p className="workflow-hint">Changes are undoable and included in Blender exports. Rebuild an imported model after changing stage geometry. Seats keep their existing positions.</p>
  </section>
}
