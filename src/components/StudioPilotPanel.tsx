import { pilotAvailable, hostedPilot, pilotFetch } from '../lib/pilotApi'
import { loadPilotSession, savePilotSession, type PendingPilotApproval, type PilotDecision, type PilotRun } from '../lib/pilotSession'
import { approvalIsCurrent, evidenceSha256 } from '../lib/ownerApproval'
import { pilotHandover } from '../utils/pilotHandover'
import { downloadViewerFile } from '../utils/customerViewer'
import { LayoutChecksPanel } from './LayoutChecksPanel'
import { briefWithAnswers, pilotSkills } from '../utils/pilotWorkflow'
import { useEffect, useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { ReferenceAnalysisPanel } from './ReferenceAnalysisPanel'
import { reviewedFindings } from '../lib/referenceAnalysis'
import { projectReferences } from '../lib/projectReferences'
import { useVenueStore } from '../store/venueStore'
import type { VenueConfig } from '../types/venue'
import { applyPilotPlan, checkPilotBase, parsePilotPlan, pilotActionLabel, pilotSnapshot } from '../utils/studioPilot'
import { generateSeatLayout } from '../utils/venue'
import { pilotInputStatus } from '../utils/pilotInputs'

const sample = 'Arrange this project as a straight cinema layout with 8 rows and 12 seats in every row, 2 sections, 0.65 m seat spacing, 1 m row spacing, 1 m aisle width, 0.15 m rise per row and zero curve. Set stage width to 9 m and preserve its position. Preserve other settings. Check that there are exactly 96 seats.'
const mze = 'Use these published Kinosál Mže measurements: stage 11 m wide × 4.5 m deep; screen 9 m × 3.8 m; seating starts 2.5 m from the stage; total capacity 259 places including 6 wheelchair places. Source: https://www.mkstc.cz/kinosal-mze.html . The row arrangement, row elevations and room height have not been supplied. Apply only supported dimensions and tell me what you still need. Do not turn wheelchair places into ordinary chairs.'
type Proposal = PendingPilotApproval & { next: VenueConfig }
export function StudioPilotPanel({ projectId, materialsRevision, config, onApplied, onBuild }: { projectId: string; materialsRevision: number; config: VenueConfig; onApplied: () => void; onBuild?: (config: VenueConfig) => Promise<void> }) {
  const [restored] = useState(() => loadPilotSession(projectId))
  const [lastApplied, setLastApplied] = useState<PilotRun | null>(restored.session.lastApplied)
  const [pendingApproval, setPendingApproval] = useState<PendingPilotApproval | null>(restored.session.pendingApproval)
  const [decisions, setDecisions] = useState<PilotDecision[]>(restored.session.decisions)
  const [saveError, setSaveError] = useState(restored.error)
  const [autoReview, setAutoReview] = useState(restored.session.autoReview)
  const [answers, setAnswers] = useState<string[]>([])
  const [building, setBuilding] = useState(false)
  const [brief, setBrief] = useState(restored.session.brief)
  const [allowEstimates, setAllowEstimates] = useState(restored.session.allowEstimates)
  const [includeReferences, setIncludeReferences] = useState(restored.session.includeReferences)
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [connectionError, setConnectionError] = useState('')
  const [inputs, setInputs] = useState<ReturnType<typeof pilotInputStatus> | null>(null)
  const [inputError, setInputError] = useState('')
  const [ready, setReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [analysing, setAnalysing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const proposalRevision = useRef(0)
  const previousMaterialsRevision = useRef(materialsRevision)
  const applying = useRef(false)
  const mounted = useRef(true)
  function clearProposal() { proposalRevision.current++; setProposal(null); setPendingApproval(null) }
  const active = useRef<AbortController | null>(null)
  useEffect(() => {
    if (previousMaterialsRevision.current === materialsRevision) return
    previousMaterialsRevision.current = materialsRevision
    proposalRevision.current++
    setProposal(null)
    setNotice('Saved materials changed. Pilot will use the latest sources in the next proposal.')
  }, [materialsRevision])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const saved = await projectReferences(projectId)
        const accepted = await reviewedFindings(projectId, saved.assets)
        if (cancelled) return
        setInputs(pilotInputStatus(saved, accepted.length))
        setInputError('')
      } catch (reason) { if (!cancelled) setInputError(reason instanceof Error ? reason.message : 'Could not check saved materials.') }
    })()
    return () => { cancelled = true }
  }, [projectId, materialsRevision])
  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    if (pilotAvailable) pilotFetch('/api/pilot/status', { signal: controller.signal }).then(async (response) => {
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pilot connection failed.')
      if (!controller.signal.aborted) { setReady(result.ready === true); setConnectionError('') }
    }).catch((reason) => { if (!controller.signal.aborted) { setReady(false); setConnectionError(reason instanceof Error ? reason.message : 'Pilot connection failed.') } })
    return () => { mounted.current = false; controller.abort(); active.current?.abort() }
  }, [connectionAttempt])
  useEffect(() => {
    const packet = restored.session.pendingApproval
    if (!packet) return
    let cancelled = false
    const revision = proposalRevision.current
    void (async () => {
      try {
        const saved = restored.session.includeReferences ? await projectReferences(projectId) : null
        const references = saved ? JSON.stringify({ notes: saved.notes, measurements: saved.measurements, acceptedFindings: await reviewedFindings(projectId, saved.assets) }) : ''
        const state = useVenueStore.getState()
        if (cancelled || revision !== proposalRevision.current || state.projectId !== projectId) return
        if (!approvalIsCurrent(packet, state.config, await evidenceSha256(references))) {
          if (cancelled || revision !== proposalRevision.current) return
          setPendingApproval(null)
          setNotice('A saved owner approval became stale because the venue or its evidence changed. Generate a fresh proposal.')
          return
        }
        const next = applyPilotPlan(state.config, packet.plan, packet.allowEstimates)
        if (!cancelled && revision === proposalRevision.current) setProposal({ ...packet, next })
      } catch { if (!cancelled && revision === proposalRevision.current) { setPendingApproval(null); setNotice('The saved approval could not be checked. Generate a fresh proposal.') } }
    })()
    return () => { cancelled = true }
  }, [projectId, restored])
  useEffect(() => {
    let message = ''
    try { savePilotSession(projectId, { version: 2, brief, allowEstimates, includeReferences, autoReview, lastApplied, pendingApproval, decisions }) }
    catch { message = 'Pilot draft could not be saved on this device. Copy your brief before leaving. Your venue is unchanged.' }
    const timer = setTimeout(() => setSaveError(message), 0)
    return () => clearTimeout(timer)
  }, [projectId, brief, allowEstimates, includeReferences, autoReview, lastApplied, pendingApproval, decisions])
  async function exportHandover() {
    try {
      const state = useVenueStore.getState()
      const references = await referenceContext()
      if (!mounted.current || state.projectId !== projectId) return
      const report = pilotHandover(state.config, lastApplied, references)
      downloadViewerFile(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }), 'pilot-handover.json')
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not prepare the handover.') }
  }
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
      const response = await pilotFetch('/api/pilot/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ brief: nextBrief, config: state.config, allowEstimates, references, autoReview }) })
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Pilot request failed.')
      const plan = parsePilotPlan(data.plan)
      const next = applyPilotPlan(state.config, plan, allowEstimates)
      if (!controller.signal.aborted) {
        const packet: PendingPilotApproval = { id: crypto.randomUUID(), requestedAt: new Date().toISOString(), brief: nextBrief, plan, base, allowEstimates, evidenceSha256: await evidenceSha256(references), review: data.review }
        if (controller.signal.aborted) return
        setProposal({ ...packet, next })
        if (plan.actions.length) setPendingApproval(packet)
      }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Pilot request failed. Nothing was changed.') }
    finally { if (active.current === controller) { active.current = null; setBusy(false) } }
  }
  async function apply(buildAfter = false) {
    if (!proposal || applying.current) return
    applying.current = true
    let layoutApplied = false
    const revision = proposalRevision.current
    try {
      const references = await referenceContext()
      if (!approvalIsCurrent(proposal, useVenueStore.getState().config, await evidenceSha256(references))) throw new Error('Saved venue or references changed. Generate a fresh proposal.')
      if (!mounted.current || revision !== proposalRevision.current) return
      const current = useVenueStore.getState()
      if (current.projectId !== projectId || current.transactionStart) throw new Error('Finish the current edit and generate a fresh proposal.')
      checkPilotBase(current.config, proposal.base)
      const next = applyPilotPlan(current.config, proposal.plan, proposal.allowEstimates)
      current.setConfig(next); current.selectSeat(null)
      layoutApplied = true
      setLastApplied({ at: new Date().toISOString(), brief: proposal.brief, plan: proposal.plan, snapshot: pilotSnapshot(next), references })
      setDecisions((items) => [...items, { id: proposal.id, at: new Date().toISOString(), decision: 'approved' as const, buildRequested: buildAfter }].slice(-20))
      clearProposal(); setNotice('Applied to your venue. Undo restores the previous layout. Inspect the 3D view, then rebuild Blender architecture if needed.')
      onApplied()
      if (buildAfter && onBuild) {
        setBuilding(true); setNotice("Layout applied. Building architecture below; the layout remains editable if the build fails or is cancelled.")
        await onBuild(next)
        if (mounted.current) setNotice("Layout applied. Check the build result below and inspect representative seat views before sharing.")
      }
    } catch (failure) { if (layoutApplied) setNotice('The layout was applied, but the model build did not finish. Review the Model step and retry the build.'); setError(failure instanceof Error ? failure.message : 'Could not apply this proposal.') }
    finally { applying.current = false; if (mounted.current) setBuilding(false) }
  }
  function rejectProposal() {
    if (!proposal) return
    if (proposal.plan.actions.length) setDecisions((items) => [...items, { id: proposal.id, at: new Date().toISOString(), decision: 'rejected' as const, buildRequested: false }].slice(-20))
    clearProposal()
    setNotice('Proposal declined. The venue has not changed.')
  }
  const stale = proposal !== null && proposal.plan.actions.length > 0 && proposal.base !== pilotSnapshot(config)
  return <section className="control-section studio-pilot" aria-labelledby="pilot-title">
    <h2 id="pilot-title"><Sparkles size={17} /> VenueTwin Pilot <small>{hostedPilot ? 'Hosted beta' : 'Local v1'}</small></h2>
    <p>Describe the venue once. Pilot uses your saved measurements and reviewed source findings to propose Studio changes; you review the proposal, build the model and check its seat views.</p>
    {inputs && <div className="pilot-status" role="status"><strong>Materials ready for Pilot:</strong> {inputs.plans} plan{inputs.plans === 1 ? '' : 's'}, {inputs.photos} photo{inputs.photos === 1 ? '' : 's'}, {inputs.measured} measured dimension{inputs.measured === 1 ? '' : 's'}, {inputs.estimates} estimate{inputs.estimates === 1 ? '' : 's'}, {inputs.reviewedFindings} accepted source finding{inputs.reviewedFindings === 1 ? '' : 's'}. {inputs.missingForSourceDraft.length ? `For a source-informed draft, add ${inputs.missingForSourceDraft.join(' and ')}. A brief alone can produce only a conceptual proposal.` : 'You can request a source-informed draft.'} Seat-by-seat coordinates and owner approval still need separate checks before any accuracy claim.</div>}
    {inputError && <p role="alert">Input check: {inputError}</p>}
    {!pilotAvailable ? <p className="pilot-status">Pilot is not configured on this installation. Contact the operator for access.</p> : <>
      {hostedPilot && <><p role="status">{connectionError || (ready ? 'Pilot is connected.' : 'Checking Pilot access…')}</p><button type="button" disabled={busy || analysing || building} onClick={() => { setReady(null); setConnectionError(''); setConnectionAttempt((value) => value + 1) }}>Check connection after signing in</button></>}
      {!hostedPilot && ready === false && <details className="pilot-setup" open><summary>Connect AI on your computer</summary><p>Add <code>OPENAI_API_KEY</code> and <code>OPENAI_MODEL=gpt-5-mini</code> to <code>.env.local</code>, then restart <code>npm run dev</code>. Use an OpenAI API key, without a VITE_ prefix. Requests use your API account.</p></details>}
      <details className="pilot-options"><summary>Workflow & saved draft</summary><p>Analyse materials → review findings → prepare changes → owner approval → build in Model → inspect Preview & share.</p><p>Your brief and pending owner approval are saved on this device. A saved proposal is restored only when its layout and evidence still match. No API calls run automatically on reopening.</p><p>Handover includes the current layout, Blender blueprint, checks and last applied evidence. It can contain private reference text. Original uploads and the GLB are separate.</p><button type="button" className="button button-secondary" disabled={busy || analysing || building} onClick={() => void exportHandover()}>Download handover report</button>{lastApplied && <small>Last applied: {new Date(lastApplied.at).toLocaleString()}. The report checks whether its layout and references still match.</small>}</details>
      <div className="pilot-status" role="status"><strong>Owner approvals:</strong> {pendingApproval ? '1 prepared proposal awaiting your decision.' : 'No proposal waiting.'} {decisions.length > 0 && `${decisions.filter((item) => item.decision === 'approved').length} approved, ${decisions.filter((item) => item.decision === 'rejected').length} declined on this device.`}</div>
      {saveError && <p role="alert">{saveError}</p>}
      <ReferenceAnalysisPanel projectId={projectId} materialsRevision={materialsRevision} disabled={busy || analysing || building || ready !== true} onBusy={setAnalysing} onChange={() => { clearProposal(); void projectReferences(projectId).then((saved) => reviewedFindings(projectId, saved.assets)).then((accepted) => setInputs((current) => current ? { ...current, reviewedFindings: accepted.length } : current)).catch(() => setInputError('Could not check reviewed findings.')) }} />
      <form onSubmit={(event) => { event.preventDefault(); void generate() }}>
        <label htmlFor="pilot-brief">2. Describe the venue and desired result</label>
        <textarea id="pilot-brief" rows={6} maxLength={12000} required value={brief} disabled={busy || analysing || building} onChange={(event) => { setBrief(event.target.value); clearProposal(); setNotice('') }} placeholder="For example: make row 3 sit 0.4 metres above its level and keep everything else." />
        <details className="pilot-options"><summary>Starting points</summary><div className="pilot-examples">{pilotSkills.map((skill) => <button key={skill.id} type="button" disabled={busy || analysing || building} onClick={() => { setBrief(skill.brief); clearProposal() }}>{skill.title}</button>)}<button type="button" disabled={busy || analysing || building} onClick={() => { setBrief(sample); clearProposal() }}>Example layout</button><button type="button" disabled={busy || analysing || building} onClick={() => { setBrief(mze); clearProposal() }}>Mže measurements</button></div></details>
        <details className="pilot-options"><summary>Sources & estimation settings</summary><label className="pilot-check"><input type="checkbox" checked={includeReferences} disabled={busy || analysing || building} onChange={(event) => { setIncludeReferences(event.target.checked); clearProposal() }} /> Include saved notes, measurements and accepted findings</label>
        <label className="pilot-check"><input type="checkbox" checked={allowEstimates} disabled={busy || analysing || building} onChange={(event) => { setAllowEstimates(event.target.checked); clearProposal() }} /> Allow clearly labelled estimates</label><label className="pilot-check"><input type="checkbox" checked={autoReview} disabled={busy || analysing || building} onChange={(event) => { setAutoReview(event.target.checked); clearProposal() }} /> Check and attempt one correction</label></details>
        <small>{autoReview ? "Up to two paid AI requests per proposal, with at most one correction attempt. " : "One paid AI request per proposal. "}Your brief, current layout and accepted reference findings are sent to OpenAI. Analyse photos and PDFs separately above, then describe the changes you want.</small>
        <button className="button button-primary" disabled={busy || analysing || building || ready !== true || !brief.trim()}>{busy ? 'Planning and checking…' : 'Generate proposal'}</button>
        {busy && <button type="button" className="button button-secondary" onClick={() => { active.current?.abort(); setNotice('Cancelled. Your venue was not changed.') }}>Cancel</button>}
      </form>
      {busy && <p role="status">Pilot is working. Your current venue stays unchanged.</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status" className="pilot-status">{notice}</p>}
      {proposal && <div className="pilot-proposal" aria-label="Proposed venue changes">
        <h3>{proposal.plan.actions.length ? 'Owner approval requested' : 'More information needed'}</h3><p>{proposal.plan.summary}</p>
        {proposal.plan.actions.length > 0 && <p className="pilot-status">Prepared {new Date(proposal.requestedAt).toLocaleString()} for this exact venue and evidence version. Your approval is required before any edits or Blender build.</p>}
        {proposal.review && <p className="pilot-status" role="status">{proposal.review.attempts} AI request{proposal.review.attempts === 1 ? "" : "s"} · {proposal.review.note}</p>}
        <p className="pilot-count">{generateSeatLayout(config).length} → {generateSeatLayout(proposal.next).length} seats · {proposal.plan.actions.length} actions</p>
        <LayoutChecksPanel config={proposal.next} onRepair={(request) => { const nextBrief = `Review the CURRENT layout using my original brief below. The warnings describe an UNAPPLIED proposal; do not assume those edits are already in the current layout.\n\n${brief}\n\nProposed edits (not applied): ${JSON.stringify(proposal.plan.actions)}\n\n${request}`; if (nextBrief.length > 12000) { setError("The fix request is too long. Shorten your brief or address the listed rows in Layout."); return } setBrief(nextBrief); clearProposal(); setNotice("Fix request prepared. Review the brief, then generate a new proposal.") }} />
        <details className="proposal-edits"><summary>Proposed edits · {proposal.plan.actions.length}</summary>{proposal.plan.actions.map((action, index) => <details key={index}><summary>{pilotActionLabel(action)} <span>{action.basis === 'estimated' ? 'Estimate' : 'Provided / existing'}</span></summary><p>{action.source}</p><details><summary>Technical details</summary><pre>{JSON.stringify(action, null, 2)}</pre></details></details>)}</details>
        {proposal.plan.questions.length > 0 && <><h4>Information still needed</h4><ul>{proposal.plan.questions.map((question, index) => <li key={index}><label>{question}<textarea rows={2} maxLength={2000} value={answers[index] ?? ""} onChange={(event) => setAnswers((old) => { const next = [...old]; next[index] = event.target.value; return next })} placeholder="Your answer, measurement or clarification" /></label></li>)}</ul><button type="button" className="button button-secondary" onClick={() => { try { const next = briefWithAnswers(brief, proposal.plan.questions, answers); setBrief(next); void generate(next) } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add answers.") } }}>Generate with my answers</button></>}
        {proposal.plan.limitations.length > 0 && <><h4>Limits of this draft</h4><ul>{proposal.plan.limitations.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        {stale && <p role="alert">Your venue changed. Generate a fresh proposal before applying.</p>}
        {proposal.plan.actions.length > 0 && <button className="button button-secondary" disabled={stale || building} onClick={() => void apply()}>Approve {proposal.plan.actions.length} changes</button>}
        {proposal.plan.actions.length > 0 && onBuild && <button className="button button-primary" disabled={stale || building} onClick={() => void apply(true)}>Approve changes and build</button>}
        <button className="button button-secondary" onClick={rejectProposal}>{proposal.plan.actions.length ? 'Decline proposal' : 'Dismiss questions'}</button>
      </div>}
    </>}
  </section>
}
