import { useMemo } from 'react'
import type { VenueConfig } from '../types/venue'
import { layoutChecks, layoutRepairBrief } from '../utils/layoutChecks'
export function LayoutChecksPanel({ config, onRepair }: { config: VenueConfig; onRepair?: (brief: string) => void }) {
  const findings = useMemo(() => layoutChecks(config), [config])
  const warnings = findings.filter((f) => f.severity === 'warning')
  return <div className="pilot-status"><h3>Layout checks</h3>
    <p>{warnings.length ? `${warnings.length} geometry checks need a closer look.` : 'No seat or stage intersections detected by these checks.'}</p>
    {findings.map((f) => <details key={f.id}><summary>{f.title}{f.count ? ` · ${f.count}` : ''}</summary><p>{f.detail}</p>{f.examples?.length ? <p>Examples: {f.examples.join(', ')}{(f.count ?? 0) > f.examples.length ? '…' : ''}</p> : null}</details>)}
    <small>Approximate Studio geometry only. These checks do not verify source accuracy, imported model details, sightlines, accessibility or safety clearances. They do not block draft builds.</small>
    {onRepair && warnings.length > 0 && <button type="button" className="button button-secondary" onClick={() => onRepair(layoutRepairBrief(findings))}>Prepare a Pilot fix request</button>}
  </div>
}
