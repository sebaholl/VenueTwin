import { resolveSeatLink, seatLink } from '../utils/viewerLinks'
import { Component, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Code2, Download, Eye, Maximize, MousePointer2 } from 'lucide-react'
import type { Group } from 'three'
import { VenueScene } from '../components/VenueScene'
import { Brand } from '../components/Brand'
import { loadViewerSnapshot } from '../lib/viewerStorage'
import { loadPublishedViewer } from '../lib/viewerAssets'
import { disposeLocalModel, loadLocalGlb } from '../utils/localGlb'
import { downloadViewerFile, embedCode, viewerLevels, viewerManifest, type ViewerSnapshot } from '../utils/customerViewer'
import { seatCategory } from '../utils/seatCategories'
import type { SeatRef, VenueConfig } from '../types/venue'
import { generatePhysicalSeatLayout, getRowLabel, type PositionedSeat } from '../utils/venue'
import { SeatNumberingNote } from '../components/SeatNumberingNote'
import '../viewer.css'

type Loaded = { snapshot: ViewerSnapshot; model: Group | null }
export function CustomerViewerPage() {
  const { search } = useLocation()
  const venue = new URLSearchParams(search).get('venue')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [loadingStage, setLoadingStage] = useState('Opening the saved venue…')
  useEffect(() => {
    const abort = new AbortController()
    let model: Group | null = null
    setLoaded(null); setError(''); setLoadingStage('Opening the saved venue…')
    void (async () => {
      try {
        const snapshot = venue ? await loadPublishedViewer(venue, abort.signal, (stage) => { if (!abort.signal.aborted) setLoadingStage(stage) }) : await loadViewerSnapshot()
        if (abort.signal.aborted) return
        if (snapshot.model) { setLoadingStage('Preparing model geometry and textures…'); model = await loadLocalGlb(new File([snapshot.model], 'venue.glb')) }
        if (abort.signal.aborted) { if (model) disposeLocalModel(model); return }
        setLoaded({ snapshot, model })
      } catch (reason) {
        if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : 'The venue could not be loaded.')
      }
    })()
    return () => { abort.abort(); if (model) disposeLocalModel(model) }
  }, [venue, attempt])
  if (error) return <main className="customer-empty"><Brand /><h1>Unable to open this venue</h1><p role="alert">{error}</p>{!venue && <Link to="/studio">Return to Studio</Link>}<button onClick={() => setAttempt((value) => value + 1)}>Try again</button></main>
  if (!loaded) return <main className="customer-empty" aria-live="polite"><Brand /><div className="viewer-spinner" /><h1>Opening the auditorium</h1><p>{loadingStage}</p></main>
  return <CustomerViewer key={search} {...loaded} local={!venue} manifest={venue} initialSeatId={new URLSearchParams(search).get('seat')} />
}

function CustomerViewer({ snapshot, model, local, manifest, initialSeatId }: Loaded & { local: boolean; manifest: string | null; initialSeatId: string | null }) {
  const { config } = snapshot
  const levels = useMemo(() => viewerLevels(config), [config])
  const initialSeat = useMemo(() => resolveSeatLink(config, initialSeatId), [config, initialSeatId])
  const [levelId, setLevelId] = useState(() => levels.find((level) => level.seats.some((seat) => seat.row === initialSeat?.row && seat.seat === initialSeat?.seat))?.id ?? levels[0]?.id ?? '')
  const level = levels.find((item) => item.id === levelId) ?? levels[0]
  const rows = [...new Set(level?.seats.map((s) => s.row) ?? [])]
  const [row, setRow] = useState(initialSeat?.row ?? rows[0] ?? 0)
  const currentRow = rows.includes(row) ? row : rows[0]
  const rowSeats = level?.seats.filter((s) => s.row === currentRow) ?? []
  const [selected, setSelected] = useState<PositionedSeat | null>(initialSeat)
  const [mode, setMode] = useState<'overview' | 'seat'>(initialSeat ? 'seat' : 'overview')
  const [tab, setTab] = useState<'3d' | 'plan'>('3d')
  const [status, setStatus] = useState(initialSeatId && !initialSeat ? 'That seat is not available in this venue version. Please choose another seat.' : '')
  const [copyFallback, setCopyFallback] = useState('')
  const copySeatLink = async () => {
    if (!manifest || !selected) return
    const url = seatLink(location.origin, manifest, selected)
    try { await navigator.clipboard.writeText(url); setStatus('Seat link copied.'); setCopyFallback('') }
    catch { setCopyFallback(url); setStatus('Select and copy the seat link below.') }
  }
  const [sceneReady, setSceneReady] = useState(false)
  const [sceneAttempt, setSceneAttempt] = useState(0)
  const handleReady = useCallback(() => setSceneReady(true), [])
  const picker = useRef<HTMLElement>(null)
  const showSeatMap = () => { setMode('overview'); setTab('plan') }
  const changeTab = (next: '3d' | 'plan') => { if (next === '3d' && tab !== '3d') setSceneReady(false); setTab(next) }
  const root = useRef<HTMLDivElement>(null)
  const pickSeat = (seat: SeatRef) => {
    const nextLevel = levels.find((l) => l.seats.some((s) => s.row === seat.row && s.seat === seat.seat))
    const next = nextLevel?.seats.find((s) => s.row === seat.row && s.seat === seat.seat)
    if (!nextLevel || !next) return
    setLevelId(nextLevel.id); setRow(next.row); setSelected(next)
  }
  const category = selected ? seatCategory(config, selected.row, selected.seat) : null
  const selectedIndex = selected ? rowSeats.findIndex((s) => s.label === selected.label) : -1
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else if (root.current?.requestFullscreen) await root.current.requestFullscreen()
      else setStatus('Full screen is not supported by this browser.')
    } catch { setStatus('Full screen could not be opened. You can still use the viewer below.') }
  }
  return <div className="customer-viewer" ref={root}>
    {local && <div className="customer-local-note"><span>LOCAL PREVIEW · This link works only in this browser.</span><Link to="/studio" target="_blank" rel="noreferrer">Open Studio ↗</Link></div>}
    <header className="customer-header"><div><Brand /><span className="customer-eyebrow">THE VIEW FROM YOUR SEAT</span></div><button className="viewer-icon-button" onClick={() => void fullscreen()} aria-label="Toggle full screen"><Maximize size={18} /></button></header>
    <main className="customer-layout">
      <aside ref={picker} tabIndex={-1} className="customer-picker" aria-label="Choose your seat">
        <div className="customer-title"><span className="customer-eyebrow">EXPLORE THE AUDITORIUM</span><h1>{config.name.replace(/ · estimated study$/, '')}</h1><p>Find a seat. Take a look around.</p></div>
        <section><h2><span>01</span> Choose a level</h2><div className="customer-levels">{levels.map((l) => <button key={l.id} aria-pressed={levelId === l.id} onClick={() => { setLevelId(l.id); setRow(l.seats[0].row); setSelected(null); setMode('overview') }}><span>{l.name}<small>{l.seats.length} seats</small></span>{levelId === l.id && <Check size={17} />}</button>)}</div></section>
        <section><h2><span>02</span> Choose a seat</h2><label className="customer-row-label">Row<select aria-label="Choose row" value={currentRow} onChange={(e) => { setRow(Number(e.target.value)); setSelected(null); setMode('overview') }}>{rows.map((r) => <option key={r} value={r}>Row {getRowLabel(config, r)}</option>)}</select></label>
          <div className="customer-seat-grid" aria-label={`Seats in row ${getRowLabel(config, currentRow)}`}>{rowSeats.map((seat) => <button key={seat.label} aria-label={`Select seat ${seat.label}`} aria-pressed={selected?.label === seat.label} onClick={() => pickSeat(seat)}>{seat.seat + 1}</button>)}</div>
        </section>
        {config.studyNotice && <SeatNumberingNote config={config} row={currentRow} />}
        <div className="customer-selection" aria-live="polite">{selected ? <><span className="customer-eyebrow">YOUR SELECTED VIEW</span><div><strong>{selected.label}</strong><p>{level.name}<br />Row {getRowLabel(config, selected.row)} · Seat {selected.seat + 1}</p></div><small>{category?.name} · Preview only</small></> : <><MousePointer2 size={22} /><p>Select a numbered seat or choose one in the model.</p></>}</div>
        <button className="customer-enter" disabled={!selected} onClick={() => { changeTab('3d'); setMode(mode === 'seat' && tab === '3d' ? 'overview' : 'seat'); if (window.innerWidth <= 850) root.current?.querySelector('.customer-stage')?.scrollIntoView({ block: 'start' }) }}><Eye size={18} />{mode === 'seat' && tab === '3d' ? 'Back to auditorium' : 'View from this seat'}<ArrowRight size={18} /></button>
        {!local && selected && <button className="customer-share-seat" onClick={() => void copySeatLink()}>Copy link to this seat</button>}
        {copyFallback && <label className="customer-link-fallback">Seat link<input readOnly value={copyFallback} onFocus={(event) => event.target.select()} /></label>}
        {local && <WebsiteExport snapshot={snapshot} />}
      </aside>
      <section className="customer-stage" aria-label="Venue preview">
        <div className="customer-stage-heading"><div><span className="customer-eyebrow">{mode === 'seat' && tab === '3d' ? 'SEAT PERSPECTIVE' : 'AUDITORIUM'}</span><h2>{mode === 'seat' && selected && tab === '3d' ? `${level.name} · ${selected.label}` : level.name}</h2></div><div className="customer-tabs" aria-label="View type"><button aria-pressed={tab === '3d'} onClick={() => changeTab('3d')}>3D view</button><button aria-pressed={tab === 'plan'} onClick={() => changeTab('plan')}>Seat map</button></div></div>
        <div className="customer-canvas">
          {tab === '3d' ? <ViewerSceneBoundary key={sceneAttempt} onMap={showSeatMap} onRetry={() => { setSceneReady(false); setSceneAttempt((value) => value + 1) }}><VenueScene config={config} selectedSeat={selected} onSeatSelect={pickSeat} importedModel={model} viewMode={mode} onViewModeChange={(next) => { setMode(next); if (next === 'overview') showSeatMap() }} onReady={handleReady} customer />{!sceneReady && <div className="viewer-scene-loading" role="status"><div className="viewer-spinner" /><strong>Preparing the 3D view…</strong><span>You can use the seat map while it loads.</span><button onClick={showSeatMap}>Open seat map</button></div>}</ViewerSceneBoundary> : <CustomerSeatMap seats={level.seats} selected={selected} onSelect={pickSeat} config={config} />}
        </div>
        <div className="customer-view-footer"><span>{tab === 'plan' ? 'Showing seats on the selected level' : mode === 'seat' ? 'Drag with one finger to look around · Arrow keys also work' : 'Drag to rotate · Pinch with two fingers to zoom'}</span>{selected && <div><button aria-label="Previous seat" disabled={selectedIndex <= 0} onClick={() => pickSeat(rowSeats[selectedIndex - 1])}><ArrowLeft size={16} /></button><b>{selected.label}</b><button aria-label="Next seat" disabled={selectedIndex < 0 || selectedIndex === rowSeats.length - 1} onClick={() => pickSeat(rowSeats[selectedIndex + 1])}><ArrowRight size={16} /></button></div>}</div>
        <button className="customer-choose-seats" onClick={() => { picker.current?.scrollIntoView({ block: 'start' }); picker.current?.focus({ preventScroll: true }) }}>Choose level, row & seat <ArrowRight size={16} /></button>
        <p className="customer-disclaimer">{config.studyNotice ? config.studyNotice : 'Approximate view of the supplied model. People, event equipment and missing structures can affect your view.'} {!model && 'Showing generated geometry.'} No booking or live availability.</p>
        {status && <p role="status" className="customer-status">{status}</p>}
      </section>
    </main>
  </div>
}

class ViewerSceneBoundary extends Component<{ children: ReactNode; onRetry: () => void; onMap: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (this.state.failed) return <div className="viewer-scene-loading" role="alert"><strong>The 3D view could not open</strong><span>Try again, or continue choosing seats on the map.</span><button onClick={this.props.onRetry}>Retry 3D view</button><button onClick={this.props.onMap}>Open seat map</button></div>
    return this.props.children
  }
}

function CustomerSeatMap({ seats, selected, onSelect, config }: { seats: PositionedSeat[]; selected: SeatRef | null; onSelect: (s: SeatRef) => void; config: VenueConfig }) {
  const { stageWidth } = config
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const angle = stage.rotation * Math.PI / 180
  const centre = [stage.offsetX - Math.sin(angle) * 2.4, stage.offsetY - Math.cos(angle) * 2.4]
  const xs = seats.map((s) => s.position[0]), zs = seats.map((s) => s.position[2])
  const extentX = Math.abs(Math.cos(angle) * stageWidth / 2) + Math.abs(Math.sin(angle) * .6)
  const extentZ = Math.abs(Math.sin(angle) * stageWidth / 2) + Math.abs(Math.cos(angle) * .6)
  const minX = Math.min(centre[0] - extentX, ...xs) - 1, maxX = Math.max(centre[0] + extentX, ...xs) + 1
  const minZ = Math.min(centre[1] - extentZ, ...zs) - 1, maxZ = Math.max(centre[1] + extentZ, ...zs) + 1
  return <div className="customer-map"><svg viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`} aria-label="Seat map for the selected level. Use the numbered seat buttons to select with a keyboard." role="img">
    <g transform={`translate(${centre[0]},${centre[1]}) rotate(${-stage.rotation})`}><rect x={-stageWidth / 2} y={-.6} width={stageWidth} height={1.2} rx={.15} fill="#26363d" /><text x={0} y={.16} textAnchor="middle" fill="#c7d6d7" fontSize={.42}>STAGE</text></g>
    {generatePhysicalSeatLayout(config).filter((s) => s.service && seats.some((seat) => seat.row === s.row)).map((s) => <g key={s.label} transform={`translate(${s.position[0]},${s.position[2]})`}><title>Service place · not for sale</title><rect x={-.2} y={-.2} width={.4} height={.4} fill="none" stroke="#a4b5bd" strokeWidth={.04} /><path d="M -.13 -.13 L .13 .13 M .13 -.13 L -.13 .13" stroke="#a4b5bd" strokeWidth={.04} /></g>)}
    {seats.map((s) => <circle key={s.label} cx={s.position[0]} cy={s.position[2]} r={.2} fill={selected?.label === s.label ? '#ff946f' : '#72d7bf'} onClick={() => onSelect(s)}><title>{s.label}</title></circle>)}
  </svg><p>Use the numbered buttons for precise seat selection. Crossed squares are service places, not for sale.</p></div>
}

function WebsiteExport({ snapshot }: { snapshot: ViewerSnapshot }) {
  const [folder, setFolder] = useState('/venues/national-theatre')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  let code = ''
  try { code = embedCode(location.origin, folder) } catch { /* Explained below. */ }
  const exportManifest = async () => {
    setBusy(true); setMessage('')
    try { downloadViewerFile(new Blob([JSON.stringify(await viewerManifest(snapshot), null, 2)], { type: 'application/json' }), 'venue.json'); setMessage('Viewer project downloaded.') }
    catch { setMessage('Could not prepare the viewer project.') }
    finally { setBusy(false) }
  }
  return <details className="customer-export"><summary><Code2 size={15} /> Website setup</summary><p>For later publishing: upload these files together into the folder below on your VenueTwin website. The local preview link is not shareable.</p><button disabled={busy} onClick={() => void exportManifest()}><Download size={14} />{busy ? 'Preparing…' : 'Download venue.json'}</button>{snapshot.model && <button onClick={() => downloadViewerFile(snapshot.model!, 'venue.glb')}><Download size={14} />Download venue.glb</button>}<label>Website folder<input value={folder} onChange={(e) => setFolder(e.target.value)} /></label>{code ? <><textarea readOnly aria-label="Embed code" value={code} /><button onClick={() => void navigator.clipboard.writeText(code).then(() => setMessage('Embed code copied.')).catch(() => setMessage('Select and copy the code above.'))}>Copy embed code</button></> : <p>Use a path such as /venues/national-theatre.</p>}<p>Use your public domain instead of localhost when publishing. The receiving website needs this version of VenueTwin.</p><p role="status">{message}</p></details>
}
