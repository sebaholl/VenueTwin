import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { projectReferences } from '../lib/projectReferences'
import { useVenueStore } from '../store/venueStore'
import type { VenueConfig } from '../types/venue'
import { applyPilotPlan, checkPilotBase, parsePilotPlan, pilotActionLabel, type PilotPlan } from '../utils/studioPilot'
import { generateSeatLayout } from '../utils/venue'

const sample = 'Arrange this project as a straight cinema layout with 8 rows and 12 seats in every row, 2 sections, 0.65 m seat spacing, 1 m row spacing, 1 m aisle width, 0.15 m rise per row and zero curve. Set stage width to 9 m and preserve its position. Preserve other settings. Check that there are exactly 96 seats.'
const mze = 'Use these published Kinosál Mže measurements: stage 11 m wide × 4.5 m deep; screen 9 m × 3.8 m; seating starts 2.5 m from the stage; total capacity 259 places including 6 wheelchair places. Source: https://www.mkstc.cz/kinosal-mze.html . The row arrangement, row elevations and room height have not been supplied. Apply only supported dimensions and tell me what you still need. Do not turn wheelchair places into ordinary chairs.'
type Proposal = { plan: PilotPlan; base: string; allowEstimates: boolean; next: VenueConfig }
export function StudioPilotPanel({ projectId, config, onApplied }: { projectId: string; config: VenueConfig; onApplied: () => void }) {
  const [brief, setBrief] = useState('')
  const [allowEstimates, setAllowEstimates] = useState(false)
  const [includeReferences, setIncludeReferences] = useState(true)
  const [ready, setReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    if (import.meta.env.DEV) fetch('/api/pilot/status', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error()
      const result = await response.json(); setReady(result.ready === true)
    }).catch(() => { if (!controller.signal.aborted) setReady(false) })
    return () => { controller.abort(); active.current?.abort() }
  }, [])
  async function generate() {
    const controller = new AbortController(); active.current = controller
    const state = useVenueStore.getState()
    if (state.transactionStart) { setError('Finish your current edit first.'); return }
    const base = JSON.stringify(state.config)
    setBusy(true); setError(''); setNotice(''); setProposal(null)
    try {
      let references = ''
      if (includeReferences) {
        const saved = await projectReferences(projectId)
        references = JSON.stringify({ notes: saved.notes, measurements: saved.measurements })
      }
      if (controller.signal.aborted) return
      const response = await fetch('/api/pilot/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ brief, config: state.config, allowEstimates, references }) })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Pilot request failed.')
      const plan = parsePilotPlan(data.plan)
      const next = applyPilotPlan(state.config, plan, allowEstimates)
      if (!controller.signal.aborted) setProposal({ plan, base, allowEstimates, next })
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Pilot request failed. Nothing was changed.') }
    finally { if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  function apply() {
    if (!proposal) return
    try {
      const current = useVenueStore.getState()
      if (current.projectId !== projectId || current.transactionStart) throw new Error('Finish the current edit and generate a fresh proposal.')
      checkPilotBase(current.config, proposal.base)
      const next = applyPilotPlan(current.config, proposal.plan, proposal.allowEstimates)
      current.setConfig(next); current.selectSeat(null)
      setProposal(null); setNotice('Applied to your venue. Undo restores the previous layout. Inspect the 3D view, then rebuild Blender architecture if needed.')
      onApplied()
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not apply this proposal.') }
  }
  const stale = proposal !== null && proposal.base !== JSON.stringify(config)
  return <section className="control-section studio-pilot" aria-labelledby="pilot-title">
    <h2 id="pilot-title"><Sparkles size={17} /> VenueTwin Pilot <small>Early access</small></h2>
    <p>Describe your venue or an edit. Pilot proposes changes using the Studio tools; you review and apply them.</p>
    {!import.meta.env.DEV ? <p className="pilot-status">Pilot currently runs locally with <code>npm run dev</code>. Online AI hosting is a later step.</p> : <>
      {ready === false && <details className="pilot-setup" open><summary>Connect AI on your computer</summary><p>Add <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL=gpt-5-mini</code> to <code>.env.local</code>, then restart <code>npm run dev</code>. Use an OpenAI API key, without a VITE_ prefix. Requests use your API account.</p></details>}
      <form onSubmit={(event) => { event.preventDefault(); void generate() }}>
        <label htmlFor="pilot-brief">What should we build or change?</label>
        <textarea id="pilot-brief" rows={6} maxLength={12000} required value={brief} disabled={busy} onChange={(event) => { setBrief(event.target.value); setProposal(null); setNotice('') }} placeholder="For example: make row 3 sit 0.4 metres above its level and keep everything else." />
        <div className="pilot-examples"><button type="button" disabled={busy} onClick={() => { setBrief(sample); setProposal(null) }}>Example layout</button><button type="button" disabled={busy} onClick={() => { setBrief(mze); setProposal(null) }}>Mže measurements</button></div>
        <label className="pilot-check"><input type="checkbox" checked={includeReferences} disabled={busy} onChange={(event) => { setIncludeReferences(event.target.checked); setProposal(null) }} /> Include saved reference notes and measurements</label>
        <label className="pilot-check"><input type="checkbox" checked={allowEstimates} disabled={busy} onChange={(event) => { setAllowEstimates(event.target.checked); setProposal(null) }} /> Allow clearly labelled estimates</label>
        <small>Your brief, current layout and selected saved text references are sent to OpenAI. Photos and PDFs are not analysed in this version.</small>
        <button className="button button-primary" disabled={busy || ready !== true || !brief.trim()}>{busy ? 'Preparing and checking changes…' : 'Generate proposal'}</button>
        {busy && <button type="button" className="button button-secondary" onClick={() => { active.current?.abort(); setNotice('Cancelled. Your venue was not changed.') }}>Cancel</button>}
      </form>
      {busy && <p role="status">Pilot is working. Your current venue stays unchanged.</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status" className="pilot-status">{notice}</p>}
      {proposal && <div className="pilot-proposal" aria-label="Proposed venue changes">
        <h3>Review proposal</h3><p>{proposal.plan.summary}</p>
        <p className="pilot-count">{generateSeatLayout(config).length} → {generateSeatLayout(proposal.next).length} seats · {proposal.plan.actions.length} actions</p>
        {proposal.plan.actions.map((action, index) => <details key={index}><summary>{pilotActionLabel(action)} <span>{action.basis === 'estimated' ? 'Estimate' : 'Provided / existing'}</span></summary><p>{action.source}</p><pre>{JSON.stringify(action, null, 2)}</pre></details>)}
        {proposal.plan.questions.length > 0 && <><h4>Information still needed</h4><ul>{proposal.plan.questions.map((question, index) => <li key={index}>{question}</li>)}</ul><p>Add answers to your brief and generate again.</p></>}
        {proposal.plan.limitations.length > 0 && <><h4>Limits of this draft</h4><ul>{proposal.plan.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        {stale && <p role="alert">Your venue changed. Generate a fresh proposal before applying.</p>}
        <button className="button button-primary" disabled={stale || !proposal.plan.actions.length} onClick={apply}>Apply {proposal.plan.actions.length} changes</button>
        <button className="button button-secondary" onClick={() => setProposal(null)}>Discard proposal</button>
      </div>}
    </>}
  </section>
}
