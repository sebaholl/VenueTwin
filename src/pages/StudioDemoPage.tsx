import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, FileText, Ruler, ShieldCheck, Sparkles } from 'lucide-react'
import { Brand } from '../components/Brand'
import { VenueScene } from '../components/VenueScene'
import { createProjectConfig } from '../utils/projectPresets'
import { generateSeatLayout } from '../utils/venue'
import type { SeatRef } from '../types/venue'
import '../studio-demo.css'

const demoConfig = createProjectConfig({ name: 'Theatre concept', venueType: 'theatre', rows: 11, seatsPerRow: 15, sectors: 2 })
const evidence = [
  { icon: FileText, title: 'Venue plan', detail: 'Room, stage and seating layout' },
  { icon: Ruler, title: 'Measurements', detail: 'Dimensions and seat positions' },
  { icon: Eye, title: 'Reference photos', detail: 'Materials and named seat views' },
]
const stages = [
  { number: '01', title: 'Supply evidence', detail: 'Plans, dimensions and photos establish what is known.' },
  { number: '02', title: 'Review proposal', detail: 'Pilot lists proposed changes, sources and missing facts.' },
  { number: '03', title: 'Approve model', detail: 'The owner checks the proposal before any build or sharing.' },
  { number: '04', title: 'Explore seats', detail: 'Visitors can choose a seat and inspect its perspective.' },
]

export function StudioDemoPage() {
  const seats = useMemo(() => generateSeatLayout(demoConfig), [])
  const featured = useMemo(() => [seats.find(seat => seat.row === 1 && seat.seat === 7), seats.find(seat => seat.row === 5 && seat.seat === 7), seats.find(seat => seat.row === 9 && seat.seat === 2)].filter((seat): seat is NonNullable<typeof seat> => !!seat), [seats])
  const [selectedSeat, setSelectedSeat] = useState<SeatRef | null>(featured[1] ?? null)
  const [viewMode, setViewMode] = useState<'overview' | 'seat'>('overview')
  const [sceneReady, setSceneReady] = useState(false)
  const selectSeat = (seat: SeatRef) => { setSelectedSeat(seat); setViewMode('seat') }

  return <div className="studio-demo">
    <header className="demo-header"><Link to="/" aria-label="VenueTwin home"><Brand /></Link><span className="demo-header-tag">INTERACTIVE PRODUCT DEMO</span><Link to="/" className="demo-back"><ArrowLeft size={16} /> Back to site</Link></header>
    <main>
      <section className="demo-intro"><div><span className="demo-eyebrow"><Sparkles size={15} /> VENUE DESIGN, MADE VISIBLE</span><h1>See the venue before anyone takes a seat.</h1><p>VenueTwin turns supplied plans, measurements and photos into a model that an owner can review, refine and share. Explore this fictional theatre to see the experience.</p><div className="demo-intro-actions"><a href="#experience" className="demo-primary">Explore the 3D demo <ArrowRight size={17} /></a><Link to="/service" className="demo-secondary">How the service works</Link></div></div><div className="demo-intro-note"><span>DEMONSTRATION</span><strong>One model. Every perspective.</strong><p>Choose a seat below and move from a venue overview to an approximate seated view.</p></div></section>
      <section className="demo-workflow" aria-label="How VenueTwin works"><div className="demo-section-heading"><span>THE WORKFLOW</span><h2>Prepared by Pilot. Approved by the owner.</h2></div><div className="demo-stage-grid">{stages.map(stage => <article key={stage.number}><span>{stage.number}</span><h3>{stage.title}</h3><p>{stage.detail}</p></article>)}</div></section>
      <section className="demo-experience" id="experience"><div className="demo-experience-heading"><div><span>TRY IT YOURSELF</span><h2>Take a seat in the sample theatre.</h2><p>Select a position, then drag in the 3D view to look around.</p></div><span className="demo-quality">FICTIONAL VENUE · ILLUSTRATIVE VIEWS</span></div>
        <div className="demo-studio-frame"><aside className="demo-sidepanel"><div className="demo-panel-kicker"><span className="demo-live-dot" /> INTERACTIVE STUDIO DEMO</div><h3>Theatre concept</h3><p>A sample layout built to demonstrate the Studio and seat-view workflow.</p><div className="demo-evidence"><strong>A real venue would need</strong>{evidence.map(({ icon: Icon, title, detail }) => <div key={title}><Icon size={17} /><span><b>{title}</b><small>{detail}</small></span></div>)}</div><div className="demo-seat-picker"><strong>Choose a view</strong>{featured.map((seat, index) => <button key={seat.label} type="button" aria-pressed={selectedSeat?.label === seat.label && viewMode === 'seat'} onClick={() => selectSeat(seat)}><span><small>{['NEAR THE STAGE', 'CENTRE VIEW', 'FURTHER BACK'][index]}</small><b>Seat {seat.label}</b></span><ArrowRight size={17} /></button>)}</div><button className="demo-overview" type="button" onClick={() => setViewMode('overview')}>Return to venue overview</button></aside><div className="demo-viewport"><div className="demo-viewport-top"><span>{viewMode === 'seat' && selectedSeat ? `VIEW FROM SEAT ${selectedSeat.label}` : 'VENUE OVERVIEW'}</span><span>{sceneReady ? '3D READY' : 'LOADING 3D'}</span></div><div className="demo-canvas"><VenueScene config={demoConfig} selectedSeat={selectedSeat} onSeatSelect={selectSeat} viewMode={viewMode} onViewModeChange={setViewMode} onReady={() => setSceneReady(true)} customer /></div><div className="demo-viewport-bottom"><span>{viewMode === 'seat' ? 'Drag or use arrow keys to look around. Press Escape to return.' : 'Drag to rotate the venue. Select any seat for its view.'}</span><span>{seats.length} sample seats</span></div></div></div>
        <p className="demo-truth"><ShieldCheck size={16} /> This is a fictional sample. Its dimensions and views are illustrative; it does not demonstrate a measured or certified 1:1 replica. A real venue requires supplied measurements, reference photos and owner-reviewed views.</p>
      </section>
      <section className="demo-close"><div><span>YOUR VENUE, NEXT</span><h2>See what your own evidence can become.</h2><p>VenueTwin can prepare a venue study from your plans, photos and measurements for your review.</p></div><a href="mailto:venuetwin@gmail.com?subject=VenueTwin%20venue%20demo" className="demo-primary">Discuss your venue <ArrowRight size={17} /></a></section>
    </main>
  </div>
}
