import { Check, Copy, ExternalLink, Link2, LoaderCircle, Lock, X } from 'lucide-react'
import { useState } from 'react'

type Props = {
  open: boolean
  projectName: string
  sessionAvailable: boolean
  token: string | null
  busy: boolean
  error: string | null
  onClose: () => void
  onEnable: () => void
  onDisable: () => void
  onOpenCloud: () => void
}

export function ShareProjectDialog({ open, projectName, sessionAvailable, token, busy, error, onClose, onEnable, onDisable, onOpenCloud }: Props) {
  const [copied, setCopied] = useState(false)
  if (!open) return null
  const shareUrl = token ? `${window.location.origin}/share/${token}` : ''
  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  return <div className="share-dialog-overlay" onMouseDown={onClose}><section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
    <header><div><Link2 /><span><small>PUBLIC PREVIEW</small><h2 id="share-dialog-title">Share “{projectName}”</h2></span></div><button onClick={onClose} aria-label="Close share dialog"><X /></button></header>
    {!sessionAvailable ? <div className="share-dialog-empty"><Lock /><h3>Cloud sign-in required</h3><p>Public previews use your Supabase project so the link can be securely enabled or disabled.</p><button onClick={onOpenCloud}>Open cloud sign-in</button></div> : token ? <div className="share-dialog-content"><div className="share-live"><i /><span><b>Public preview is live</b><small>Anyone with this link can view the read-only venue.</small></span></div><label>Share link<div><input readOnly value={shareUrl} /><button onClick={() => void copyLink()}>{copied ? <Check /> : <Copy />}{copied ? 'Copied' : 'Copy'}</button></div></label><a href={shareUrl} target="_blank" rel="noreferrer"><ExternalLink /> Open public preview</a>{error && <p className="share-error">{error}</p>}<button className="disable-share" disabled={busy} onClick={onDisable}>{busy && <LoaderCircle className="spin-icon" />} Disable public link</button></div> : <div className="share-dialog-empty"><Link2 /><h3>Create a read-only preview</h3><p>Your latest project configuration will be saved to the cloud first. Visitors cannot edit or access your dashboard.</p>{error && <p className="share-error">{error}</p>}<button disabled={busy} onClick={onEnable}>{busy && <LoaderCircle className="spin-icon" />} Enable public link</button></div>}
  </section></div>
}
