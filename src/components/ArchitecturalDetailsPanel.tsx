import type { VenueConfig } from '../types/venue'
export function ArchitecturalDetailsPanel({ config, onChange }: { config: VenueConfig; onChange: (patch: Partial<VenueConfig>) => void }) {
  const details = config.architecturalDetails ?? []
  return <details className="pilot-options"><summary>Architectural details · {details.length}</summary>
    <p>Ask Pilot to complete the architecture using reviewed photos and dimensions. Supported details: framed panels, stage surrounds, columns, ceiling coffers and curved balcony fronts.</p>
    <p>These components approximate shapes. Inspect them from seats and compare with your references before delivery. Ceiling coffers hide in overview.</p>
    {details.map((detail) => <details key={detail.id}><summary>{detail.name} · {detail.kind} · {detail.basis === 'estimated' ? 'Estimate' : 'Provided / existing'}</summary>
      <p>{detail.source}</p><p>Position: {detail.x}, {detail.bottom}, {detail.z} m · rotation {detail.rotation}°</p>
      <p>{detail.kind === 'curved-wall' ? `Radius ${detail.radius} m · span ${detail.span}° · height ${detail.height} m · thickness ${detail.depth} m` : `${detail.width} × ${detail.height} × ${detail.depth} m`}</p>
      <button type="button" className="button button-secondary" onClick={() => onChange({ architecturalDetails: details.filter((d) => d.id !== detail.id) })}>Remove {detail.name}</button>
    </details>)}
  </details>
}
