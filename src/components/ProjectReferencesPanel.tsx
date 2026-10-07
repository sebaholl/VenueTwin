import { useEffect, useRef, useState } from 'react'
import { emptyReferences, projectReferences, validateReferences, type ProjectReferences, type ReferenceAsset } from '../lib/projectReferences'

function AssetPreview({ asset }: { asset: ReferenceAsset }) {
  const [url, setUrl] = useState('')
  useEffect(() => { const next = URL.createObjectURL(asset.file); setUrl(next); return () => URL.revokeObjectURL(next) }, [asset.file])
  return <>{asset.file.type.startsWith('image/') && <img src={url} alt={asset.caption || asset.name} loading="lazy" />}<a href={url} download={asset.name}>Download original</a></>
}

export function ProjectReferencesPanel({ projectId, initialFile, onPlan }: { projectId: string; initialFile?: File; onPlan: (file: File | null, changed: boolean) => void }) {
  const [data, setData] = useState<ProjectReferences>(emptyReferences)
  const [busy, setBusy] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Loading references…')
  const [measurement, setMeasurement] = useState({ label: '', meters: '', source: '', confidence: 'measured' as 'measured' | 'estimated' })
  const alive = useRef(false)
  const appliedPlan = useRef<string | null>(null)
  const notifyPlan = (next: ProjectReferences, changed: boolean) => {
    const plan = next.assets.find((asset) => asset.id === next.activePlanId)
    onPlan(plan ? new File([plan.file], plan.name, { type: plan.file.type }) : null, changed)
  }
  useEffect(() => {
    let cancelled = false; alive.current = true
    void (async () => {
      try {
        let next = await projectReferences(projectId)
        if (cancelled) return
        if (initialFile && !next.assets.length) {
          const asset: ReferenceAsset = { id: crypto.randomUUID(), kind: 'plan', name: initialFile.name, file: initialFile, caption: '' }
          next = { ...next, assets: [asset], activePlanId: asset.id }
          // Keep wizard input available for retry if persistence fails.
          setData(next); setDirty(true); setLoaded(true)
          await projectReferences(projectId, next)
        }
        if (cancelled) return
        appliedPlan.current = next.activePlanId
        setData(next); setLoaded(true); setDirty(false); setStatus('References saved on this device.')
        const plan = next.assets.find((asset) => asset.id === next.activePlanId)
        onPlan(plan ? new File([plan.file], plan.name, { type: plan.file.type }) : null, false)
      } catch (reason) { if (!cancelled) { setError(reason instanceof Error ? reason.message : 'Could not load references.'); setStatus('References need attention.') } }
      finally { if (!cancelled) setBusy(false) }
    })()
    return () => { cancelled = true; alive.current = false }
  }, [projectId, initialFile, onPlan])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const save = async (next: ProjectReferences) => {
    try { validateReferences(next) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid references.'); return }
    setBusy(true); setError(''); setData(next); setDirty(true); setStatus('Saving references…')
    try {
      await projectReferences(projectId, next)
      if (!alive.current) return
      setDirty(false); setStatus('References saved on this device.')
      const planChanged = next.activePlanId !== appliedPlan.current
      if (planChanged) notifyPlan(next, true)
      else if (initialFile) notifyPlan(next, false)
      appliedPlan.current = next.activePlanId
    } catch (reason) { if (alive.current) { setError(reason instanceof Error ? reason.message : 'Could not save references.'); setStatus('Unsaved changes — retry saving before leaving.') } }
    finally { if (alive.current) setBusy(false) }
  }
  const update = (next: ProjectReferences) => { setData(next); setDirty(true); setStatus('Unsaved changes — save before switching projects') }
  const upload = async (files: FileList | null, kind: 'plan' | 'photo') => {
    if (!files?.length) return
    const assets = Array.from(files).map((file) => ({ id: crypto.randomUUID(), kind, name: file.name, file, caption: '' }))
    const activePlanId = kind === 'plan' && !data.activePlanId ? assets[0].id : data.activePlanId
    await save({ ...data, assets: [...data.assets, ...assets], activePlanId })
  }
  return <section className="project-references control-section">
    <h2>Venue references</h2><p className="workflow-hint">Keep plans, photos and known dimensions together. Saved in this browser, separate from cloud data and project exports.</p>
    <p role="status">{status}</p>{error && <p role="alert">{error}</p>}
    {!loaded && !busy && <button onClick={() => window.location.reload()}>Retry loading references</button>}
    <fieldset disabled={busy || !loaded}>
      <details open><summary>Floor plans</summary><label>Add plans<input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => { void upload(event.target.files, 'plan'); event.target.value = '' }} /></label><p className="workflow-hint">Images appear behind the seating plan. PDFs are saved for download. Changing the active plan clears its old calibration and boundary.</p>
      {data.assets.filter((asset) => asset.kind === 'plan').map((asset) => <article key={asset.id}><strong>{asset.name}</strong><AssetPreview asset={asset} /><button disabled={data.activePlanId === asset.id} onClick={() => { void save({ ...data, activePlanId: asset.id }) }}>{data.activePlanId === asset.id ? 'Active floor plan' : 'Use this plan'}</button><button onClick={() => { const changed = asset.id === data.activePlanId; void save({ ...data, assets: data.assets.filter((item) => item.id !== asset.id), activePlanId: changed ? null : data.activePlanId }) }}>Remove plan</button></article>)}</details>
      <details><summary>Reference photos ({data.assets.filter((asset) => asset.kind === 'photo').length})</summary><label>Add photos<input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void upload(event.target.files, 'photo'); event.target.value = '' }} /></label>{data.assets.filter((asset) => asset.kind === 'photo').map((asset) => <article key={asset.id}><strong>{asset.name}</strong><AssetPreview asset={asset} /><label>Location / source / what it shows<textarea maxLength={1000} value={asset.caption} onChange={(event) => update({ ...data, assets: data.assets.map((item) => item.id === asset.id ? { ...item, caption: event.target.value } : item) })} /></label><button onClick={() => void save({ ...data, assets: data.assets.filter((item) => item.id !== asset.id) })}>Remove photo</button></article>)}</details>
      <details><summary>Known measurements ({data.measurements.length})</summary><p className="workflow-hint">Reference notes only; these do not change the model or calibrate the plan automatically.</p>
        {data.measurements.map((item) => <article key={item.id}><strong>{item.label}: {item.meters} m</strong><p>{item.confidence} · {item.source || 'Source not recorded'}</p><button onClick={() => update({ ...data, measurements: data.measurements.filter((entry) => entry.id !== item.id) })}>Remove measurement</button></article>)}
        <label>Measurement name<input maxLength={100} placeholder="Stage width" value={measurement.label} onChange={(e) => setMeasurement({ ...measurement, label: e.target.value })} /></label><label>Value in metres<input type="number" min="0.001" max="1000" step="any" value={measurement.meters} onChange={(e) => setMeasurement({ ...measurement, meters: e.target.value })} /></label><label>Evidence<select value={measurement.confidence} onChange={(e) => setMeasurement({ ...measurement, confidence: e.target.value as 'measured' | 'estimated' })}><option value="measured">Measured / documented</option><option value="estimated">Estimated</option></select></label><label>Source<input maxLength={500} placeholder="Venue plan, drawing A-02" value={measurement.source} onChange={(e) => setMeasurement({ ...measurement, source: e.target.value })} /></label><button disabled={!measurement.label.trim() || !Number.isFinite(Number(measurement.meters)) || Number(measurement.meters) <= 0 || Number(measurement.meters) > 1000} onClick={() => { update({ ...data, measurements: [...data.measurements, { ...measurement, id: crypto.randomUUID(), meters: Number(measurement.meters) }] }); setMeasurement({ label: '', meters: '', source: '', confidence: 'measured' }) }}>Add measurement</button>
      </details>
      <details><summary>Project notes</summary><label>Missing information / reconstruction notes<textarea maxLength={10000} value={data.notes} onChange={(event) => update({ ...data, notes: event.target.value })} /></label></details>
      <button className="button button-primary" disabled={!dirty} onClick={() => void save(data)}>Save references</button>
    </fieldset><small>Up to 20 files · 10 MB per file · 40 MB per project. Keep your originals as a backup.</small>
  </section>
}
