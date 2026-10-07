import { SeatNumberingNote } from './SeatNumberingNote'
import { getRowLabel } from '../utils/venue'
import type { SeatRef, VenueConfig } from '../types/venue'

export function SeatingLevelsPanel({ config, selectedSeat, onChange }: { config: VenueConfig; selectedSeat: SeatRef | null; onChange: (patch: Partial<VenueConfig>) => void }) {
  const levels = config.seatingLevels ?? []
  if (!levels.length) return null
  const row = selectedSeat?.row ?? 0
  const override = config.rowOverrides[row] ?? {}
  const updateRow = (patch: typeof override) => onChange({ rowOverrides: { ...config.rowOverrides, [row]: { ...override, ...patch } } })
  return <section className="control-section category-panel"><h2>Seating levels</h2>{config.studyNotice && <p role="note">{config.studyNotice}</p>}
    {levels.map((level) => <label key={level.id}>{level.name} · base height (m)<input type="number" min="0" max="30" step=".1" value={level.elevation} onChange={(e) => { if (e.target.value) onChange({ seatingLevels: levels.map((l) => l.id === level.id ? { ...l, elevation: Math.max(0, Math.min(30, Number(e.target.value))) } : l) }) }} /></label>)}
    <p>Select a seat in 3D or in Seat categories to edit its row. Current row: {getRowLabel(config, row)}.</p>
    <SeatNumberingNote config={config} row={row} />
    <label>Row level<select value={override.levelId ?? levels[0].id} onChange={(e) => updateRow({ levelId: e.target.value })}>{levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Row rise above level (m)<input type="number" min="0" max="10" step=".05" value={override.elevation ?? 0} onChange={(e) => updateRow({ elevation: Math.max(0, Math.min(10, Number(e.target.value))) })} /></label>
    {override.arcRadius && <><label>Arc radius (m)<input type="number" min="2" max="30" step=".1" value={override.arcRadius} onChange={(e) => updateRow({ arcRadius: Math.max(2, Math.min(30, Number(e.target.value))) })} /></label><label>Arc span (degrees)<input type="number" min="10" max="175" value={override.arcDegrees ?? 140} onChange={(e) => updateRow({ arcDegrees: Math.max(10, Math.min(175, Number(e.target.value))) })} /></label></>}
    <small>Changing height affects cameras and generated balconies. Rebuild any imported Blender model after edits. Upper-tier study labels are placeholders.</small>
  </section>
}
