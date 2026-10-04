import { Download, FileJson, FileText, ImageDown, LoaderCircle, X } from 'lucide-react'
import { useState } from 'react'
import type { VenueConfig } from '../types/venue'
import { downloadVenuePlanPng, openVenuePdfReport } from '../utils/projectExport'

type Props = { open: boolean; config: VenueConfig; onClose: () => void; onProjectFile: () => void }

export function ExportProjectDialog({ open, config, onClose, onProjectFile }: Props) {
  const [busy, setBusy] = useState<'png' | 'pdf' | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!open) return null

  const run = async (type: 'png' | 'pdf') => {
    setBusy(type); setError(null)
    try { if (type === 'png') await downloadVenuePlanPng(config); else await openVenuePdfReport(config) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The export could not be created.') }
    finally { setBusy(null) }
  }

  return <div className="export-dialog-overlay" onMouseDown={onClose}><section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" onMouseDown={(event) => event.stopPropagation()}><header><div><Download /><span><small>EXPORT PROJECT</small><h2 id="export-title">Choose an export format</h2></span></div><button onClick={onClose} aria-label="Close export dialog"><X /></button></header><div className="export-options"><button onClick={() => void run('png')} disabled={Boolean(busy)}><ImageDown /><span><b>Seating plan PNG</b><small>High-resolution 1800 × 1140 image for presentations and email.</small></span>{busy === 'png' && <LoaderCircle className="spin-icon" />}</button><button onClick={() => void run('pdf')} disabled={Boolean(busy)}><FileText /><span><b>Project PDF report</b><small>Print-ready A4 summary with plan, capacity and venue settings.</small></span>{busy === 'pdf' && <LoaderCircle className="spin-icon" />}</button><button onClick={onProjectFile}><FileJson /><span><b>VenueTwin project file</b><small>Editable JSON backup that can be imported into VenueTwin later.</small></span></button>{error && <p>{error}</p>}</div></section></div>
}
