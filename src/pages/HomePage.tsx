import '../home-polish.css'
import { ArrowRight, Box, Eye, Layers3, ScanLine, Sparkles, Upload, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MiniVenue } from '../components/MiniVenue'

const workflow = [
  { icon: Upload, step: '01', title: 'Give Pilot the evidence', text: 'Add plans, photos and measurements with one brief describing the venue.' },
  { icon: ScanLine, step: '02', title: 'Review prepared changes', text: 'Pilot proposes bounded edits, lists missing facts and checks the resulting layout.' },
  { icon: Eye, step: '03', title: 'Approve and inspect', text: 'You approve a saved proposal before it changes Studio or starts a model build. Then inspect seat views.' },
]

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-glow" />
        <div className="eyebrow"><Sparkles size={15} /> Spatial intelligence for venues</div>
        <h1>Every seat,<br /><em>seen before booking.</em></h1>
        <p className="hero-copy">Give Pilot a brief, plans, photos and measurements. It prepares a source-aware proposal for your approval, then Studio builds a model you can inspect seat by seat.</p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/studio">Explore the interactive demo <ArrowRight size={18} /></Link>
          <a className="text-link" href="#workflow">See how it works <ArrowRight size={16} /></a>
        </div>
        <div className="trust-row"><span>Built for</span><b>Cinemas</b><b>Theatres</b><b>Auditoriums</b><b>Live venues</b></div>
        <div className="hero-product"><MiniVenue /></div>
      </section>

      <section className="section problem-section">
        <div className="section-kicker">A clearer way to plan and sell venues</div>
        <div className="split-heading">
          <h2>Floor plans show seats.<br />VenueTwin shows <em>experience.</em></h2>
          <p>Static seating charts cannot answer the question every visitor asks: “What will I actually see?” VenueTwin connects planning, presentation and the seat-level experience.</p>
        </div>
        <div className="feature-grid">
          <article><Box /><h3>Interactive 3D twin</h3><p>Move from a flat plan to a venue you can inspect from every angle.</p></article>
          <article><Layers3 /><h3>Layout intelligence</h3><p>Explore sections, rows, capacity and pricing zones in one model.</p></article>
          <article><WandSparkles /><h3>Fast iteration</h3><p>Compare venue concepts before committing time and budget.</p></article>
        </div>
      </section>

      <section className="section workflow-section" id="workflow">
        <div className="section-kicker light">From evidence to owner approval</div>
        <div className="split-heading light"><h2>Your venue, prepared by Pilot.<br /><em>Approved by you.</em></h2><p>The proposal and evidence version stay together in Studio. If the venue or sources change, Pilot asks for a fresh review before applying the work.</p></div>
        <div className="workflow-grid">
          {workflow.map(({ icon: Icon, step, title, text }) => (
            <article key={step}><span>{step}</span><Icon /><h3>{title}</h3><p>{text}</p></article>
          ))}
        </div>
      </section>

      <section className="section audience-section">
        <div className="audience-copy"><div className="section-kicker">One model, several decisions</div><h2>Designed for the people who shape the venue.</h2><p>Use the same spatial source for internal planning, stakeholder presentations and a future customer-facing seat preview.</p><Link className="button button-dark" to="/studio">Explore the demo <ArrowRight size={18} /></Link></div>
        <div className="audience-list">
          <article><span>01</span><div><h3>Venue operators</h3><p>Review capacity, sections and accessibility in context.</p></div></article>
          <article><span>02</span><div><h3>Commercial teams</h3><p>Connect seat quality to pricing and revenue potential.</p></div></article>
          <article><span>03</span><div><h3>Visitors</h3><p>Choose seats with confidence before checkout.</p></div></article>
        </div>
      </section>

      <section className="cta-section"><div><span>YOUR NEXT VENUE STARTS HERE</span><h2>Build the view<br />before the doors open.</h2><Link className="button button-primary" to="/studio">See VenueTwin in action <ArrowRight size={18} /></Link></div></section>
    </>
  )
}
