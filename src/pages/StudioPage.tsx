import '../studio-workflow.css'
import { geometrySignature } from '../utils/customerViewer'
import { ViewReview } from '../components/ViewReview'
import { AlertCircle, ArrowLeft, ArrowRight, ChevronDown, Box, Cloud, Download, FileImage, FileUp, Map, Redo2, RotateCcw, Save, Share2, Undo2, Upload, X } from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SeatCategoriesPanel } from '../components/SeatCategoriesPanel'
import { ObstaclePanel } from '../components/ObstaclePanel'
import { BlenderPanel } from '../components/BlenderPanel'
import { SeatingLevelsPanel } from '../components/SeatingLevelsPanel'
import { CustomerPreviewButton } from '../components/CustomerPreviewButton'
import type { Group } from 'three'
import { Brand } from '../components/Brand'
import { CloudPanel } from '../components/CloudPanel'
import { CreateProjectWizard } from '../components/CreateProjectWizard'
import { ExportProjectDialog } from '../components/ExportProjectDialog'
import { FloorplanEditor } from '../components/FloorplanEditor'
import { ShareProjectDialog } from '../components/ShareProjectDialog'
import { VenueScene } from '../components/VenueScene'
import { disableProjectShare, enableProjectShare, ensureFreshSession, getStoredSession, saveCloudProject, storeSession, type CloudSession } from '../lib/supabaseApi'
import { useVenueStore } from '../store/venueStore'
import type { GeometryType, VenueConfig } from '../types/venue'
import { estimateCapacity, getRowLabel } from '../utils/venue'

type RangeFieldProps = { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void; onBeginEdit: () => void; onCommitEdit: () => void }
function RangeField({ label, value, min, max, step = 1, unit = '', onChange, onBeginEdit, onCommitEdit }: RangeFieldProps) {
  return <label className="range-field"><span><b>{label}</b><output>{value}{unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onPointerDown={onBeginEdit} onPointerUp={onCommitEdit} onPointerCancel={onCommitEdit} onChange={(e) => onChange(Number(e.target.value))} /></label>
}

function isVenueConfig(value: unknown): value is VenueConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<VenueConfig>
  return typeof config.name === 'string' && typeof config.rows === 'number' && typeof config.seatsPerRow === 'number' && typeof config.sectors === 'number' && typeof config.rake === 'number' && typeof config.stageWidth === 'number' && ['straight', 'fan', 'blocks'].includes(config.geometry ?? '') && typeof config.rowOverrides === 'object'
}

const workflowSteps = [
  { title: 'Project', description: 'Start with your venue and a floor plan.' },
  { title: 'Layout', description: 'Arrange seats, levels and sightline obstacles.' },
  { title: 'Model', description: 'Bring in the architecture and check seat views.' },
  { title: 'Preview & share', description: 'See the visitor experience and prepare your delivery.' },
] as const

type SyncStatus = 'local' | 'saving' | 'saved' | 'offline' | 'error'

export function StudioPage() {
  const { projectId, config, selectedSeat, floorplanName, past, future, setConfig, beginEdit, commitEdit, undo, redo, loadProject, selectSeat, setFloorplanName } = useVenueStore()
  const [step, setStep] = useState(0)
  const [layoutTool, setLayoutTool] = useState('seating')
  const projectMenu = useRef<HTMLDetailsElement>(null)
  const goToStep = (next: number) => { setStep(next); setView(next < 2 ? 'plan' : 'model') }
  const menuAction = (action: () => void) => { if (projectMenu.current) projectMenu.current.open = false; action() }
  const fileInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const [importedModel, setImportedModel] = useState<Group | null>(null)
  const [modelSource, setModelSource] = useState<{ file: File; signature: string } | null>(null)
  const lastSavedSnapshot = useRef('')
  const [saveLabel, setSaveLabel] = useState('Save project')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [onlineRetry, setOnlineRetry] = useState(0)
  const [view, setView] = useState<'plan' | 'model' | 'review'>('plan')
  const [floorplanUrl, setFloorplanUrl] = useState<string | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareToken, setShareToken] = useState<string | null>(null)
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => getStoredSession())
  const capacity = useMemo(() => estimateCapacity(config), [config])


  const attachFloorplan = (file: File | null) => {
    if (file) {
      setFloorplanName(file.name)
      setView('plan')
      setFloorplanUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    }
  }
  const handleFloorplan = (event: ChangeEvent<HTMLInputElement>) => attachFloorplan(event.target.files?.[0] ?? null)
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as { config?: unknown }
      if (!isVenueConfig(payload.config)) throw new Error('This file does not contain a valid VenueTwin project.')
      loadProject(crypto.randomUUID(), payload.config)
      setFloorplanUrl(null); setFloorplanName(null); setView('plan'); setStep(0); setSaveError(null)
      lastSavedSnapshot.current = ''
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Project import failed.') }
  }
  useEffect(() => () => { if (floorplanUrl) URL.revokeObjectURL(floorplanUrl) }, [floorplanUrl])
  useEffect(() => {
    const retry = () => setOnlineRetry((value) => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (view === 'review') return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      event.preventDefault()
      if (event.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', handleHistoryShortcut)
    return () => window.removeEventListener('keydown', handleHistoryShortcut)
  }, [redo, undo, view])
  const exportProjectFile = () => {
    const blob = new Blob([JSON.stringify({ version: 2, config }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.venuetwin.json`; anchor.click(); URL.revokeObjectURL(url)
    setExportOpen(false)
  }
  const syncProject = useCallback(async (showFeedback = false) => {
    setSaveError(null)
    if (!cloudSession) {
      setSyncStatus('local')
      if (showFeedback) setSaveLabel('Saved locally')
      return
    }
    if (!navigator.onLine) {
      setSyncStatus('offline')
      if (showFeedback) setSaveLabel('Offline')
      return
    }
    setSyncStatus('saving')
    if (showFeedback) setSaveLabel('Saving…')
    try {
      const activeSession = await ensureFreshSession(cloudSession)
      if (activeSession.access_token !== cloudSession.access_token) setCloudSession(activeSession)
      await saveCloudProject(activeSession, { id: projectId, name: config.name, config })
      lastSavedSnapshot.current = JSON.stringify({ projectId, config })
      setSyncStatus('saved')
      if (showFeedback) setSaveLabel('Saved to cloud')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown cloud error occurred.'
      setSyncStatus('error'); setSaveError(message)
      if (showFeedback) setSaveLabel('Save failed')
    }
  }, [cloudSession, config, projectId])

  const saveProject = async () => {
    await syncProject(true)
    window.setTimeout(() => setSaveLabel('Save project'), 2000)
  }

  useEffect(() => {
    if (!cloudSession) { setSyncStatus('local'); return }
    const snapshot = JSON.stringify({ projectId, config })
    if (snapshot === lastSavedSnapshot.current) return
    const timer = window.setTimeout(() => void syncProject(), 1200)
    return () => window.clearTimeout(timer)
  }, [cloudSession, config, onlineRetry, projectId, syncProject])

  useEffect(() => {
    if (!cloudSession) return
    const timer = window.setInterval(() => {
      void ensureFreshSession(cloudSession).then((next) => {
        if (next.access_token !== cloudSession.access_token) setCloudSession(next)
      }).catch(() => { storeSession(null); setCloudSession(null); setSyncStatus('local') })
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [cloudSession])

  const startNewProject = (nextConfig: VenueConfig, floorplan: File | null) => {
    loadProject(crypto.randomUUID(), nextConfig); setFloorplanUrl(null); setFloorplanName(null); setView('plan'); setStep(0); setSaveError(null)
    attachFloorplan(floorplan)
    lastSavedSnapshot.current = ''
    setShareToken(null); setShareError(null)
    setCreateOpen(false)
  }

  const enableSharing = async () => {
    if (!cloudSession) return
    setShareBusy(true); setShareError(null)
    try {
      const activeSession = await ensureFreshSession(cloudSession)
      if (activeSession.access_token !== cloudSession.access_token) setCloudSession(activeSession)
      await saveCloudProject(activeSession, { id: projectId, name: config.name, config })
      const project = await enableProjectShare(activeSession, projectId)
      setShareToken(project.share_token ?? null)
      lastSavedSnapshot.current = JSON.stringify({ projectId, config })
      setSyncStatus('saved')
    } catch (error) { setShareError(error instanceof Error ? error.message : 'The public preview could not be enabled.') }
    finally { setShareBusy(false) }
  }

  const disableSharing = async () => {
    if (!cloudSession) return
    setShareBusy(true); setShareError(null)
    try { await disableProjectShare(await ensureFreshSession(cloudSession), projectId); setShareToken(null) }
    catch (error) { setShareError(error instanceof Error ? error.message : 'The public preview could not be disabled.') }
    finally { setShareBusy(false) }
  }

  const syncText = !cloudSession ? 'Local only' : ({ saving: 'Saving…', saved: 'Saved', offline: 'Offline', error: 'Sync error', local: 'Cloud connected' } as const)[syncStatus]

  return (
    <div className="studio-shell studio-workflow">
      <header className="studio-header">
        <div className="studio-brand"><Link to="/" className="back-link" aria-label="Back to home"><ArrowLeft size={17} /></Link><Brand /><span className="studio-project-title" title={config.name}>{config.name}</span></div>
        <div className="studio-actions">
          <button className={`status-pill ${cloudSession ? `cloud-active sync-${syncStatus}` : ''}`} onClick={() => setCloudOpen(true)}><i /> {syncText}</button>
          <button className="icon-button" onClick={undo} disabled={!past.length || view === 'review'} aria-label="Undo" title="Undo (Cmd/Ctrl+Z)"><Undo2 /></button>
          <button className="icon-button" onClick={redo} disabled={!future.length || view === 'review'} aria-label="Redo" title="Redo (Cmd/Ctrl+Shift+Z)"><Redo2 /></button>
          <details className="project-menu" ref={projectMenu}><summary>Project <ChevronDown size={14} /></summary><div className="project-menu-items">
            <button onClick={() => menuAction(() => setCreateOpen(true))}><RotateCcw size={16} /> New project</button>
            <button onClick={() => menuAction(() => setCloudOpen(true))}><Cloud size={16} /> Cloud projects & account</button>
            <button onClick={() => menuAction(() => importInput.current?.click())}><FileUp size={16} /> Import project file</button>
            <button onClick={() => menuAction(() => setExportOpen(true))}><Download size={16} /> Export project</button>
          </div></details>
          <input ref={importInput} hidden type="file" accept=".json,.venuetwin.json,application/json" onChange={importProject} />
          <button className="button button-primary button-small" onClick={saveProject}><Save size={16} /> {saveLabel}</button>
        </div>
      </header>
      <nav className="workflow-nav" aria-label="Studio workflow">{workflowSteps.map((item, index) => <button key={item.title} disabled={view === 'review'} aria-current={step === index ? 'step' : undefined} onClick={() => goToStep(index)}><span className="step-number">{index + 1}</span><span><strong>{item.title}</strong><small>{item.description}</small></span></button>)}</nav>
      {saveError && <div className="save-error-toast" role="alert"><AlertCircle /><div><strong>Project needs attention</strong><span>{saveError}</span></div><button onClick={() => setSaveError(null)} aria-label="Dismiss save error"><X /></button></div>}
      <main className={`studio-main ${view === 'review' ? 'review-workspace' : ''}`}>
        <aside className="control-panel" hidden={view === 'review'} aria-label={`${workflowSteps[step].title} tools`}>
          <div className="workflow-intro"><span>STEP {step + 1} OF 4</span><h1>{workflowSteps[step].title}</h1><p>{workflowSteps[step].description}</p></div>
          {step === 0 && <>
            <label className="project-name-field">Project name<input value={config.name} onFocus={beginEdit} onBlur={commitEdit} onChange={(e) => setConfig({ name: e.target.value })} /></label>
            <section className="control-section"><h2>Floor plan <small>Optional</small></h2><p className="workflow-hint">Use a plan as a guide, or start directly with the seating layout.</p><input ref={fileInput} hidden type="file" accept="image/*,.pdf" onChange={handleFloorplan} /><button className="upload-zone" onClick={() => fileInput.current?.click()}><FileImage /><b>{floorplanName ?? 'Add your floor plan'}</b><small>JPG / PNG for a plan overlay</small><span><Upload size={14} /> {floorplanName ? 'Replace file' : 'Choose file'}</span></button><p className="workflow-hint">PDF files record the source filename only. Use an image to see an overlay. Reattach source images after reopening a project.</p></section>
            <div className="workflow-note"><strong>Already have a project?</strong><p>Use the Project menu above to open a cloud project, import a file or choose a new starting template.</p></div>
          </>}
          {step === 1 && <>
            <div className="layout-tools" aria-label="Layout tools">{[['seating', 'Seating'], ['levels', 'Levels'], ['categories', 'Categories'], ['obstacles', 'Obstacles']].map(([id, label]) => <button key={id} aria-pressed={layoutTool === id} onClick={() => setLayoutTool(id)}>{label}</button>)}</div>
            {layoutTool === 'seating' && <>
          <section className="control-section"><h2>Seating arrangement</h2><p className="workflow-hint">Select a row in the plan to edit its individual spacing and seat count.</p><div className="segmented">{(['straight', 'fan', 'blocks'] as GeometryType[]).map((value) => <button key={value} className={config.geometry === value ? 'active' : ''} onClick={() => setConfig({ geometry: value })}>{value}</button>)}</div><RangeField label="Rows" value={config.rows} min={3} max={50} onBeginEdit={beginEdit} onCommitEdit={commitEdit} onChange={(rows) => setConfig({ rows })} /><RangeField label="Seats per row" value={config.seatsPerRow} min={5} max={30} onBeginEdit={beginEdit} onCommitEdit={commitEdit} onChange={(seatsPerRow) => setConfig({ seatsPerRow })} /><RangeField label="Sections" value={config.sectors} min={1} max={3} onBeginEdit={beginEdit} onCommitEdit={commitEdit} onChange={(sectors) => setConfig({ sectors })} /><RangeField label="Rake" value={config.rake} min={0.08} max={0.5} step={0.01} unit="m" onBeginEdit={beginEdit} onCommitEdit={commitEdit} onChange={(rake) => setConfig({ rake })} /><RangeField label="Stage width" value={config.stageWidth} min={6} max={20} unit="m" onBeginEdit={beginEdit} onCommitEdit={commitEdit} onChange={(stageWidth) => setConfig({ stageWidth })} /></section>
            </>}
            {layoutTool === 'categories' && <SeatCategoriesPanel config={config} selectedSeat={selectedSeat} onSelect={selectSeat} onChange={setConfig} />}
            {layoutTool === 'levels' && (config.seatingLevels?.length ? <SeatingLevelsPanel config={config} selectedSeat={selectedSeat} onChange={setConfig} /> : <div className="workflow-note"><strong>Single-level venue</strong><p>This project has no separate balconies or tiers. Adjust its rake in Seating, or start a theatre template from Project → New project.</p></div>)}
            {layoutTool === 'obstacles' && <ObstaclePanel config={config} onChange={setConfig} />}
          </>}
          <div hidden={step !== 2}>
            <BlenderPanel key={projectId} config={config} onLoaded={setImportedModel} onSource={setModelSource} />
            <section className="control-section"><h2>Check the view</h2><p className="workflow-hint">Compare representative seat views with reference photos. Changes stay in a draft until you apply them.</p><button className="button button-secondary" onClick={() => setView('review')}>Review seat views <ArrowRight size={16} /></button></section>
          </div>
          {step === 3 && <>
            <section className="delivery-card"><h2>1. Try the visitor experience</h2><p>Open a local preview to choose seats and look around the venue.</p><CustomerPreviewButton config={config} source={modelSource} /></section>
            <section className="delivery-card"><h2>2. Export your project</h2><p>Download a project backup or use the available export formats.</p><button className="button button-secondary" onClick={() => setExportOpen(true)}><Download size={16} /> Export options</button></section>
            <section className="delivery-card"><h2>3. Share when ready</h2><p>Manage the public cloud preview. Imported Blender models stay local and are not included in cloud sharing.</p><button className="button button-secondary" onClick={() => { setShareError(null); setShareOpen(true) }}><Share2 size={16} /> Sharing settings</button></section>
          </>}
          {step < 3 && <div className="workflow-next"><button className="button button-primary" onClick={() => goToStep(step + 1)}>Continue to {workflowSteps[step + 1].title.toLowerCase()} <ArrowRight size={16} /></button><small>You can return to any step at any time.</small></div>}
        </aside>
        <section className="viewport">
          {view !== 'review' && <div className="viewport-top"><div className="view-switch"><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><Map size={15} /> 2D plan</button><button className={view === 'model' ? 'active' : ''} onClick={() => setView('model')}><Box size={15} /> 3D model</button></div><div className="capacity-badge"><span>LIVE CAPACITY</span><strong>{capacity}</strong></div></div>}
          {view === 'review' ? <ViewReview key={projectId} config={config} model={modelSource?.signature === geometrySignature(config) ? importedModel : null} onApply={setConfig} onClose={() => setView('model')} /> : view === 'model' ? <><div className="canvas-wrap"><VenueScene config={config} selectedSeat={selectedSeat} onSeatSelect={selectSeat} importedModel={importedModel} /></div>{selectedSeat && <div className="seat-inspector"><button onClick={() => selectSeat(null)}>×</button><div><small>SELECTED SEAT</small><strong>{selectedSeat.label}</strong></div><div><small>PREVIEW</small><strong className="score">Approximate</strong></div><div><small>POSITION</small><span>Row {getRowLabel(config, selectedSeat.row)} · Seat {selectedSeat.seat + 1}</span></div></div>}</> : <FloorplanEditor config={config} imageUrl={floorplanUrl} fileName={floorplanName} onConfigChange={setConfig} onBeginEdit={beginEdit} onCommitEdit={commitEdit} />}
          {view !== 'review' && <div className="viewport-footer"><span><i className="legend-seat" /> Venue geometry</span><span><i className="legend-selected" /> Active selection</span><span>{modelSource ? 'Rebuild Blender architecture after geometry changes' : 'Select a seat to explore its view'}</span></div>}
        </section>
      </main>
      <CloudPanel open={cloudOpen} onClose={() => setCloudOpen(false)} session={cloudSession} currentProjectId={projectId} onSessionChange={setCloudSession} onNewProject={() => setCreateOpen(true)} onLoadProject={(project) => { loadProject(project.id, project.venue_data); setFloorplanUrl(null); setFloorplanName(null); setView('plan'); setStep(0); setShareToken(project.share_enabled ? project.share_token ?? null : null); lastSavedSnapshot.current = JSON.stringify({ projectId: project.id, config: project.venue_data }) }} />
      <CreateProjectWizard open={createOpen} onClose={() => setCreateOpen(false)} onCreate={startNewProject} />
      <ExportProjectDialog open={exportOpen} config={config} onClose={() => setExportOpen(false)} onProjectFile={exportProjectFile} />
      <ShareProjectDialog open={shareOpen} projectName={config.name} sessionAvailable={Boolean(cloudSession)} token={shareToken} busy={shareBusy} error={shareError} onClose={() => setShareOpen(false)} onEnable={() => void enableSharing()} onDisable={() => void disableSharing()} onOpenCloud={() => { setShareOpen(false); setCloudOpen(true) }} />
    </div>
  )
}
