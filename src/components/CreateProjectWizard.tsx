import { ArrowLeft, ArrowRight, Building2, Check, Film, FileImage, Presentation, Theater, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { GeometryType, VenueConfig, VenueType } from '../types/venue'
import { createProjectConfig, venueTypeLabel } from '../utils/projectPresets'
import { estimateCapacity } from '../utils/venue'
import { createNationalTheatreStudy } from '../utils/nationalTheatreStudy'
import { createNationalTheatreSeatingStudy } from '../utils/nationalTheatreSeating'

type Props = {
  open: boolean
  onClose: () => void
  onCreate: (config: VenueConfig, floorplan: File | null) => void
}

const venueTypes: { type: VenueType; icon: typeof Film; description: string }[] = [
  { type: 'cinema', icon: Film, description: 'Screen-focused rows with a stronger rake.' },
  { type: 'theatre', icon: Theater, description: 'Curved audience layout facing a stage.' },
  { type: 'conference', icon: Presentation, description: 'Flexible seating arranged in sections.' },
  { type: 'other', icon: Building2, description: 'A neutral layout for any venue type.' },
]

export function CreateProjectWizard({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState('')
  const [venueType, setVenueType] = useState<VenueType>('theatre')
  const [floorplan, setFloorplan] = useState<File | null>(null)
  const [layout, setLayout] = useState(() => createProjectConfig({ name: '', venueType: 'theatre' }))

  const preview = useMemo(() => createProjectConfig({
    name,
    venueType,
    geometry: layout.geometry,
    rows: layout.rows,
    seatsPerRow: layout.seatsPerRow,
    sectors: layout.sectors,
  }), [layout.geometry, layout.rows, layout.seatsPerRow, layout.sectors, name, venueType])

  if (!open) return null

  const selectType = (type: VenueType) => {
    setVenueType(type)
    setLayout(createProjectConfig({ name, venueType: type }))
  }
  const finish = () => {
    onCreate(preview, floorplan)
    setStep(1); setName(''); setVenueType('theatre'); setFloorplan(null)
    setLayout(createProjectConfig({ name: '', venueType: 'theatre' }))
  }

  return <div className="project-wizard-overlay" role="presentation" onMouseDown={onClose}>
    <section className="project-wizard" role="dialog" aria-modal="true" aria-labelledby="project-wizard-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>NEW PROJECT · STEP {step} OF 2</span><h2 id="project-wizard-title">{step === 1 ? 'Tell us about the venue' : 'Set the starting layout'}</h2></div><button onClick={onClose} aria-label="Close new project wizard"><X /></button></header>
      <div className="wizard-progress"><i className="active" /><i className={step === 2 ? 'active' : ''} /></div>

      {step === 1 ? <div className="wizard-step">
        <button className="button button-ghost" type="button" onClick={() => { onCreate(createNationalTheatreStudy(), null); setStep(1) }}>Open National Theatre study · estimated geometry</button>
        <button className="button button-ghost" type="button" onClick={() => { onCreate(createNationalTheatreSeatingStudy(), null); setStep(1) }}>Open sourced stalls study · rows 1–13</button>
        <small>Separate project with official stalls numbering and estimated geometry. Rebuild the Blender model for this layout; the previous GLB has different row decks.</small>
        <label className="wizard-name">Project name<input autoFocus maxLength={120} value={name} placeholder="e.g. Esbjerg Cinema · Screen 1" onChange={(event) => setName(event.target.value)} /></label>
        <div className="venue-type-grid">{venueTypes.map(({ type, icon: Icon, description }) => <button key={type} className={venueType === type ? 'active' : ''} onClick={() => selectType(type)}><Icon /><span><b>{venueTypeLabel(type)}</b><small>{description}</small></span>{venueType === type && <Check className="venue-type-check" />}</button>)}</div>
        <label className="floorplan-picker"><input hidden type="file" accept="image/png,image/jpeg,image/webp,.pdf,application/pdf" onChange={(event) => setFloorplan(event.target.files?.[0] ?? null)} />{floorplan ? <><FileImage /><span><b>{floorplan.name}</b><small>Ready to use as the source plan</small></span><button type="button" onClick={(event) => { event.preventDefault(); setFloorplan(null) }}>Remove</button></> : <><Upload /><span><b>Add a floor plan</b><small>Optional · PNG, JPG, WebP or PDF</small></span></>}</label>
      </div> : <div className="wizard-step layout-step">
        <div className="layout-summary"><div><span>{venueTypeLabel(venueType)}</span><strong>{estimateCapacity(preview)}</strong><small>estimated seats</small></div><p>You can fine-tune every row in the editor after creating the project.</p></div>
        <div className="wizard-fields"><label>Geometry<select value={layout.geometry} onChange={(event) => setLayout((current) => ({ ...current, geometry: event.target.value as GeometryType }))}><option value="straight">Straight</option><option value="fan">Fan</option><option value="blocks">Blocks</option></select></label><label>Rows<input type="number" min="3" max="24" value={layout.rows} onChange={(event) => setLayout((current) => ({ ...current, rows: Number(event.target.value) }))} /></label><label>Seats per row<input type="number" min="5" max="60" value={layout.seatsPerRow} onChange={(event) => setLayout((current) => ({ ...current, seatsPerRow: Number(event.target.value) }))} /></label><label>Sections<input type="number" min="1" max="3" value={layout.sectors} onChange={(event) => setLayout((current) => ({ ...current, sectors: Number(event.target.value) }))} /></label></div>
        <div className="layout-mini-preview">{Array.from({ length: Math.min(layout.rows, 8) }, (_, row) => <div key={row} style={{ width: `${48 + row * 5}%` }}>{Array.from({ length: Math.min(layout.seatsPerRow, 22) }, (_, seat) => <i key={seat} />)}</div>)}</div>
      </div>}

      <footer>{step === 2 ? <button className="wizard-back" onClick={() => setStep(1)}><ArrowLeft /> Back</button> : <button className="wizard-back" onClick={onClose}>Cancel</button>}<button className="wizard-next" disabled={!name.trim()} onClick={() => step === 1 ? setStep(2) : finish()}>{step === 1 ? <>Continue <ArrowRight /></> : <>Create project <Check /></>}</button></footer>
    </section>
  </div>
}
