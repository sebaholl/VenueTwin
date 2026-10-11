import { useEffect, useRef, useState } from 'react'
import { projectReferences, type ReferenceAsset } from '../lib/projectReferences'
import { fileData, loadAnalysis, saveAnalysis, sourceFor } from '../lib/referenceAnalysis'
import { parseReferenceAnalysis, type AnalysisRecord } from '../utils/referenceAnalysis'
export function ReferenceAnalysisPanel({ projectId, disabled, onChange, onBusy }: { projectId: string; disabled: boolean; onChange: () => void; onBusy: (busy: boolean) => void }) {
  const [assets, setAssets] = useState<ReferenceAsset[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [report, setReport] = useState<AnalysisRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const active = useRef<AbortController | null>(null)
  useEffect(() => { try { setReport(loadAnalysis(projectId)) } catch { setMessage('Saved analysis could not be read. Please analyse again.') } return () => { active.current?.abort() } }, [projectId])
  async function refresh() {
    try { const saved = await projectReferences(projectId); setAssets(saved.assets); setSelected([]); setMessage('Saved files refreshed. Select the sources to analyse.') } catch (e) { setMessage(String(e)) }
  }
  async function analyse() {
    const controller = new AbortController(); active.current = controller
    setBusy(true); onBusy(true); setMessage('Reading selected files…')
    try {
      const saved = await projectReferences(projectId)
      const files = saved.assets.filter((a) => selected.includes(a.id))
      if (!files.length || files.length !== selected.length || files.length > 4 || files.reduce((n, a) => n + a.file.size, 0) > 12 * 1024 * 1024) throw new Error('Select 1–4 saved files, up to 12 MB combined.')
      const sources = await Promise.all(files.map(sourceFor))
      const input = await Promise.all(files.map(async (a) => ({ id: a.id, name: a.name, caption: a.caption, mime: a.file.type, data: await fileData(a.file) })))
      if (controller.signal.aborted) return
      setMessage('Analysing sources. Your venue stays unchanged…')
      const response = await fetch('/api/pilot/analyse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ files: input }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Analysis failed.')
      const next = { analysis: parseReferenceAnalysis(data.analysis, sources), sources, accepted: [] }
      if (controller.signal.aborted) return
      saveAnalysis(projectId, next); setReport(next); onChange(); setMessage('Review each finding against its source before accepting it. Review is saved on this browser.')
    } catch (e) { if (!controller.signal.aborted) setMessage(e instanceof Error ? e.message : 'Analysis failed.') }
    finally { active.current = null; setBusy(false); onBusy(false) }
  }
  function toggle(index: number) {
    if (!report) return
    const next = { ...report, accepted: report.accepted.includes(index) ? report.accepted.filter((i) => i !== index) : [...report.accepted, index] }
    try { saveAnalysis(projectId, next); setReport(next); onChange() } catch { setMessage('Review could not be saved. Check browser storage.') }
  }
  return <details className="pilot-setup"><summary>1. Analyse plans and photos</summary>
    <p>Add and save files in Venue references, then refresh this list. Analysis sends selected files and captions to OpenAI using your paid API account. Up to 4 files / 12 MB per request.</p>
    <button type="button" disabled={busy || disabled} onClick={() => void refresh()}>Refresh saved files</button>
    {assets.map((a) => <label className="pilot-check" key={a.id}><input type="checkbox" disabled={busy || disabled} checked={selected.includes(a.id)} onChange={() => setSelected(selected.includes(a.id) ? selected.filter((id) => id !== a.id) : [...selected, a.id])} />{a.name}</label>)}
    <button type="button" className="button button-secondary" disabled={busy || disabled || !selected.length || selected.length > 4} onClick={() => void analyse()}>Analyse selected files</button>
    {busy && <button type="button" onClick={() => { active.current?.abort(); setMessage('Cancelled. Your previous review is unchanged.') }}>Cancel analysis</button>}
    {message && <p role="status">{message}</p>}
    {report && <div><h3>Review extracted findings</h3><p>{report.analysis.summary}</p><p>Accepting a finding does not verify it or edit the venue. Inferred findings still require “Allow clearly labelled estimates”. Changed or removed sources are excluded when generating a proposal.</p>
      {report.analysis.findings.map((f, i) => <details key={i}><summary>{f.label} · {f.basis}</summary><p>{report.sources.find((s) => s.id === f.sourceId)?.name}{f.page ? ` · reported page ${f.page}` : ''} · {f.location}</p><p>{f.statement}</p>{f.value !== null && <p>{f.value} {f.unit === 'none' ? '' : f.unit}</p>}<blockquote>{f.evidence}</blockquote><label className="pilot-check"><input type="checkbox" disabled={busy || disabled || f.basis === 'uncertain'} checked={report.accepted.includes(i)} onChange={() => toggle(i)} />Use this finding in proposals</label></details>)}
      {report.analysis.questions.length > 0 && <><h4>Still needed</h4><ul>{report.analysis.questions.map((q, i) => <li key={i}>{q}</li>)}</ul></>}
    </div>}
  </details>
}
