import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import type { VenueConfig } from '../types/venue'
import { downloadBlenderBlueprint } from '../utils/blenderBridge'
import { disposeLocalModel, loadLocalGlb } from '../utils/localGlb'
import { geometrySignature } from '../utils/customerViewer'

export function BlenderPanel({ config, onLoaded, onSource }: { config: VenueConfig; onLoaded: (model: Group | null) => void; onSource?: (source: { file: File; signature: string } | null) => void }) {
  const model = useRef<Group | null>(null)
  const request = useRef(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => () => { request.current++; if (model.current) disposeLocalModel(model.current); onLoaded(null); onSource?.(null) }, [onLoaded, onSource])
  const attach = async (file: File) => {
    const ticket = ++request.current
    setBusy(true); setError('')
    try {
      const next = await loadLocalGlb(file)
      if (request.current !== ticket) { disposeLocalModel(next); return }
      const previous = model.current; model.current = next; onLoaded(next); setName(file.name)
      onSource?.({ file, signature: geometrySignature(config) })
      if (previous) disposeLocalModel(previous)
    } catch (reason) { if (ticket === request.current) setError(reason instanceof Error ? reason.message : 'Unable to load model.') }
    finally { if (ticket === request.current) setBusy(false) }
  }
  return <section className="control-section category-panel"><h2>Build the architecture</h2><p>Export your layout, build it in Blender, then load the finished model here.</p>
    <button onClick={() => downloadBlenderBlueprint(config)}>Export Blender scene JSON</button>
    {config.studyNotice && !!config.seatingLevels?.length && <><button onClick={() => downloadBlenderBlueprint(config, true)}>Export detailed theatre JSON</button></>}
    <details className="blender-help"><summary>How to build in Blender</summary><p>1. Export scene JSON above. For the theatre study, choose the detailed export.</p><p>2. In Blender’s Scripting workspace, open and run <code>scripts/blender/build_venue.py</code>, or <code>scripts/blender/build_national_theatre.py</code> for the detailed theatre. Select the exported JSON.</p><p>3. Load the generated GLB below. Use metres and the original origin; the model is not automatically centred or scaled.</p><p>Dimensions and decorative details are approximate.</p></details>
    <label>Load local GLB (up to 25 MB)<input type="file" accept=".glb" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void attach(file) }} /></label>
    {busy && <p role="status">Loading model…</p>}{error && <p role="alert">{error}</p>}
    {name && <><p>{name}</p><button onClick={() => { request.current++; onLoaded(null); onSource?.(null); if (model.current) disposeLocalModel(model.current); model.current = null; setName(''); setBusy(false) }}>Remove model</button></>}
    <p>Model files stay in this browser session. Reload after refreshing, and rebuild after changing the layout.</p><details className="blender-help"><summary>What gets saved or shared?</summary><p>GLB files are not uploaded or included in cloud links, PNG or PDF exports. Seats and obstacles remain interactive in the local preview.</p></details>
  </section>
}
