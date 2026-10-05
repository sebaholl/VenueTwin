import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import type { VenueConfig } from '../types/venue'
import { downloadBlenderBlueprint } from '../utils/blenderBridge'
import { disposeLocalModel, loadLocalGlb } from '../utils/localGlb'

export function BlenderPanel({ config, onLoaded }: { config: VenueConfig; onLoaded: (model: Group | null) => void }) {
  const model = useRef<Group | null>(null)
  const request = useRef(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { request.current++; if (model.current) disposeLocalModel(model.current); onLoaded(null) }, [onLoaded])
  const attach = async (file: File) => {
    const ticket = ++request.current
    setBusy(true); setError('')
    try {
      const next = await loadLocalGlb(file)
      if (request.current !== ticket) { disposeLocalModel(next); return }
      const previous = model.current; model.current = next; onLoaded(next); setName(file.name)
      if (previous) disposeLocalModel(previous)
    } catch (reason) { if (ticket === request.current) setError(reason instanceof Error ? reason.message : 'Unable to load model.') }
    finally { if (ticket === request.current) setBusy(false) }
  }
  return <section className="control-section category-panel"><h2>Blender bridge · local preview</h2><p>1. Export scene data. 2. Run scripts/blender/build_venue.py in Blender. 3. Load the generated GLB below and switch to 3D.</p>
    <button onClick={() => downloadBlenderBlueprint(config)}>Export Blender scene JSON</button>
    {config.studyNotice && !!config.seatingLevels?.length && <><button onClick={() => downloadBlenderBlueprint(config, true)}>Export detailed theatre JSON</button><p>For the detailed photo study, run scripts/blender/build_national_theatre.py. Creates an editable .blend and a GLB with boxes, mouldings, ceiling and chandelier. Dimensions and decorative motifs remain approximate.</p></>}
    <label>Load local GLB (up to 25 MB)<input type="file" accept=".glb" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void attach(file) }} /></label>
    {busy && <p role="status">Loading model…</p>}{error && <p role="alert">{error}</p>}
    {name && <><p>{name}</p><button onClick={() => { request.current++; onLoaded(null); if (model.current) disposeLocalModel(model.current); model.current = null; setName(''); setBusy(false) }}>Remove model</button></>}
    <p>Local session only: GLB files are not saved, uploaded, included in PNG/PDF or shown in shared links. Reload the file after refreshing. Seats and obstacles stay interactive. Rebuild the model after changing venue geometry.</p>
    <small>Use metres and the original origin. No auto-centering or scaling. Initial row decks are approximate, not a reconstruction of a real building.</small>
  </section>
}
