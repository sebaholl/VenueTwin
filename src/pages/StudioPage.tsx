import { ArrowLeft, Box, Download, FileImage, RotateCcw, Save, Settings2, Upload } from 'lucide-react'
import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { VenueScene } from '../components/VenueScene'
import { useVenueStore } from '../store/venueStore'
import type { GeometryType } from '../types/venue'
import { estimateCapacity, estimateSeatScore } from '../utils/venue'

type RangeFieldProps = { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void }
function RangeField({ label, value, min, max, step = 1, unit = '', onChange }: RangeFieldProps) {
  return <label className="range-field"><span><b>{label}</b><output>{value}{unit}</output></span><input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} /></label>
}

export function StudioPage() {
  const { config, selectedSeat, floorplanName, setConfig, selectSeat, setFloorplanName, reset } = useVenueStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [saved, setSaved] = useState(false)
  const capacity = useMemo(() => estimateCapacity(config), [config])
  const seatScore = selectedSeat ? estimateSeatScore(selectedSeat, config) : null

  const handleFloorplan = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) setFloorplanName(file.name)
  }
  const exportProject = () => {
    const blob = new Blob([JSON.stringify({ version: 1, config }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${config.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.venuetwin.json`; anchor.click(); URL.revokeObjectURL(url)
  }
  const saveProject = () => { setSaved(true); window.setTimeout(() => setSaved(false), 1800) }

  return (
    <div className="studio-shell">
      <header className="studio-header">
        <div className="studio-brand"><Link to="/" className="back-link"><ArrowLeft size={17} /></Link><Brand /><span className="status-pill"><i /> Local project</span></div>
        <div className="studio-actions"><button className="icon-button" onClick={reset} title="Reset project"><RotateCcw /></button><button className="button button-ghost button-small" onClick={exportProject}><Download size={16} /> Export</button><button className="button button-primary button-small" onClick={saveProject}><Save size={16} /> {saved ? 'Saved locally' : 'Save project'}</button></div>
      </header>
      <main className="studio-main">
        <aside className="control-panel">
          <div className="panel-heading"><div><span>PROJECT</span><input value={config.name} onChange={(e) => setConfig({ name: e.target.value })} aria-label="Project name" /></div><Settings2 /></div>
          <section className="control-section"><h2><span>1</span> Source plan</h2><input ref={fileInput} hidden type="file" accept="image/*,.pdf" onChange={handleFloorplan} /><button className="upload-zone" onClick={() => fileInput.current?.click()}><FileImage /><b>{floorplanName ?? 'Upload floor plan'}</b><small>PDF, JPG or PNG · processed locally</small><span><Upload size={14} /> Choose file</span></button></section>
          <section className="control-section"><h2><span>2</span> Venue geometry</h2><div className="segmented">{(['straight', 'fan', 'blocks'] as GeometryType[]).map((value) => <button key={value} className={config.geometry === value ? 'active' : ''} onClick={() => setConfig({ geometry: value })}>{value}</button>)}</div><RangeField label="Rows" value={config.rows} min={3} max={18} onChange={(rows) => setConfig({ rows })} /><RangeField label="Seats per row" value={config.seatsPerRow} min={5} max={24} onChange={(seatsPerRow) => setConfig({ seatsPerRow })} /><RangeField label="Sections" value={config.sectors} min={1} max={3} onChange={(sectors) => setConfig({ sectors })} /><RangeField label="Rake" value={config.rake} min={0.08} max={0.5} step={0.01} unit="m" onChange={(rake) => setConfig({ rake })} /><RangeField label="Stage width" value={config.stageWidth} min={6} max={20} unit="m" onChange={(stageWidth) => setConfig({ stageWidth })} /></section>
          <div className="project-stats"><div><span>Capacity</span><strong>{capacity}</strong></div><div><span>Sections</span><strong>{config.sectors}</strong></div><div><span>Selected</span><strong>{selectedSeat?.label ?? '—'}</strong></div></div>
        </aside>
        <section className="viewport">
          <div className="viewport-top"><div><span className="view-chip"><Box size={15} /> 3D model</span><span className="viewport-hint">Drag to orbit · scroll to zoom · select a seat</span></div><div className="capacity-badge"><span>EST. CAPACITY</span><strong>{capacity}</strong></div></div>
          <div className="canvas-wrap"><VenueScene config={config} selectedSeat={selectedSeat} onSeatSelect={selectSeat} /></div>
          {selectedSeat && <div className="seat-inspector"><button onClick={() => selectSeat(null)}>×</button><div><small>SELECTED SEAT</small><strong>{selectedSeat.label}</strong></div><div><small>VIEW QUALITY</small><strong className="score">{seatScore}%</strong></div><div><small>POSITION</small><span>Row {String.fromCharCode(65 + selectedSeat.row)} · Seat {selectedSeat.seat + 1}</span></div></div>}
          <div className="viewport-footer"><span><i className="legend-seat" /> Available seat</span><span><i className="legend-selected" /> Selected seat</span><span>All changes are saved in this browser</span></div>
        </section>
      </main>
    </div>
  )
}
