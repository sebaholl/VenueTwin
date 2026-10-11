import { LayoutChecksPanel } from './LayoutChecksPanel'
import { briefWithAnswers, reviewedLayoutBrief } from '../utils/pilotWorkflow'
import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ReferenceAnalysisPanel } from './ReferenceAnalysisPanel'
import { reviewedFindings } from '../lib/referenceAnalysis'
import { projectReferences } from '../lib/projectReferences'
import { useVenueStore } from '../store/venueStore'
import type { VenueConfig } from '../types/venue'
import { applyPilotPlan, checkPilotBase, parsePilotPlan, pilotActionLabel, pilotSnapshot, type PilotPlan } from '../utils/studioPilot'
import { generateSeatLayout } from '../utils/venue'

const sample = 'Arrange this project as a straight cinema layout with 8 rows and 12 seats in every row, 2 sections, 0.65 m seat spacing, 1 m row spacing, 1 m aisle width, 0.15 m rise per row and zero curve. Set stage width to 9 m and preserve its position. Preserve other settings. Check that there are exactly 96 seats.'
const mze = 'Use these published Kinosál Mže measurements: stage 11 m wide × 4.5 m deep; screen 9 m × 3.8 m; seating starts 2.5 m from the stage; total capacity 259 places including 6 wheelchair places. Source: https://www.mkstc.cz/kinosal-mze.html . The row arrangement, row elevations and room height have not been supplied. Apply only supported dimensions and tell me what you still need. Do not turn wheelchair places into ordinary chairs.'
type Proposal = { plan: PilotPlan; base: string; allowEstimates: boolean; next: VenueConfig; references: string }
export function StudioPilotPanel({ projectId, config, onApplied, onBuild }: { projectId: string; config: VenueConfig; onApplied: () => void; onBuild?: (config: VenueConfig) => Promise<void> }) {
  const [answers, setAnswers] = useState<string[]>([])
  const [building, setBuilding] = useState(false)
  const [brief, setBrief] = useState('')
  const [allowEstimates, setAllowEstimates] = useState(false)
  const [includeReferences, setIncludeReferences] = useState(true)
  const [ready, setReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const proposalRevision = useRef(0)
  const applying = useRef(false)
  const mounted = useRef(true)
  function clearProposal() { proposalRevision.current++; setProposal(null) }
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    if (import.meta.env.DEV) fetch('/api/pilot/status', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error()
      const result = await response.json(); setReady(result.ready === true)
    }).catch(() => { if (!controller.signal.aborted) setReady(false) })
    return () => { mounted.current = false; controller.abort(); active.current?.abort() }
  }, [])
  async function referenceContext() {
    if (!includeReferences) return ""
    const saved = await projectReferences(projectId)
    return JSON.stringify({ notes: saved.notes, measurements: saved.measurements, acceptedFindings: await reviewedFindings(projectId, saved.assets) })
  }
  async function generate(nextBrief = brief) {
    const controller = new AbortController(); active.current = controller
    const state = useVenueStore.getState()
    if (state.transactionStart) { setError('Finish your current edit first.'); return }
    const base = pilotSnapshot(state.config)
    setAnswers([]); setBusy(true); setError(''); setNotice(''); clearProposal()
    try {
      const references = await referenceContext()
      if (controller.signal.aborted) return
      const response = await fetch('/api/pilot/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ brief: nextBrief, config: state.config, allowEstimates, references }) })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Pilot request failed.')
      const plan = parsePilotPlan(data.plan)
      const next = applyPilotPlan(state.config, plan, allowEstimates)
      if (!controller.signal.aborted) setProposal({ plan, base, allowEstimates, next, references })
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Pilot request failed. Nothing was changed.') }
    finally { if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  async function apply(buildAfter = false) {
    if (!proposal || applying.current) return
    applying.current = true
    const revision = proposalRevision.current
    try {
      if (await referenceContext() !== proposal.references) throw new Error("Saved references changed. Generate a fresh proposal.")
      if (!mounted.current || revision !== proposalRevision.current) return
      const current = useVenueStore.getState()
      if (current.projectId !== projectId || current.transactionStart) throw new Error('Finish the current edit and generate a fresh proposal.')
      checkPilotBase(current.config, proposal.base)
      const next = applyPilotPlan(current.config, proposal.plan, proposal.allowEstimates)
      current.setConfig(next); current.selectSeat(null)
      clearProposal(); setNotice('Applied to your venue. Undo restores the previous layout. Inspect the 3D view, then rebuild Blender architecture if needed.')
      onApplied()
      if (buildAfter && onBuild) {
        setBuilding(true); setNotice("Layout applied. Building architecture below; the layout remains editable if the build fails or is cancelled.")
        await onBuild(next)
        if (mounted.current) setNotice("Layout applied. Check the build result below and inspect representative seat views before sharing.")
      }
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not apply this proposal.') }
    finally { applying.current = false; if (mounted.current) setBuilding(false) }
  }
  const stale = proposal !== null && proposal.plan.actions.length > 0 && proposal.base !== pilotSnapshot(config)
  return <section className="control-section studio-pilot" aria-labelledby="pilot-title">
    <h2 id="pilot-title"><Sparkles size={17} /> VenueTwin Pilot <small>Early access</small></h2>
    <p>Describe your venue or an edit. Pilot proposes changes using the Studio tools; you review and apply them.</p>
    {!import.meta.env.DEV ? <p className="pilot-status">Pilot currently runs locally with <code>npm run dev</code>. Online AI hosting is a later step.</p> : <>
      {ready === false && <details className="pilot-setup" open><summary>Connect AI on your computer</summary><p>Add <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL=gpt-5-mini</code> to <code>.env.local</code>, then restart <code>npm run dev</code>. Use an OpenAI API key, without a VITE_ prefix. Requests use your API account.</p></details>}
      <ReferenceAnalysisPanel projectId={projectId} disabled={busy || analysing || building || ready !== true} onBusy={setAnalysing} onChange={() => clearProposal()} />
      <form onSubmit={(event) => { event.preventDefault(); void generate() }}>
        <label htmlFor="pilot-brief">2. Describe the layout</label>
        <textarea id="pilot-brief" rows={6} maxLength={12000} required value={brief} disabled={busy || analysing || building} onChange={(event) => { setBrief(event.target.value); clearProposal(); setNotice('') }} placeholder="For example: make row 3 sit 0.4 metres above its level and keep everything else." />
        <div className="pilot-examples"><button type="button" disabled={busy || analysing || building} onClick={() => { setBrief(reviewedLayoutBrief); clearProposal() }}>Build from reviewed findings</button><button type="button" disabled={busy || analysing || building} onClick={() => { setBrief(sample); clearProposal() }}>Example layout</button><button type="button" disabled={busy || analysing || building} onClick={() => { setBrief(mze); clearProposal() }}>Mže measurements</button></div>
        <label className="pilot-check"><input type="checkbox" checked={includeReferences} disabled={busy || analysing || building} onChange={(event) => { setIncludeReferences(event.target.checked); clearProposal() }} /> Include saved notes, measurements and accepted findings</label>
        <label className="pilot-check"><input type="checkbox" checked={allowEstimates} disabled={busy || analysing || building} onChange={(event) => { setAllowEstimates(event.target.checked); clearProposal() }} /> Allow clearly labelled estimates</label>
        <small>Your brief, current layout and accepted reference findings are sent to OpenAI. Analyse photos and PDFs separately above, then describe the changes you want.</small>
        <button className="button button-primary" disabled={busy || analysing || building || ready !== true || !brief.trim()}>{busy ? 'Preparing and checking changes…' : 'Generate proposal'}</button>
        {busy && <button type="button" className="button button-secondary" onClick={() => { active.current?.abort(); setNotice('Cancelled. Your venue was not changed.') }}>Cancel</button>}
      </form>
      {busy && <p role="status">Pilot is working. Your current venue stays unchanged.</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status" className="pilot-status">{notice}</p>}
      {proposal && <div className="pilot-proposal" aria-label="Proposed venue changes">
        <h3>{proposal.plan.actions.length ? 'Review proposal' : 'More information needed'}</h3><p>{proposal.plan.summary}</p>
        <p className="pilot-count">{generateSeatLayout(config).length} → {generateSeatLayout(proposal.next).length} seats · {proposal.plan.actions.length} actions</p>
        <LayoutChecksPanel config={proposal.next} onRepair={(request) => { const nextBrief = `Review the CURRENT layout using my original brief below. The warnings describe an UNAPPLIED proposal; do not assume those edits are already in the current layout.\n\n${brief}\n\nProposed edits (not applied): ${JSON.stringify(proposal.plan.actions)}\n\n${request}`; if (nextBrief.length > 12000) { setError("The fix request is too long. Shorten your brief or address the listed rows in Layout."); return } setBrief(nextBrief); clearProposal(); setNotice("Fix request prepared. Review the brief, then generate a new proposal.") }} />
        {proposal.plan.actions.map((action, index) => <details key={index}><summary>{pilotActionLabel(action)} <span>{action.basis === 'estimated' ? 'Estimate' : 'Provided / existing'}</span></summary><p>{action.source}</p><pre>{JSON.stringify(action, null, 2)}</pre></details>)}
        {proposal.plan.questions.length > 0 && <><h4>Information still needed</h4><ul>{proposal.plan.questions.map((question, index) => <li key={index}><label>{question}<textarea rows={2} maxLength={2000} value={answers[index] ?? ""} onChange={(event) => setAnswers((old) => { const next = [...old]; next[index] = event.target.value; return next })} placeholder="Your answer, measurement or clarification" /></label></li>)}</ul><button type="button" className="button button-secondary" onClick={() => { try { const next = briefWithAnswers(brief, proposal.plan.questions, answers); setBrief(next); void generate(next) } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add answers.") } }}>Generate with my answers</button></>}
        {proposal.plan.limitations.length > 0 && <><h4>Limits of this draft</h4><ul>{proposal.plan.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        {stale && <p role="alert">Your venue changed. Generate a fresh proposal before applying.</p>}
        {proposal.plan.actions.length > 0 && <button className="button button-primary" disabled={stale || building} onClick={() => void apply()}>Apply {proposal.plan.actions.length} changes</button>}
        {proposal.plan.actions.length > 0 && onBuild && <button className="button button-primary" disabled={stale || building} onClick={() => void apply(true)}>Apply and build 3D model</button>}
        <button className="button button-secondary" onClick={() => clearProposal()}>Discard proposal</button>
      </div>}
    </>}
  </section>
}
