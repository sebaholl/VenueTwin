import { buildLocalModel, assertBuildCurrent } from '../lib/blenderJobs'
import { loadProjectModel, removeProjectModel, saveProjectModel } from '../lib/projectModels'
import { useEffect, useRef, useState } from 'react'
import type { Group } from 'three'
import type { VenueConfig } from '../types/venue'
import { downloadBlenderBlueprint } from '../utils/blenderBridge'
import { disposeLocalModel, loadLocalGlb } from '../utils/localGlb'
import { geometrySignature, downloadViewerFile } from '../utils/customerViewer'

export function BlenderPanel({ projectId, config, onLoaded, onSource }: { projectId: string; config: VenueConfig; onLoaded: (model: Group | null) => void; onSource?: (source: { file: File; signature: string } | null) => void }) {
  const buildController = useRef<AbortController | null>(null)
  const latestConfig = useRef(config)
  latestConfig.current = config
  const [building, setBuilding] = useState(false)
  const [buildStage, setBuildStage] = useState('')
  useEffect(() => () => buildController.current?.abort(), [])
  const model = useRef<Group | null>(null)
  const request = useRef(0)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [source, setSource] = useState<{ file: File; signature: string } | null>(null)
  const [storage, setStorage] = useState('')
  const [saved, setSaved] = useState(false)
  const customRailings = Object.values(config.rowOverrides).some((row) => typeof row.frontRailing === 'boolean')
  const stale = !!source && source.signature !== geometrySignature(config)
  useEffect(() => {
    const requests = request
    const ticket = ++request.current
    setBusy(true); setStorage('Checking for a saved model…')
    void (async () => {
      try {
        const stored = await loadProjectModel(projectId)
        if (request.current !== ticket) return
        if (!stored) { setStorage('No model saved for this project yet.'); return }
        const file = new File([stored.file], stored.name, { type: 'model/gltf-binary' })
        const next = await loadLocalGlb(file)
        if (request.current !== ticket) { disposeLocalModel(next); return }
        model.current = next; onLoaded(next); setName(file.name)
        const restored = { file, signature: stored.signature }
        setSource(restored); onSource?.(restored); setSaved(true)
        setStorage('Restored from this browser.')
      } catch (reason) { if (request.current === ticket) setError(reason instanceof Error ? reason.message : 'Could not restore the saved model.') }
      finally { if (request.current === ticket) setBusy(false) }
    })()
    return () => { requests.current++; if (model.current) disposeLocalModel(model.current); model.current = null; onLoaded(null); onSource?.(null) }
  }, [projectId, onLoaded, onSource])
  const persist = async (nextSource: { file: File; signature: string }, ticket: number) => {
    try {
      await saveProjectModel(projectId, { ...nextSource, name: nextSource.file.name, savedAt: new Date().toISOString() })
      if (request.current === ticket) { setSaved(true); setStorage('Model saved on this device.'); setError('') }
    } catch {
      if (request.current === ticket) { setSaved(false); setStorage('Preview only — the new model was not saved. Any previously saved model is unchanged.'); setError('Browser storage failed. Free some space or retry saving before closing the page.') }
    }
  }
  const attach = async (file: File, builtSignature?: string, signal?: AbortSignal, builtConfig?: VenueConfig) => {
    const ticket = ++request.current
    const signature = builtSignature ?? geometrySignature(config)
    setBusy(true); setError('')
    try {
      const next = await loadLocalGlb(file)
      if (request.current !== ticket) { disposeLocalModel(next); return }
      if (signal?.aborted || (builtSignature && builtSignature !== geometrySignature(latestConfig.current))) { disposeLocalModel(next); throw new Error(signal?.aborted ? 'Build cancelled.' : 'The layout changed during this build. The existing model was kept. Build again for the current layout.') }
      if (builtConfig) { try { assertBuildCurrent(builtConfig, latestConfig.current) } catch (reason) { disposeLocalModel(next); throw reason } }
      const previous = model.current; model.current = next; onLoaded(next); setName(file.name)
      const nextSource = { file, signature }; setSource(nextSource); onSource?.(nextSource)
      if (previous) disposeLocalModel(previous)
      setSaved(false); setStorage('Saving model on this device…')
      await persist(nextSource, ticket)
      return true
    } catch (reason) { if (ticket === request.current) setError(reason instanceof Error ? reason.message : 'Unable to load model.') }
    finally { if (ticket === request.current) setBusy(false) }
  }
  const build = async () => {
    const controller = new AbortController(); buildController.current = controller
    const snapshot = structuredClone(config)
    setBuilding(true); setBuildStage('Preparing layout'); setError('')
    try {
      const result = await buildLocalModel(snapshot, controller.signal, setBuildStage)
      if (controller.signal.aborted) return
      assertBuildCurrent(snapshot, latestConfig.current)
      if (await attach(result.file, result.signature, controller.signal, snapshot)) setBuildStage('Model built and imported')
      else setBuildStage('Model was not imported')
    } catch (reason) {
      if (controller.signal.aborted) setBuildStage('Build cancelled. Existing model kept.')
      else { setBuildStage('Build failed'); setError(reason instanceof Error ? reason.message : 'Build failed.') }
    } finally { if (buildController.current === controller) { buildController.current = null; setBuilding(false) } }
  }
  const remove = async () => {
    const ticket = ++request.current
    setBusy(true); setError('')
    try {
      await removeProjectModel(projectId)
      if (ticket !== request.current) return
      onLoaded(null); onSource?.(null); if (model.current) disposeLocalModel(model.current)
      model.current = null; setSource(null); setName(''); setSaved(false); setStorage('Saved model removed from this project.')
    } catch { if (ticket === request.current) setError('Could not remove the saved model. Try again; it has not been removed from storage.') }
    finally { if (ticket === request.current) setBusy(false) }
  }
  return <section className="control-section category-panel"><h2>Build the architecture</h2><p>Build approximate architecture from your current layout. Studio keeps the seats and obstacles interactive.</p>
    {import.meta.env.DEV && <div className="local-blender-build">
      <button disabled={busy || building} onClick={() => void build()}>Build 3D model with Blender</button>
      {building && !busy && <button onClick={() => buildController.current?.abort()}>Cancel build</button>}
      {buildStage && <p role="status" aria-live="polite">{buildStage}</p>}
      <small>Runs locally without AI charges. This uses the general architecture generator; it does not generate the detailed National Theatre study.</small>
      <details><summary>Blender setup</summary><p>On macOS, the default location is <code>/Applications/Blender.app/Contents/MacOS/Blender</code>. For a different installation, set <code>BLENDER_PATH</code> in <code>.env.local</code> to the executable path and restart <code>npm run dev</code>. Keep Blender installed; you do not need to open it.</p></details>
    </div>}
    <button onClick={() => downloadBlenderBlueprint(config)}>Export Blender scene JSON</button>
    {config.studyNotice && !!config.seatingLevels?.length && <><button disabled={customRailings} onClick={() => downloadBlenderBlueprint(config, true)}>Export detailed theatre JSON</button>{customRailings && <p>Custom row railings use the general scene export above and build_venue.py. The detailed theatre template uses its own ornamental railings.</p>}</>}
    <details className="blender-help"><summary>How to build in Blender</summary><p>1. Export scene JSON above. For the theatre study, choose the detailed export.</p><p>2. In Blender’s Scripting workspace, open and run <code>scripts/blender/build_venue.py</code>, or <code>scripts/blender/build_national_theatre.py</code> for the detailed theatre. Select the exported JSON.</p><p>3. Load the generated GLB below. Use metres and the original origin; the model is not automatically centred or scaled.</p><p>Dimensions and decorative details are approximate.</p></details>
    <label>Load local GLB (up to 25 MB)<input type="file" accept=".glb" disabled={busy || building} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void attach(file) }} /></label>
    {busy && <p role="status">Loading model…</p>}{error && <p role="alert">{error}</p>}
    {storage && <p role="status">{storage}</p>}
    {stale && <p role="alert">The layout has changed since this model was imported. Showing generated geometry until you rebuild and import a matching GLB, or undo the layout changes.</p>}
    {name && <p>{name}</p>}
    {source && <button onClick={() => downloadViewerFile(source.file, source.file.name)}>Download model GLB</button>}
    {source && !saved && <button disabled={busy || building} onClick={() => { const ticket = request.current; setBusy(true); void persist(source, ticket).finally(() => { if (ticket === request.current) setBusy(false) }) }}>Retry saving model</button>}
    {(name || error) && <button disabled={busy || building} onClick={() => void remove()}>Remove saved model</button>}
    <p>Models restore automatically for this project in this browser. Keep the original GLB as a backup; clearing site data removes saved models.</p><details className="blender-help"><summary>What gets saved or shared?</summary><p>The model is saved on this device, separately from cloud project data. It is not included in cloud links, project JSON, PNG or PDF exports. Importing a project JSON creates a new project and requires attaching its GLB. Another browser or device needs its own copy.</p></details>
  </section>
}
