import { AlertCircle, ArrowLeft, Box, Cloud, Download, FileImage, FileUp, Map, RotateCcw, Save, Settings2, Upload, X } from 'lucide-react'
import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { CloudPanel } from '../components/CloudPanel'
import { FloorplanEditor } from '../components/FloorplanEditor'
import { VenueScene } from '../components/VenueScene'
import { ensureFreshSession, getStoredSession, saveCloudProject, storeSession, type CloudSession } from '../lib/supabaseApi'
import { useVenueStore } from '../store/venueStore'
import type { GeometryType, VenueConfig } from '../types/venue'
import { estimateCapacity, estimateSeatScore } from '../utils/venue'

type RangeFieldProps = { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }
function RangeField({ label, value, min, max, step = 1, unit = '', onChange }: RangeFieldProps) {
  return <label className="range-field"><span><b>{label}</b><output>{value}{unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>
}

function isVenueConfig(value: unknown): value is VenueConfig {
  if (!value || typeof value !== 'object') return false
  const config = value as Partial<VenueConfig>
  return typeof config.name === 'string' && typeof config.rows === 'number' && typeof config.seatsPerRow === 'number' && typeof config.sectors === 'number' && typeof config.rake === 'number' && typeof config.stageWidth === 'number' && ['straight', 'fan', 'blocks'].includes(config.geometry ?? '') && typeof config.rowOverrides === 'object'
}

type SyncStatus = 'local' | 'saving' | 'saved' | 'offline' | 'error'

export function StudioPage() {
  const { projectId, config, selectedSeat, floorplanName, setConfig, loadProject, selectSeat, setFloorplanName, reset } = useVenueStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const importInput = useRef<HTMLInputElement>(null)
  const lastSavedSnapshot = useRef('')
  const [saveLabel, setSaveLabel] = useState('Save project')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local')
  const [onlineRetry, setOnlineRetry] = useState(0)
  const [view, setView] = useState<'plan' | 'model'>('plan')
  const [floorplanUrl, setFloorplanUrl] = useState<string | null>(null)
  const [cloudOpen, setCloudOpen] = useState(false)
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(() => getStoredSession())
  const capacity = useMemo(() => estimateCapacity(config), [config])
  const seatScore = selectedSeat ? estimateSeatScore(selectedSeat, config) : null

  const handleFloorplan = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setFloorplanName(file.name)
      setView('plan')
      setFloorplanUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    }
  }
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const payload = JSON.parse(await file.text()) as { config?: unknown }
      if (!isVenueConfig(payload.config)) throw new Error('This file does not contain a valid VenueTwin project.')
      loadProject(crypto.randomUUID(), payload.config)
      setFloorplanUrl(null); setFloorplanName(null); setView('plan'); setSaveError(null)
      lastSavedSnapshot.current = ''
    } catch (error) { setSaveError(error instanceof Error ? error.message : 'Project import failed.') }
  }
  useEffect(() => () => { if (floorplanUrl) URL.revokeObjectURL(floorplanUrl) }, [floorplanUrl])
  useEffect(() => {
    const retry = () => setOnlineRetry((value) => value + 1)
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [])
  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ version: 2, config }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.venuetwin.json`; anchor.click(); URL.revokeObjectURL(url)
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

  const startNewProject = () => {
    reset(); setFloorplanUrl(null); setFloorplanName(null); setView('plan'); setSaveError(null)
    lastSavedSnapshot.current = ''
  }

  const syncText = !cloudSession ? 'Local only' : ({ saving: 'Saving…', saved: 'Saved', offline: 'Offline', error: 'Sync error', local: 'Cloud connected' } as const)[syncStatus]

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand"><Link to="/" className="back-link"><ArrowLeft size={17} /></Link><Brand /><button className={`status-pill ${cloudSession ? `cloud-active sync-${syncStatus}` : ''}`} onClick={() => setCloudOpen(true)}><i /> {syncText}</button></div>
        <div className="studio-actions"><button className="icon-button cloud-button" onClick={() => setCloudOpen(true)} title="Cloud projects"><Cloud /></button><button className="icon-button" onClick={startNewProject} title="New project"><RotateCcw /></button><input ref={importInput} hidden type="file" accept=".json,.venuetwin.json,application/json" onChange={importProject} /><button className="button button-ghost button-small" onClick={() => importInput.current?.click()}><FileUp size={16} /> Import</button><button className="button button-ghost button-small" onClick={exportProject}><Download size={16} /> Export</button><button className="button button-primary button-small" onClick={saveProject}><Save size={16} /> {saveLabel}</button></div>
      </header>
      {saveError && <div className="save-error-toast" role="alert"><AlertCircle /><div><strong>Cloud save failed</strong><span>{saveError}</span></div><button onClick={() => setSaveError(null)} aria-label="Dismiss save error"><X /></button></div>}
      <main className="studio-main">
        <aside className="control-panel">
          <div className="panel-heading"><div><span>PROJECT</span><input value={config.name} onChange={(e) => setConfig({ name: e.target.value })} aria-label="Project name" /></div><Settings2 /></div>
          <section className="control-section"><h2><span>1</span> Source plan</h2><input ref={fileInput} hidden type="file" accept="image/*,.pdf" onChange={handleFloorplan} /><button className="upload-zone" onClick={() => fileInput.current?.click()}><FileImage /><b>{floorplanName ?? 'Upload floor plan'}</b><small>JPG and PNG overlay · PDF stored as source</small><span><Upload size={14} /> Choose file</span></button></section>
          <section className="control-section"><h2><span>2</span> Venue geometry</h2><div className="segmented">{(['straight', 'fan', 'blocks'] as GeometryType[]).map((value) => <button key={value} className={config.geometry === value ? 'active' : ''} onClick={() => setConfig({ geometry: value })}>{value}</button>)}</div><RangeField label="Rows" value={config.rows} min={3} max={18} onChange={(rows) => setConfig({ rows })} /><RangeField label="Seats per row" value={config.seatsPerRow} min={5} max={24} onChange={(seatsPerRow) => setConfig({ seatsPerRow })} /><RangeField label="Sections" value={config.sectors} min={1} max={3} onChange={(sectors) => setConfig({ sectors })} /><RangeField label="Rake" value={config.rake} min={0.08} max={0.5} step={0.01} unit="m" onChange={(rake) => setConfig({ rake })} /><RangeField label="Stage width" value={config.stageWidth} min={6} max={20} unit="m" onChange={(stageWidth) => setConfig({ stageWidth })} /></section>
          <div className="project-stats"><div><span>Capacity</span><strong>{capacity}</strong></div><div><span>Sections</span><strong>{config.sectors}</strong></div><div><span>Selected</span><strong>{selectedSeat?.label ?? '—'}</strong></div></div>
        </aside>
        <section className="viewport">
          <div className="viewport-top"><div className="view-switch"><button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}><Map size={15} /> 2D plan</button><button className={view === 'model' ? 'active' : ''} onClick={() => setView('model')}><Box size={15} /> 3D model</button></div><div className="capacity-badge"><span>LIVE CAPACITY</span><strong>{capacity}</strong></div></div>
          {view === 'model' ? <><div className="canvas-wrap"><VenueScene config={config} selectedSeat={selectedSeat} onSeatSelect={selectSeat} /></div>{selectedSeat && <div className="seat-inspector"><button onClick={() => selectSeat(null)}>×</button><div><small>SELECTED SEAT</small><strong>{selectedSeat.label}</strong></div><div><small>VIEW QUALITY</small><strong className="score">{seatScore}%</strong></div><div><small>POSITION</small><span>Row {String.fromCharCode(65 + selectedSeat.row)} · Seat {selectedSeat.seat + 1}</span></div></div>}</> : <FloorplanEditor config={config} imageUrl={floorplanUrl} fileName={floorplanName} onConfigChange={setConfig} />}
          <div className="viewport-footer"><span><i className="legend-seat" /> Venue geometry</span><span><i className="legend-selected" /> Active selection</span><span>All edits sync with the 3D model</span></div>
        </section>
      </main>
      <CloudPanel open={cloudOpen} onClose={() => setCloudOpen(false)} session={cloudSession} currentProjectId={projectId} onSessionChange={setCloudSession} onNewProject={startNewProject} onLoadProject={(project) => { loadProject(project.id, project.venue_data); setFloorplanUrl(null); setView('plan'); lastSavedSnapshot.current = JSON.stringify({ projectId: project.id, config: project.venue_data }) }} />
    </div>
  )
}
