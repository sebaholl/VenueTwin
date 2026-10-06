import { useState } from 'react'
import { Eye } from 'lucide-react'
import type { VenueConfig } from '../types/venue'
import { geometrySignature, parseViewerConfig } from '../utils/customerViewer'
import { saveViewerSnapshot } from '../lib/viewerStorage'
import '../viewer.css'

export function CustomerPreviewButton({ config, source }: { config: VenueConfig; source: { file: File; signature: string } | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const prepare = async () => {
    setBusy(true); setError(''); setReady(false)
    // Open on the user gesture, before IndexedDB work, to avoid popup blocking.
    let tab: Window | null = null
    try {
      const validated = parseViewerConfig(config)
      if (source && source.signature !== geometrySignature(validated)) throw new Error('Geometry changed after loading the model. Rebuild and reload your GLB, or remove it to preview the generated geometry.')
      tab = window.open('about:blank', '_blank')
      if (tab) { tab.opener = null; tab.document.title = 'Preparing venue preview…' }
      await saveViewerSnapshot({ config: validated, model: source?.file ?? null, createdAt: new Date().toISOString() })
      if (tab) tab.location.replace(`${location.origin}/viewer`)
      else setReady(true)
    } catch (reason) { tab?.close(); setError(reason instanceof Error ? reason.message : 'Could not prepare the customer preview.') }
    finally { setBusy(false) }
  }
  return <div className="customer-preview-action"><button className="button button-ghost button-small" disabled={busy} onClick={() => void prepare()}><Eye size={16} />{busy ? 'Preparing…' : 'Customer preview'}</button>
    {error && <p role="alert">{error}</p>}
    {ready && <a href="/viewer" target="_blank" rel="noreferrer">Open prepared preview</a>}
  </div>
}
