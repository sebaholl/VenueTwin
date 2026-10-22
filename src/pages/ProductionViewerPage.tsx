import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { ProductionScene } from '../components/ProductionScene'
import { loadProductionVenue, type LoadedProduction } from '../lib/productionAssets'
import { disposeLocalModel } from '../utils/localGlb'
import { productionSeatLink, type ProductionSeat } from '../utils/productionViewer'
import '../production-viewer.css'

class SceneBoundary extends Component<{ children: ReactNode; onMap: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="managed-fallback" role="alert"><h2>3D is unavailable on this device</h2><p>You can still explore the seat map and seat list.</p><button onClick={this.props.onMap}>Open seat map</button></div> : this.props.children }
}
export function ProductionViewerPage() {
  const { search } = useLocation()
  const params = new URLSearchParams(search), path = params.get('venue'), initialSeat = params.get('seat')
  const [loaded, setLoaded] = useState<LoadedProduction | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController(); let resource: LoadedProduction | null = null
    setLoaded(null); setError('')
    if (!path) { setError('This link is missing its venue. Ask the venue operator for the complete link.'); return }
    void loadProductionVenue(path, controller.signal).then(result => {
      resource = result
      if (controller.signal.aborted) { disposeLocalModel(result.model); resource = null } else setLoaded(result)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'This venue could not be opened.') })
    return () => { controller.abort(); if (resource) disposeLocalModel(resource.model) }
  }, [path, attempt])
  if (error) return <main className="managed-empty"><Brand /><h1>Unable to open this venue</h1><p role="alert">{error}</p><button onClick={() => setAttempt(v => v + 1)}>Try again</button><Link to="/service">Contact & support</Link></main>
  if (!loaded || !path) return <main className="managed-empty" aria-live="polite"><Brand /><h1>Opening your venue…</h1><p>Loading the model and checking seat views.</p></main>
  return <ManagedViewer key={`${path}:${attempt}:${initialSeat}`} loaded={loaded} path={path} initialSeat={initialSeat} />
}
function ManagedViewer({ loaded, path, initialSeat }: { loaded: LoadedProduction; path: string; initialSeat: string | null }) {
  const { manifest } = loaded
  const first = manifest.seats.find(s => s.id === initialSeat) ?? null
  const [selected, setSelected] = useState<ProductionSeat | null>(first)
  const [level, setLevel] = useState(first?.level_id ?? manifest.seats[0].level_id)
  const seats = manifest.seats.filter(s => s.level_id === level), rows = [...new Set(seats.map(s => s.row))]
  const [row, setRow] = useState(first?.row ?? rows[0]), rowSeats = seats.filter(s => s.row === row)
  const [inside, setInside] = useState(!!first), [map, setMap] = useState(false), [ready, setReady] = useState(false), [failed, setFailed] = useState(false)
  const [status, setStatus] = useState(initialSeat && !first ? 'That seat is not available in this venue version. Choose another seat.' : '')
  const [fallbackLink, setFallbackLink] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const onReady = useCallback(() => setReady(true), []), onFailure = useCallback(() => { setFailed(true); setMap(true); setStatus('The 3D view was interrupted. The seat map remains available.') }, [])
  const pick = (seat: ProductionSeat) => { setSelected(seat); setLevel(seat.level_id); setRow(seat.row) }
  const share = async () => {
    if (!selected) return
    const link = productionSeatLink(location.origin, path, selected.id)
    try { await navigator.clipboard.writeText(link); setStatus('Seat link copied.'); setFallbackLink('') }
    catch { setFallbackLink(link); setStatus('Select and copy this seat link.') }
  }
  const fullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setStatus('Full screen is unavailable in this browser.') } catch { setStatus('Full screen could not be opened.') } }
  return <div className="managed-viewer" ref={root}>
    <header className="managed-header"><Brand /><span>{manifest.quality === 'demonstration' ? 'DEMONSTRATION' : 'VENUE PREVIEW'}</span><button onClick={() => void fullscreen()}>Full screen</button></header>
    <main className="managed-layout">
      <aside className="managed-picker" aria-label="Choose your seat"><p className="managed-eyebrow">THE VIEW FROM YOUR SEAT</p><h1>{manifest.name}</h1><p>Find your place. Take a look around.</p>
        <label>Level<select aria-label="Choose level" value={level} onChange={e => { const next = manifest.seats.filter(s => s.level_id === e.target.value); setLevel(e.target.value); setRow(next[0].row); setSelected(null); setInside(false) }}>{manifest.levels.filter(l => manifest.seats.some(s => s.level_id === l.id)).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
        <label>Row<select aria-label="Choose row" value={row} onChange={e => { setRow(e.target.value); setSelected(null); setInside(false) }}>{rows.map(r => <option key={r} value={r}>{r}</option>)}</select></label>
        <div className="managed-seats" aria-label={`Seats in row ${row}`}>{rowSeats.map(s => <button key={s.id} aria-label={`Select seat ${s.label}`} aria-pressed={selected?.id === s.id} onClick={() => pick(s)}>{s.label}</button>)}</div>
        <div className="managed-selection" aria-live="polite">{selected ? <><small>SELECTED SEAT</small><strong>{selected.label}</strong><span>{manifest.levels.find(l => l.id === selected.level_id)?.name} · Row {selected.row}</span></> : <p>Choose a seat from the list or the model.</p>}</div>
        <button className="managed-primary" disabled={!selected || failed} onClick={() => { setMap(false); setInside(!inside) }}>{inside ? 'Back to overview' : 'View from this seat'}</button>
        <button disabled={!selected} onClick={() => void share()}>Copy seat link</button>
        {fallbackLink && <label>Seat link<input readOnly value={fallbackLink} onFocus={e => e.target.select()} /></label>}
        <p className="managed-meta">{manifest.seats.length} seats · Version {manifest.revision}<br />No booking or live availability.</p>
        <Link to="/service">Service & support</Link>
      </aside>
      <section className="managed-stage" aria-label="Venue preview"><div className="managed-stage-header"><div><p className="managed-eyebrow">{inside && !map ? 'SEAT PERSPECTIVE' : 'EXPLORE THE VENUE'}</p><h2>{inside && selected && !map ? `Seat ${selected.label}` : 'Auditorium'}</h2></div><div className="managed-tabs"><button aria-pressed={!map} disabled={failed} onClick={() => setMap(false)}>3D view</button><button aria-pressed={map} onClick={() => setMap(true)}>Seat map</button></div></div>
        <div className="managed-canvas">{map ? <SeatMap seats={seats} target={manifest.target} selected={selected?.id} onSelect={pick} /> : <SceneBoundary onMap={() => setMap(true)}><ProductionScene loaded={loaded} selected={selected} inside={inside} onSelect={pick} onExit={() => setInside(false)} onReady={onReady} onFailure={onFailure} />{!ready && <p className="managed-loading" role="status">Preparing 3D… You can switch to the seat map.</p>}</SceneBoundary>}</div>
        <div className="managed-hint">{map ? 'Select a seat on the map or use the numbered buttons.' : inside ? 'Drag or use arrow keys to look around. Escape returns to overview.' : 'Drag to rotate. Pinch or scroll to zoom.'}<span data-testid="scene-status">{ready ? '3D ready' : 'Seat map available'}</span></div>
        <p className="managed-notice">{manifest.notice} Chair shapes and lighting are illustrative. This is not a certified sightline or accessibility assessment.</p>
        {status && <p role="status">{status}</p>}
      </section>
    </main>
  </div>
}
function SeatMap({ seats, target, selected, onSelect }: { seats: ProductionSeat[]; target: [number, number, number]; selected?: string; onSelect: (seat: ProductionSeat) => void }) {
  const xs = [...seats.map(s => s.position[0]), target[0]], zs = [...seats.map(s => s.position[2]), target[2]]
  const minX = Math.min(...xs) - 1, minZ = Math.min(...zs) - 1, width = Math.max(...xs) - minX + 1, height = Math.max(...zs) - minZ + 1
  return <svg className="managed-map" viewBox={`${minX} ${minZ} ${width} ${height}`} role="img" aria-label="Seat map. Use the seat buttons for keyboard selection."><g transform={`translate(${target[0]},${target[2]})`}><rect x={-.7} y={-.3} width={1.4} height={.6} rx={.1} fill="#71898c" /><text y={.08} textAnchor="middle" fontSize={.19} fill="white">STAGE</text></g>{seats.map(s => <g key={s.id} transform={`translate(${s.position[0]},${s.position[2]})`} onClick={() => onSelect(s)}><circle r={.24} fill={s.id === selected ? '#ffad78' : '#3cbda5'} /><text textAnchor="middle" y={.06} fontSize={.17} fill="#10212a">{s.label}</text><title>{s.label}</title></g>)}</svg>
}
