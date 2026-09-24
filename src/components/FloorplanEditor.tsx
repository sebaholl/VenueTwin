import { Copy, Crosshair, Minus, MoveHorizontal, MoveVertical, Plus, RotateCcw, RotateCw, Ruler, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlanPoint, RowOverride, VenueConfig } from '../types/venue'
import { generateAutoLayout, type AutoLayoutResult } from '../utils/autoLayout'
import { getRowSeats } from '../utils/venue'

type FloorplanEditorProps = {
  config: VenueConfig
  imageUrl: string | null
  fileName: string | null
  onConfigChange: (patch: Partial<VenueConfig>) => void
  onBeginEdit: () => void
  onCommitEdit: () => void
}

const rowLabel = (row: number) => String.fromCharCode(65 + row)
const round = (value: number) => Math.round(value * 10) / 10

function BoundaryOverlay({ points, drawing }: { points: PlanPoint[]; drawing: boolean }) {
  const safePoints = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
  if (!safePoints.length) return null

  const serialized = safePoints.map((point) => `${point.x},${point.y}`).join(' ')

  return <g className={`plan-boundary ${drawing ? 'drawing' : ''}`}>
    {safePoints.length >= 3 ? <polygon points={serialized} /> : <polyline points={serialized} />}
    {safePoints.map((point, index) => <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="7" />)}
  </g>
}

export function FloorplanEditor({ config, imageUrl, fileName, onConfigChange, onBeginEdit, onCommitEdit }: FloorplanEditorProps) {
  const [selectedRow, setSelectedRow] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationPoints, setCalibrationPoints] = useState<PlanPoint[]>([])
  const [knownDistance, setKnownDistance] = useState(10)
  const [autoOpen, setAutoOpen] = useState(false)
  const [drawingBoundary, setDrawingBoundary] = useState(false)
  const [boundaryDraft, setBoundaryDraft] = useState<PlanPoint[]>([])
  const [preview, setPreview] = useState<AutoLayoutResult | null>(null)
  const rowDrag = useRef<{ row: number; startX: number; startY: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const stageDrag = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)

  const displayConfig = useMemo(() => preview ? { ...config, rows: preview.rows, geometry: 'straight' as const, rowOverrides: preview.rowOverrides } : config, [config, preview])
  const rowGap = Math.min(34, 350 / Math.max(displayConfig.rows - 1, 1))
  const rows = useMemo(() => Array.from({ length: displayConfig.rows }, (_, row) => ({ row, seats: getRowSeats(displayConfig, row) })), [displayConfig])
  const selectedOverride = config.rowOverrides?.[selectedRow] ?? {}
  const selectedSeats = getRowSeats(config, selectedRow)
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const visibleBoundary = drawingBoundary ? boundaryDraft : (config.planBoundary ?? [])

  useEffect(() => { if (selectedRow >= config.rows) setSelectedRow(Math.max(0, config.rows - 1)) }, [config.rows, selectedRow])

  const updateRow = (row: number, patch: Partial<RowOverride>) => onConfigChange({ rowOverrides: { ...(config.rowOverrides ?? {}), [row]: { ...(config.rowOverrides?.[row] ?? {}), ...patch } } })
  const resetRow = () => { const next = { ...(config.rowOverrides ?? {}) }; delete next[selectedRow]; onConfigChange({ rowOverrides: next }) }
  const addRow = (duplicate = false) => {
    if (config.rows >= 24) return
    const insertAt = selectedRow + 1
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) { const override = config.rowOverrides?.[row]; if (override) next[row < insertAt ? row : row + 1] = override }
    if (duplicate) next[insertAt] = { ...selectedOverride, offsetY: (selectedOverride.offsetY ?? 0) + (config.rowSpacing ?? .92) }
    onConfigChange({ rows: config.rows + 1, rowOverrides: next }); setSelectedRow(insertAt)
  }
  const deleteRow = () => {
    if (config.rows <= 3) return
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) { if (row === selectedRow) continue; const override = config.rowOverrides?.[row]; if (override) next[row < selectedRow ? row : row - 1] = override }
    onConfigChange({ rows: config.rows - 1, rowOverrides: next }); setSelectedRow(Math.min(selectedRow, config.rows - 2))
  }
  const canvasPoint = (event: ReactPointerEvent<SVGSVGElement>): PlanPoint | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width || !rect.height) return null
    const point = { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 620 }
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? point : null
  }
  const handleCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = canvasPoint(event)
    if (!point) return
    if (calibrating) setCalibrationPoints((current) => [...current, point].slice(-2))
    else if (drawingBoundary) setBoundaryDraft((current) => [...current, point])
  }
  const applyCalibration = () => {
    if (calibrationPoints.length !== 2) return
    const pixels = Math.hypot(calibrationPoints[1].x - calibrationPoints[0].x, calibrationPoints[1].y - calibrationPoints[0].y)
    onConfigChange({ calibration: { meters: knownDistance, pixels } }); setCalibrating(false)
  }
  const finishBoundary = () => {
    if (boundaryDraft.length < 3) return
    onConfigChange({ planBoundary: boundaryDraft }); setDrawingBoundary(false); setPreview(null)
  }
  const createPreview = () => {
    const result = generateAutoLayout(config, visibleBoundary)
    if (result.rows) { setPreview(result); setSelectedRow(0) }
  }
  const applyPreview = () => {
    if (!preview) return
    onConfigChange({ rows: preview.rows, rowOverrides: preview.rowOverrides, geometry: 'straight' }); setPreview(null); setAutoOpen(false)
  }
  const startRowDrag = (event: ReactPointerEvent<SVGGElement>, row: number) => {
    if (calibrating || drawingBoundary || preview) return
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedRow(row); onBeginEdit()
    rowDrag.current = { row, startX: event.clientX, startY: event.clientY, offsetX: config.rowOverrides?.[row]?.offsetX ?? 0, offsetY: config.rowOverrides?.[row]?.offsetY ?? 0, width: rect.width, height: rect.height }
  }
  const moveRowDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!rowDrag.current) return
    const deltaX = ((event.clientX - rowDrag.current.startX) / rowDrag.current.width) * 1000 / 24
    const deltaY = ((event.clientY - rowDrag.current.startY) / rowDrag.current.height) * 620 / 24
    updateRow(rowDrag.current.row, { offsetX: round(rowDrag.current.offsetX + deltaX), offsetY: round(rowDrag.current.offsetY + deltaY) })
  }
  const endRowDrag = () => { if (rowDrag.current) onCommitEdit(); rowDrag.current = null }
  const startStageDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (calibrating || drawingBoundary || preview) return
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const rect = svg.getBoundingClientRect(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onBeginEdit()
    stageDrag.current = { startX: event.clientX, startY: event.clientY, offsetX: stage.offsetX, offsetY: stage.offsetY, width: rect.width, height: rect.height }
  }
  const moveStageDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!stageDrag.current) return
    const deltaX = ((event.clientX - stageDrag.current.startX) / stageDrag.current.width) * 1000 / 24
    const deltaY = ((event.clientY - stageDrag.current.startY) / stageDrag.current.height) * 620 / 24
    onConfigChange({ stagePosition: { ...stage, offsetX: round(stageDrag.current.offsetX + deltaX), offsetY: round(stageDrag.current.offsetY + deltaY) } })
  }
  const endStageDrag = () => { if (stageDrag.current) onCommitEdit(); stageDrag.current = null }

  return <div className="plan-editor">
    <div className="plan-toolbar"><div><strong>Floor plan editor</strong><span>{fileName ?? 'Draw a boundary or edit rows manually'}</span></div><div>{config.calibration && <span className="scale-chip">1 px = {(config.calibration.meters / config.calibration.pixels).toFixed(3)} m</span>}<button className={autoOpen ? 'active' : ''} onClick={() => { setAutoOpen((value) => !value); setCalibrating(false) }}><Sparkles size={15} /> Auto layout</button><button className={calibrating ? 'active' : ''} onClick={() => { setCalibrating((value) => !value); setCalibrationPoints([]); setDrawingBoundary(false) }}><Ruler size={15} /> Calibrate</button></div></div>
    <div className="plan-canvas">
      {imageUrl && <img src={imageUrl} alt="Uploaded venue floor plan" />}{!imageUrl && <div className="plan-grid" />}
      <svg viewBox="0 0 1000 620" onPointerDown={handleCanvasPointerDown}>
        <BoundaryOverlay points={visibleBoundary} drawing={drawingBoundary} />
        <g className="plan-stage draggable" transform={`translate(${500 + stage.offsetX * 24}, ${76 + stage.offsetY * 24}) rotate(${stage.rotation})`} onPointerDown={startStageDrag} onPointerMove={moveStageDrag} onPointerUp={endStageDrag} onPointerCancel={endStageDrag}><rect x={-(150 + config.stageWidth * 10)} y="-34" width={300 + config.stageWidth * 20} height="68" rx="7" /><text x="0" y="6">STAGE · {config.stageWidth} M</text></g>
        {rows.map(({ row, seats }) => {
          const override = displayConfig.rowOverrides?.[row]; const spacing = (displayConfig.seatSpacing ?? .72) * 24; const aisle = (displayConfig.aisleWidth ?? .9) * 24; const sections = Math.max(1, displayConfig.sectors)
          const seatPositions = Array.from({ length: seats }, (_, seat) => { const section = Math.min(sections - 1, Math.floor((seat * sections) / seats)); return (seat - (seats - 1) / 2) * spacing + (section - (sections - 1) / 2) * aisle })
          const minX = Math.min(...seatPositions, 0); const maxX = Math.max(...seatPositions, 0); const offsetX = (override?.offsetX ?? 0) * 24; const offsetY = (override?.offsetY ?? 0) * 24; const rotation = override?.rotation ?? 0; const curve = displayConfig.geometry === 'fan' ? (override?.curve ?? displayConfig.curve) : 0; const y = 170 + row * rowGap + offsetY; const active = !preview && selectedRow === row
          return <g key={row} className={`${active ? 'plan-row active' : 'plan-row'} ${preview ? 'preview' : ''}`} transform={`translate(${500 + offsetX}, ${y}) rotate(${rotation})`} onPointerDown={(event) => startRowDrag(event, row)} onPointerMove={moveRowDrag} onPointerUp={endRowDrag} onPointerCancel={endRowDrag}><path d={`M ${minX} 0 Q 0 ${curve * 55} ${maxX} 0`} />{seatPositions.map((x, seat) => { const normalized = seats === 1 ? 0 : seat / (seats - 1) - .5; return <circle key={seat} cx={x} cy={Math.abs(normalized * 2) ** 2 * curve * 28} r={active ? 6.5 : 5.2} /> })}<text x={minX - 28} y="5">{rowLabel(row)}</text>{active && <rect className="row-hitbox" x={minX - 15} y="-20" width={maxX - minX + 30} height="55" rx="10" />}</g>
        })}
        {calibrationPoints.length > 0 && <g className="calibration-line"><circle cx={calibrationPoints[0].x} cy={calibrationPoints[0].y} r="8" />{calibrationPoints[1] && <><line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1].x} y2={calibrationPoints[1].y} /><circle cx={calibrationPoints[1].x} cy={calibrationPoints[1].y} r="8" /></>}</g>}
      </svg>
      {calibrating && <div className="calibration-card"><Crosshair size={18} /><div><b>{calibrationPoints.length < 2 ? `Select point ${calibrationPoints.length + 1} of 2` : 'Enter the real distance'}</b><span>Mark two known points on the plan.</span></div>{calibrationPoints.length === 2 && <><label><input type="number" min="0.1" step="0.1" value={knownDistance} onChange={(event) => setKnownDistance(Number(event.target.value))} /> metres</label><button onClick={applyCalibration}>Apply scale</button></>}</div>}
      {autoOpen && <div className="auto-layout-panel"><header><div><Sparkles /><span><b>Auto Layout</b><small>Generate rows inside a boundary</small></span></div><button onClick={() => { setAutoOpen(false); setDrawingBoundary(false); setPreview(null) }}><X /></button></header><div className="auto-fields"><label>Seat spacing<input type="number" min="0.45" max="1.2" step="0.05" value={config.seatSpacing ?? .72} onChange={(event) => onConfigChange({ seatSpacing: Number(event.target.value) })} /><span>m</span></label><label>Row spacing<input type="number" min="0.5" max="2" step="0.05" value={config.rowSpacing ?? .92} onChange={(event) => onConfigChange({ rowSpacing: Number(event.target.value) })} /><span>m</span></label><label>Edge clearance<input type="number" min="0" max="3" step="0.1" value={config.edgeClearance ?? .6} onChange={(event) => onConfigChange({ edgeClearance: Number(event.target.value) })} /><span>m</span></label><label>Aisle width<input type="number" min="0" max="3" step="0.1" value={config.aisleWidth ?? .9} onChange={(event) => onConfigChange({ aisleWidth: Number(event.target.value) })} /><span>m</span></label></div><div className="stage-settings"><span>Stage angle</span><button onClick={() => onConfigChange({ stagePosition: { ...stage, rotation: Math.max(-90, stage.rotation - 5) } })}><RotateCcw /></button><b>{stage.rotation}°</b><button onClick={() => onConfigChange({ stagePosition: { ...stage, rotation: Math.min(90, stage.rotation + 5) } })}><RotateCw /></button></div><div className="boundary-actions">{drawingBoundary ? <><span>{boundaryDraft.length} points selected</span><button onClick={() => setBoundaryDraft((points) => points.slice(0, -1))}>Undo point</button><button className="primary" disabled={boundaryDraft.length < 3} onClick={finishBoundary}>Finish boundary</button></> : <><button onClick={() => { setBoundaryDraft([]); setDrawingBoundary(true); setPreview(null) }}>{visibleBoundary.length ? 'Redraw boundary' : 'Draw boundary'}</button>{visibleBoundary.length >= 3 && <button onClick={() => { onConfigChange({ planBoundary: [] }); setBoundaryDraft([]); setPreview(null) }}>Clear</button>}</>}</div><button className="generate-layout" disabled={visibleBoundary.length < 3 || drawingBoundary} onClick={createPreview}><Sparkles /> Generate preview</button><small className="auto-note">Drag the stage directly on the plan. Rows follow its angle.</small></div>}
      {preview && <div className="layout-preview-card"><div><small>LAYOUT PREVIEW</small><strong>{preview.capacity} seats</strong><span>{preview.rows} rows · {config.sectors} sections</span></div><button onClick={() => setPreview(null)}>Cancel</button><button className="apply" onClick={applyPreview}>Apply layout</button></div>}
    </div>
    <div className="row-editor-bar row-editor-v2"><div className="selected-row-label"><small>SELECTED ROW</small><strong>{rowLabel(selectedRow)}</strong></div><div className="row-control"><span>Seats</span><button onClick={() => updateRow(selectedRow, { seats: Math.max(2, selectedSeats - 1) })}><Minus /></button><b>{selectedSeats}</b><button onClick={() => updateRow(selectedRow, { seats: Math.min(60, selectedSeats + 1) })}><Plus /></button></div><div className="row-control"><span>X position</span><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) - .5 })}><MoveHorizontal /></button><b>{(selectedOverride.offsetX ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) + .5 })}><MoveHorizontal /></button></div><div className="row-control"><span>Y position</span><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) - .5 })}><MoveVertical /></button><b>{(selectedOverride.offsetY ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) + .5 })}><MoveVertical /></button></div><div className="row-control"><span>Rotation</span><button onClick={() => updateRow(selectedRow, { rotation: Math.max(-90, (selectedOverride.rotation ?? 0) - 5) })}><RotateCcw /></button><b>{selectedOverride.rotation ?? 0}°</b><button onClick={() => updateRow(selectedRow, { rotation: Math.min(90, (selectedOverride.rotation ?? 0) + 5) })}><RotateCw /></button></div><div className="row-control"><span>Curve</span><button onClick={() => updateRow(selectedRow, { curve: Math.max(-1, round((selectedOverride.curve ?? config.curve) - .1)) })}><Minus /></button><b>{(selectedOverride.curve ?? config.curve).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { curve: Math.min(1, round((selectedOverride.curve ?? config.curve) + .1)) })}><Plus /></button></div><div className="row-actions"><button onClick={() => addRow(false)} title="Add row"><Plus /></button><button onClick={() => addRow(true)} title="Duplicate row"><Copy /></button><button onClick={resetRow} title="Reset row"><RotateCcw /></button><button className="danger" onClick={deleteRow} disabled={config.rows <= 3} title="Delete row"><Trash2 /></button></div></div>
  </div>
}
