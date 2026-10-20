import { useEffect, useMemo, useState } from 'react'
import type { Group } from 'three'
import type { VenueConfig } from '../types/venue'
import { generateSeatLayout } from '../utils/venue'
import { defaultReviewCamera, offsetSeating, representativeSeats, reviewSources } from '../utils/viewReview'
import { downloadViewerFile, geometrySignature } from '../utils/customerViewer'
import { VenueScene } from './VenueScene'
import '../view-review.css'

export function ViewReview({ config, model, onApply, onClose }: { config: VenueConfig; model: Group | null; onApply: (config: VenueConfig) => void; onClose: () => void }) {
  const [baseline] = useState(() => structuredClone(config))
  const [draft, setDraft] = useState(() => structuredClone(config))
  const [camera, setCamera] = useState(defaultReviewCamera)
  const [sourceIndex, setSourceIndex] = useState(0)
  const [imageUrl, setImageUrl] = useState('')
  const [localUrl, setLocalUrl] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [aspect, setAspect] = useState(4 / 3)
  const [notes, setNotes] = useState('')
  const [locationEvidence, setLocationEvidence] = useState('Unknown: no verified row / seat or camera height in this source.')
  const [message, setMessage] = useState('')
  const [before, setBefore] = useState(false)
  const [setback, setSetback] = useState(0)
  const candidates = useMemo(() => representativeSeats(baseline), [baseline])
  const [seatKey, setSeatKey] = useState(() => { const s = candidates[0]?.seat; return s ? `${s.row}:${s.seat}` : '' })
  const shown = before ? baseline : draft
  const seats = useMemo(() => generateSeatLayout(shown), [shown])
  const selected = seats.find((s) => `${s.row}:${s.seat}` === seatKey) ?? seats[0]
  const levelId = selected && shown.rowOverrides[selected.row]?.levelId
  const level = draft.seatingLevels?.find((l) => l.id === levelId)
  const changed = geometrySignature(draft) !== geometrySignature(baseline)
  const source = reviewSources[sourceIndex]
  useEffect(() => () => { if (localUrl) URL.revokeObjectURL(localUrl) }, [localUrl])
  const updateLevel = (patch: { elevation?: number; parapetHeight?: number }) => setDraft((c) => ({ ...c, seatingLevels: c.seatingLevels?.map((l) => l.id === levelId ? { ...l, ...patch } : l) }))
  const saveReview = () => {
    downloadViewerFile(new Blob([JSON.stringify({ format: 'venuetwin-view-review', version: 1, status: 'unverified', createdAt: new Date().toISOString(), source: { url: photoName ? null : source.url, locationEvidence, localPhoto: photoName || null }, modelSeat: selected, camera, comparisonAspect: aspect, notes, baseline, proposedConfig: draft, warning: 'A visual comparison is not a measured or verified seat view. Reference photograph is not embedded.' }, null, 2)], { type: 'application/json' }), 'venue-view-review.json')
    setMessage('Review record downloaded with camera settings, source and both configurations. Status remains unverified.')
  }
  return <section className="view-review" aria-label="View comparison workspace">
    <header><div><small>VIEW REVIEW · UNVERIFIED</small><h2>Compare before changing geometry</h2></div><button onClick={onClose}>Back to editor</button></header>
    <p>Reference camera locations are unknown. Model viewpoints below are candidates, not matched photo locations. Match framing first; adjust geometry only with supporting evidence.</p>
    <div className="review-images">
      <figure><figcaption>Reference · {photoName || source.name}</figcaption><div className="review-photo" style={{ aspectRatio: aspect }}>{imageUrl ? <img src={imageUrl} alt="Reference auditorium photograph" referrerPolicy="no-referrer" onLoad={(e) => setAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)} onError={() => { setImageUrl(''); setMessage('Image could not load. Open the source link or choose a local photograph.') }} /> : <p>Open a source below or load a reference image.</p>}</div></figure>
      <figure><figcaption>{before ? 'Original geometry' : 'Draft geometry'} · {selected?.label}</figcaption><div className="review-model" style={{ aspectRatio: aspect }}><VenueScene config={shown} selectedSeat={selected ?? null} onSeatSelect={() => {}} importedModel={before || !changed ? model : null} viewMode="seat" reviewCamera={camera} /></div></figure>
    </div>
    {changed && model && !before && <p role="status">Showing generated geometry because the loaded GLB represents the original model. Rebuild it after applying changes.</p>}
    <div className="review-controls">
      <fieldset><legend>1 · Reference and evidence</legend>
        <label>Source<select value={sourceIndex} onChange={(e) => { setSourceIndex(Number(e.target.value)); setImageUrl(''); setLocalUrl(''); setPhotoName(''); setLocationEvidence('Unknown: no verified row / seat or camera height in this source.') }}>{reviewSources.map((s, i) => <option value={i} key={s.url}>{s.name}</option>)}</select></label>
        <p>{source.note}</p><a href={source.url} target="_blank" rel="noreferrer">Open original source ↗</a>
        {source.image && <button onClick={() => { setLocalUrl(''); setPhotoName(''); setImageUrl(source.image) }}>Load official reference photo</button>}
        <label>Or choose a local photograph (session only)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (f.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) { setMessage('Choose a JPG, PNG or WebP under 10 MB.'); return } const url = URL.createObjectURL(f); setLocalUrl(url); setImageUrl(url); setPhotoName(f.name); setLocationEvidence('Local image: enter its source and any evidence for the camera location below.') }} /></label>
        <label>Source / location evidence<textarea value={locationEvidence} maxLength={2000} onChange={(e) => setLocationEvidence(e.target.value)} /></label>
      </fieldset>
      <fieldset><legend>2 · Model camera</legend>
        <div className="review-shortcuts">{candidates.map(({ name, seat }) => <button key={name} onClick={() => { setSeatKey(`${seat.row}:${seat.seat}`); setCamera(defaultReviewCamera) }}>{name}</button>)}</div>
        <label>Model seat<select value={seatKey} onChange={(e) => setSeatKey(e.target.value)}>{seats.map((s) => <option key={`${s.row}:${s.seat}`} value={`${s.row}:${s.seat}`}>{s.label}</option>)}</select></label>
        {([['fov', 'Vertical field of view (°)', 25, 100, 1], ['eyeHeight', 'Eye height above floor (m)', .8, 1.8, .01], ['yaw', 'Look left / right (radians)', -3.14, 3.14, .01], ['pitch', 'Look up / down (radians)', -1, 1, .01]] as const).map(([key, label, min, max, step]) => <label key={key}>{label} · {camera[key].toFixed(2)}<input type="range" value={camera[key]} min={min} max={max} step={step} onChange={(e) => setCamera((c) => ({ ...c, [key]: Number(e.target.value) }))} /></label>)}
        <button onClick={() => setCamera(defaultReviewCamera)}>Reset camera</button>
        <p>Camera adjustments affect this comparison only. Use the sliders to keep the exported settings reproducible.</p>
      </fieldset>
      <fieldset><legend>3 · Geometry draft</legend>
        <label>Move all seating away from stage (m) · {setback.toFixed(2)}<input type="range" min={-2} max={5} step={.05} value={setback} onChange={(e) => { const next = Number(e.target.value); setDraft((c) => offsetSeating(c, next - setback)); setSetback(next) }} /></label>
        {level && <><label>{level.name} · base height (m)<input type="number" min={0} max={30} step={.05} value={level.elevation} onChange={(e) => { if (e.target.value && Number.isFinite(e.target.valueAsNumber)) updateLevel({ elevation: Math.max(0, Math.min(30, e.target.valueAsNumber)) }) }} /></label><label>Balcony parapet body height (m)<input type="number" min={.2} max={2} step={.05} value={level.parapetHeight ?? .8} disabled={!shown.rowOverrides[selected.row]?.arcRadius} onChange={(e) => { if (e.target.value && Number.isFinite(e.target.valueAsNumber)) updateLevel({ parapetHeight: Math.max(.2, Math.min(2, e.target.valueAsNumber)) }) }} /></label></>}
        <label><input type="checkbox" checked={before} onChange={(e) => setBefore(e.target.checked)} /> Show original geometry for comparison</label>
        <button onClick={() => { setDraft(structuredClone(baseline)); setSetback(0); setBefore(false) }}>Reset geometry draft</button>
        <p>No geometry is changed in your project until you apply the draft. Decorative trim can extend above the parapet body.</p>
      </fieldset>
    </div>
    <label>Review notes: stage edges, balcony line, rail occlusion and unresolved differences<textarea value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} /></label>
    <footer><button onClick={saveReview}>Download review record</button><button disabled={!changed} onClick={() => { if (JSON.stringify(config) !== JSON.stringify(baseline)) { setMessage('The project changed outside this review. Reopen Review views before applying a draft.'); return } onApply(draft); onClose() }}>Apply geometry draft · remains unverified</button></footer>
    <p role="status">{message}</p>
  </section>
}
