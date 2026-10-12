import { useState } from 'react'
import type { RoomOpening, VenueConfig } from '../types/venue'
import { validateRoomOpenings } from '../utils/roomOpenings'
const blank = { wall: 'front' as RoomOpening['wall'], offset: '0', width: '1.2', height: '2.1', bottom: '0' }
export function RoomOpeningsPanel({ config, onChange }: { config: VenueConfig; onChange: (patch: Partial<VenueConfig>) => void }) {
  const [draft, setDraft] = useState(blank)
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const room = config.room
  if (!room) return null
  const openings = room.openings ?? []
  function save() {
    if (!room) return
    try {
      if (['offset', 'width', 'height', 'bottom'].some((k) => !draft[k as keyof typeof draft].trim())) throw new Error('Fill every opening measurement.')
      const opening: RoomOpening = { id: editing ?? crypto.randomUUID(), wall: draft.wall, offset: Number(draft.offset), width: Number(draft.width), height: Number(draft.height), bottom: Number(draft.bottom) }
      const next = [...openings.filter((o) => o.id !== opening.id), opening]
      validateRoomOpenings(next, room)
      onChange({ room: { ...room, openings: next } }); setError(''); setEditing(null); setDraft(blank)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the opening.') }
  }
  return <details className="room-openings"><summary>Doors & wall openings · {openings.length}</summary>
    <p className="workflow-hint">Empty cut-outs; no door leaves, frames or glass. Front = −Z, back = +Z, left = −X, right = +X before room rotation. Positive offset goes toward +X on front/back walls and +Z on side walls.</p>
    {openings.map((o, i) => <article key={o.id}><strong>Opening {i + 1} · {o.wall}</strong><p>{o.width} × {o.height} m · offset {o.offset} m · bottom {o.bottom} m</p><button className="button button-secondary" type="button" onClick={() => { setEditing(o.id); setDraft({ wall: o.wall, offset: String(o.offset), width: String(o.width), height: String(o.height), bottom: String(o.bottom) }); setError('') }}>Edit</button><button className="button button-secondary" type="button" onClick={() => { onChange({ room: { ...room, openings: openings.filter((item) => item.id !== o.id) } }); if (editing === o.id) { setEditing(null); setDraft(blank); setError('') } }}>Remove</button></article>)}
    <form onSubmit={(e) => { e.preventDefault(); save() }}><h3>{editing ? 'Edit opening' : 'Add an opening'}</h3><p className="workflow-hint">Draft values are examples. Enter dimensions from your source; use bottom 0 for a doorway.</p>
      <label>Wall<select value={draft.wall} onChange={(e) => setDraft({ ...draft, wall: e.target.value as RoomOpening['wall'] })}>{['front','back','left','right'].map((wall) => <option key={wall}>{wall}</option>)}</select></label>
      {(['offset','width','height','bottom'] as const).map((key) => <label key={key}>{{offset:'Offset from wall centre (m)',width:'Clear width (m)',height:'Clear height (m)',bottom:'Bottom above floor (m)'}[key]}<input type="number" min={key === 'offset' ? -100 : key === 'bottom' ? 0 : .1} max="100" step=".1" required value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} /></label>)}
      {error && <p role="alert">{error}</p>}<button className="button button-primary">{editing ? 'Save opening' : 'Add opening'}</button>{editing && <button className="button button-secondary" type="button" onClick={() => { setEditing(null); setDraft(blank); setError('') }}>Cancel editing</button>}
    </form>
  </details>
}
