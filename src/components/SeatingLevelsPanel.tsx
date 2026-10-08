import { rowHasFrontRailing } from '../utils/levelGeometry'
import { useEffect, useState } from 'react'
import { SeatNumberingNote } from './SeatNumberingNote'
import { getRowLabel } from '../utils/venue'
import { assignRowRange, removeSeatingLevel, saveSeatingLevel } from '../utils/levelManagement'
import type { SeatRef, VenueConfig } from '../types/venue'
type Level = NonNullable<VenueConfig['seatingLevels']>[number]

function LevelForm({ level, count, onSave, onRemove }: { level: Level; count: number; onSave: (level: Level) => void; onRemove: () => void }) {
  const [name, setName] = useState(level.name), [height, setHeight] = useState(String(level.elevation)), [parapet, setParapet] = useState(String(level.parapetHeight ?? .8))
  const [confirm, setConfirm] = useState(false)
  const valid = !!name.trim() && height.trim() !== '' && Number.isFinite(Number(height)) && Number(height) >= 0 && Number(height) <= 100 && parapet.trim() !== '' && Number.isFinite(Number(parapet)) && Number(parapet) >= .2 && Number(parapet) <= 2
  return <details className="level-card"><summary>{level.name} · {count} rows · {level.elevation} m</summary>
    <label>Level name<input maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
    <label>Base height (m)<input type="number" min="0" max="100" step=".1" value={height} onChange={(event) => setHeight(event.target.value)} /></label>
    <label>Balcony railing height (m)<input type="number" min=".2" max="2" step=".05" value={parapet} onChange={(event) => setParapet(event.target.value)} /></label>
    <button disabled={!valid} onClick={() => onSave({ ...level, name, elevation: Number(height), parapetHeight: Number(parapet) })}>Apply level changes</button>
    <button onClick={() => setConfirm(!confirm)}>{confirm ? 'Cancel removal' : 'Remove level…'}</button>
    {confirm && <div className="workflow-note"><p>{count} rows will move to “Other seats” (or Main floor if no levels remain). Their seats and absolute heights are preserved.</p><button onClick={onRemove}>Confirm removal</button></div>}
  </details>
}

export function SeatingLevelsPanel({ config, selectedSeat, onChange }: { config: VenueConfig; selectedSeat: SeatRef | null; onChange: (patch: Partial<VenueConfig>) => void }) {
  const levels = config.seatingLevels ?? []
  const [rowChoice, setRow] = useState(selectedSeat?.row ?? 0)
  const row = Math.min(rowChoice, config.rows - 1)
  const [lastChoice, setLast] = useState(row)
  const last = Math.max(row, Math.min(lastChoice, config.rows - 1))
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => { if (selectedSeat) setRow(selectedSeat.row) }, [selectedSeat])
  const override = config.rowOverrides[row] ?? {}
  const perform = (action: () => VenueConfig, feedback: string) => {
    try { const next = action(); onChange(next); setError(''); setMessage(feedback) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'The level change could not be applied.'); setMessage('') }
  }
  const updateRow = (patch: typeof override) => onChange({ rowOverrides: { ...config.rowOverrides, [row]: { ...override, ...patch } } })
  return <section className="control-section category-panel level-management"><h2>Seating levels</h2>
    <p className="workflow-hint">Create levels, then assign existing rows. A level does not create new seats. Base height lifts every assigned row; row rise adds to that height.</p>
    {error && <p role="alert">{error} If ticket row names collide, keep those rows on separate levels.</p>}{message && <p role="status">{message}</p>}
    {levels.map((level) => <LevelForm key={JSON.stringify(level)} level={level} count={Array.from({ length: config.rows }, (_, index) => config.rowOverrides[index]?.levelId).filter((id) => id === level.id).length} onSave={(next) => perform(() => saveSeatingLevel(config, next), 'Level updated.')} onRemove={() => perform(() => removeSeatingLevel(config, level.id), 'Level removed; seats and heights preserved.')} />)}
    <button disabled={levels.length >= 30} onClick={() => { let index = levels.length + 1; while (levels.some((level) => level.name.toLowerCase() === `level ${index}`)) index++; perform(() => saveSeatingLevel(config, { id: crypto.randomUUID(), name: `Level ${index}`, elevation: 0, parapetHeight: .8 }), 'Level added. Set its name and height, then assign rows below.') }}>Add seating level</button>
    {!levels.length && <p>All rows currently belong to the main floor.</p>}
    <details open><summary>Assign rows</summary>
      <label>First / current row<select value={row} onChange={(event) => { setRow(Number(event.target.value)); setLast(Number(event.target.value)) }}>{Array.from({ length: config.rows }, (_, index) => <option key={index} value={index}>{getRowLabel(config, index)} · {levels.find((level) => level.id === config.rowOverrides[index]?.levelId)?.name ?? 'Main floor / unassigned'}</option>)}</select></label>
      <label>Last row<select value={last} onChange={(event) => setLast(Number(event.target.value))}>{Array.from({ length: config.rows - row }, (_, index) => index + row).map((index) => <option key={index} value={index}>{getRowLabel(config, index)}</option>)}</select></label>
      <label>Move to level<select value={levels.some((level) => level.id === target) ? target : ''} onChange={(event) => setTarget(event.target.value)}><option value="">Main floor / unassigned</option>{levels.map((level) => <option key={level.id} value={level.id}>{level.name} · {level.elevation} m</option>)}</select></label>
      <p className="workflow-hint">Assignment keeps each row’s rise and moves it to the target base height. Review the 3D result before continuing.</p>
      <button onClick={() => perform(() => assignRowRange(config, row, last, levels.some((level) => level.id === target) ? target : ''), `${last - row + 1} row(s) assigned.`)}>Apply row assignment</button>
    </details>
    <details><summary>Current row details · {getRowLabel(config, row)}</summary><SeatNumberingNote config={config} row={row} />
      {levels.length > 0 && <label><input type="checkbox" checked={rowHasFrontRailing(config, row)} onChange={(event) => updateRow({ frontRailing: event.target.checked })} /> Front railing for this row</label>}{typeof override.frontRailing === 'boolean' && <button onClick={() => { const next = { ...override }; delete next.frontRailing; onChange({ rowOverrides: { ...config.rowOverrides, [row]: next } }) }}>Use automatic railing</button>}<p className="workflow-hint">Uses the assigned level’s railing height (0.8 m for unassigned rows). Choose the front edge row yourself when a level has several separate sections.</p><label>Row rise above level (m)<input type="number" min="0" max="100" step=".05" value={override.elevation ?? row * config.rake} onChange={(event) => { if (event.target.value && Number.isFinite(Number(event.target.value))) updateRow({ elevation: Math.max(0, Math.min(100, Number(event.target.value))) }) }} /></label>
      {override.arcRadius && <><label>Arc radius (m)<input type="number" min="2" max="30" step=".1" value={override.arcRadius} onChange={(event) => { if (event.target.value) updateRow({ arcRadius: Math.max(2, Math.min(30, Number(event.target.value))) }) }} /></label><label>Arc span (degrees)<input type="number" min="10" max="175" value={override.arcDegrees ?? 140} onChange={(event) => { if (event.target.value) updateRow({ arcDegrees: Math.max(10, Math.min(175, Number(event.target.value))) }) }} /></label></>}
    </details>
    <small>Apply name/height edits before leaving this tool. Changes are undoable. Rebuild imported Blender geometry after physical edits. Generated decks and front railings support straight and arc rows. These are approximate surfaces, not structural or safety assessments.</small>
  </section>
}
