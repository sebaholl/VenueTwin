import { ArchitecturalDetailsPanel } from './ArchitecturalDetailsPanel'
import { RoomOpeningsPanel } from './RoomOpeningsPanel'
import { parseViewerConfig } from '../utils/customerViewer'
import { useState } from 'react'
import type { VenueConfig } from '../types/venue'
export function RoomSetupPanel({ config, onChange }: { config: VenueConfig; onChange: (patch: Partial<VenueConfig>) => void }) {
  const [error, setError] = useState('')
  const initial = config.room ?? { width: 16, depth: 24, height: 8, x: 0, z: 7, rotation: 0, ceiling: false, wallColor: '#433c43', floorColor: '#292d35' }
  const [draft, setDraft] = useState(Object.fromEntries(Object.entries(initial).map(([k,v]) => [k, String(v)])))
  const keys = ['width', 'depth', 'height', 'x', 'z', 'rotation'] as const
  const valid = keys.every((k) => draft[k].trim() && Number.isFinite(Number(draft[k])) && (['width', 'depth', 'height'].includes(k) ? Number(draft[k]) >= 1 && Number(draft[k]) <= 100 : Math.abs(Number(draft[k])) <= 100))
  return <section className="control-section stage-setup"><h2>Room shell</h2><p className="workflow-hint">A rectangular room around your layout. Dimensions are interior measurements. Walls and ceiling hide in overview and appear in seat view.</p>
    {!config.room && <p className="workflow-hint">No room applied. The draft values below are a starting example, not extracted measurements.</p>}
    <form onSubmit={(event) => { event.preventDefault(); if (valid) { try { const next = parseViewerConfig({ ...config, room: { ...config.room, width: Number(draft.width), depth: Number(draft.depth), height: Number(draft.height), x: Number(draft.x), z: Number(draft.z), rotation: Number(draft.rotation), ceiling: draft.ceiling === 'true', wallColor: draft.wallColor, floorColor: draft.floorColor } }); onChange({ room: next.room }); setError('') } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid room.') } } }}>
      {keys.map((k) => <label key={k}>{{width:'Interior width (m)',depth:'Interior depth (m)',height:'Ceiling height above floor (m)',x:'Room centre X (m)',z:'Room centre Z (m)',rotation:'Rotation (degrees)'}[k]}<input type="number" step=".1" min={['width','depth','height'].includes(k) ? 1 : -100} max={100} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>)}
      <details><summary>Surfaces</summary><label>Wall colour<input type="color" value={draft.wallColor} onChange={(e) => setDraft({ ...draft, wallColor: e.target.value })} /></label><label>Floor colour<input type="color" value={draft.floorColor} onChange={(e) => setDraft({ ...draft, floorColor: e.target.value })} /></label></details>
      <label><span><input style={{width:'auto'}} type="checkbox" checked={draft.ceiling === 'true'} onChange={(e) => setDraft({ ...draft, ceiling: String(e.target.checked) })} /> Include ceiling</span></label>
      {error && <p role="alert">{error}</p>}
      {!valid && <p role="alert">Use dimensions of 1–100 m and position/rotation within ±100.</p>}
      <button className="button button-primary" disabled={!valid}>Apply room</button>
      {config.room && <button className="button button-secondary" type="button" onClick={() => onChange({ room: undefined })}>Remove room</button>}
    </form><RoomOpeningsPanel config={config} onChange={onChange} /><ArchitecturalDetailsPanel config={config} onChange={onChange} /><p className="workflow-hint">Room floor is at elevation zero. Seats keep their positions. Rebuild Blender after changes. Openings are empty cut-outs. Architectural details are separate components; removing or moving the room does not move them.</p>
  </section>
}
