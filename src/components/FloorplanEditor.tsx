import { stagePlanPose } from '../utils/stagePlan'
import { calibratePlan, planScale } from '../utils/planScale'
import type { ReferenceMeasurement } from '../lib/projectReferences'
import { Copy, Crosshair, Minus, MoveHorizontal, MoveVertical, Plus, RotateCcw, RotateCw, Ruler, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { PlanPoint, RowOverride, VenueConfig } from '../types/venue'
import { generateAutoLayout, type AutoLayoutResult } from '../utils/autoLayout'
import { seatCategory } from '../utils/seatCategories'
import { generatePhysicalSeatLayout, getRowSeats, getRowLabel } from '../utils/venue'
import { ObstaclePlan } from './ObstaclePlan'

type FloorplanEditorProps = {
  measurements?: ReferenceMeasurement[]
  config: VenueConfig
  imageUrl: string | null
  fileName: string | null
  onConfigChange: (patch: Partial<VenueConfig>) => void
  onBeginEdit: () => void
  onCommitEdit: () => void
}

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

export function FloorplanEditor({ measurements = [], config, imageUrl, fileName, onConfigChange, onBeginEdit, onCommitEdit }: FloorplanEditorProps) {
  const stagePose = stagePlanPose(config)
  const scale = planScale(config.calibration)
  const [selectedRow, setSelectedRow] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [calibrationPoints, setCalibrationPoints] = useState<PlanPoint[]>([])
  const [knownDistance, setKnownDistance] = useState(10)
  const [autoOpen, setAutoOpen] = useState(false)
  const [levelChoice, setVisibleLevel] = useState<string | null>(null)
  const visibleLevel = levelChoice === 'all' || config.seatingLevels?.some((level) => level.id === levelChoice)
    ? levelChoice ?? 'all' : config.seatingLevels?.[0]?.id ?? 'all'
  const [drawingBoundary, setDrawingBoundary] = useState(false)
  const [boundaryDraft, setBoundaryDraft] = useState<PlanPoint[]>([])
  const [preview, setPreview] = useState<AutoLayoutResult | null>(null)
  const rowDrag = useRef<{ row: number; startX: number; startY: number; offsetX: number; offsetY: number; scale: number } | null>(null)
  const stageDrag = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number; scale: number } | null>(null)

  const displayConfig = useMemo(() => preview ? { ...config, rows: preview.rows, geometry: 'straight' as const, rowOverrides: preview.rowOverrides } : config, [config, preview])
  const rows = useMemo(() => {
    const seats = generatePhysicalSeatLayout(displayConfig)
    return Array.from({ length: displayConfig.rows }, (_, row) => ({ row, seats: seats.filter((seat) => seat.row === row) }))
  }, [displayConfig])
  const selectedOverride = config.rowOverrides?.[selectedRow] ?? {}
  const selectedSeats = getRowSeats(config, selectedRow)
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const visibleBoundary = drawingBoundary ? boundaryDraft : (config.planBoundary ?? [])

  useEffect(() => { if (selectedRow >= config.rows) setSelectedRow(Math.max(0, config.rows - 1)) }, [config.rows, selectedRow])

  const updateRow = (row: number, patch: Partial<RowOverride>) => onConfigChange({ rowOverrides: { ...(config.rowOverrides ?? {}), [row]: { ...(config.rowOverrides?.[row] ?? {}), ...patch } } })
  const resetRow = () => { const next = { ...(config.rowOverrides ?? {}) }; next[selectedRow] = { frontRailing: selectedOverride.frontRailing, levelId: selectedOverride.levelId, elevation: selectedOverride.elevation, arcRadius: selectedOverride.arcRadius, arcDegrees: selectedOverride.arcDegrees, categoryId: selectedOverride.categoryId, seatCategories: selectedOverride.seatCategories, accessibleSeats: selectedOverride.accessibleSeats }; onConfigChange({ rowOverrides: next }) }
  const addRow = (duplicate = false) => {
    if (config.rows >= 50) return
    const insertAt = selectedRow + 1
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) { const override = config.rowOverrides?.[row]; if (override) next[row < insertAt ? row : row + 1] = override }
    if (duplicate) next[insertAt] = { ...selectedOverride, ticketRow: undefined, numberingSource: undefined, offsetY: (selectedOverride.offsetY ?? 0) + (config.rowSpacing ?? .92) }
    onConfigChange({ rows: config.rows + 1, rowOverrides: next }); setSelectedRow(insertAt)
  }
  const deleteRow = () => {
    if (config.rows <= 3) return
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) { if (row === selectedRow) continue; const override = config.rowOverrides?.[row]; if (override) next[row < selectedRow ? row : row - 1] = override }
    onConfigChange({ rows: config.rows - 1, rowOverrides: next }); setSelectedRow(Math.min(selectedRow, config.rows - 2))
  }
  const canvasPoint = (event: ReactPointerEvent<SVGSVGElement | SVGGElement>): PlanPoint | null => {
    const svg = event.currentTarget instanceof SVGSVGElement ? event.currentTarget : event.currentTarget.ownerSVGElement
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return null
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
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
    const calibration = calibratePlan(calibrationPoints, knownDistance)
    if (!calibration) return
    onConfigChange({ calibration }); setCalibrating(false); setCalibrationPoints([]); setPreview(null)
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
    const point = canvasPoint(event); if (!point) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); setSelectedRow(row); onBeginEdit()
    rowDrag.current = { row, startX: point.x, startY: point.y, offsetX: config.rowOverrides?.[row]?.offsetX ?? 0, offsetY: config.rowOverrides?.[row]?.offsetY ?? 0, scale }
  }
  const moveRowDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!rowDrag.current) return
    const point = canvasPoint(event); if (!point) return
    const deltaX = (point.x - rowDrag.current.startX) / rowDrag.current.scale
    const deltaY = (point.y - rowDrag.current.startY) / rowDrag.current.scale
    updateRow(rowDrag.current.row, { offsetX: round(rowDrag.current.offsetX + deltaX), offsetY: round(rowDrag.current.offsetY + deltaY) })
  }
  const endRowDrag = () => { if (rowDrag.current) onCommitEdit(); rowDrag.current = null }
  const startStageDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (calibrating || drawingBoundary || preview) return
    const svg = event.currentTarget.ownerSVGElement; if (!svg) return
    const point = canvasPoint(event); if (!point) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); onBeginEdit()
    stageDrag.current = { startX: point.x, startY: point.y, offsetX: stage.offsetX, offsetY: stage.offsetY, scale }
  }
  const moveStageDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!stageDrag.current) return
    const point = canvasPoint(event); if (!point) return
    const deltaX = (point.x - stageDrag.current.startX) / stageDrag.current.scale
    const deltaY = (point.y - stageDrag.current.startY) / stageDrag.current.scale
    onConfigChange({ stagePosition: { ...stage, offsetX: round(stageDrag.current.offsetX + deltaX), offsetY: round(stageDrag.current.offsetY + deltaY) } })
  }
  const endStageDrag = () => { if (stageDrag.current) onCommitEdit(); stageDrag.current = null }

  return <div className="plan-editor">
    <div className="plan-toolbar"><div><strong>Floor plan editor</strong><span>{fileName ?? 'Draw a boundary or edit rows manually'}</span></div><div>{config.calibration && <span className="scale-chip">Scale calibrated</span>}<button disabled={!!config.seatingLevels?.length} title={config.seatingLevels?.length ? 'Auto layout is available for single-level projects only' : undefined} className={autoOpen ? 'active' : ''} onClick={() => { setAutoOpen((value) => !value); setCalibrating(false) }}><Sparkles size={15} /> Auto layout</button><button disabled={!imageUrl} title={!imageUrl ? 'Choose an image floor plan in Project first' : undefined} className={calibrating ? 'active' : ''} onClick={() => { setCalibrating((value) => !value); setCalibrationPoints([]); setDrawingBoundary(false); setAutoOpen(false); setPreview(null) }}><Ruler size={15} /> Calibrate</button></div></div>
    {config.seatingLevels?.length ? <label className="level-filter">Visible level · × = service place (not for sale) <select value={visibleLevel} onChange={(event) => setVisibleLevel(event.target.value)}><option value="all">All levels (overlay)</option>{config.seatingLevels.map((level) => <option key={level.id} value={level.id}>{level.name}</option>)}</select></label> : null}
    <div className="plan-canvas">
      {!imageUrl && <div className="plan-grid" />}
      <svg viewBox="0 0 1000 620" onPointerDown={handleCanvasPointerDown}>
        <image href={imageUrl ?? undefined} x="0" y="0" width="1000" height="620" preserveAspectRatio="xMidYMid meet" opacity=".34" pointerEvents="none" />
        <BoundaryOverlay points={visibleBoundary} drawing={drawingBoundary} />
        <g className="plan-stage draggable" transform={`translate(${stagePose.x}, ${stagePose.y}) rotate(${stagePose.rotation})`} onPointerDown={startStageDrag} onPointerMove={moveStageDrag} onPointerUp={endStageDrag} onPointerCancel={endStageDrag}><rect x={-(config.stageWidth * scale / 2)} y={-1.1 * scale} width={config.stageWidth * scale} height={2.2 * scale} rx="7" /><text x="0" y="6">STAGE · {config.stageWidth} M</text></g>
        {rows.filter(({ row }) => visibleLevel === 'all' || config.rowOverrides[row]?.levelId === visibleLevel).map(({ row, seats }) => {
          if (!seats.length) return null
          const points = seats.map((seat) => ({ seat: seat.seat, service: seat.service, x: 500 + seat.position[0] * scale, y: 150 + seat.position[2] * scale }))
          const active = !preview && selectedRow === row
          const path = points.map((p, index) => `${index ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
          return <g key={row} className={`${active ? 'plan-row active' : 'plan-row'} ${preview ? 'preview' : ''}`} onPointerDown={(event) => startRowDrag(event, row)} onPointerMove={moveRowDrag} onPointerUp={endRowDrag} onPointerCancel={endRowDrag}><path d={path} /><path d={path} style={{ stroke: 'transparent', strokeWidth: 18, pointerEvents: 'stroke' }} />{points.map((p) => p.service ? <g key={p.seat} pointerEvents="none"><title>Service place · not for sale</title><rect x={p.x - 5} y={p.y - 5} width={10} height={10} fill="none" stroke="#a4b5bd" /><path d={`M ${p.x - 3} ${p.y - 3} l 6 6 M ${p.x + 3} ${p.y - 3} l -6 6`} style={{ stroke: '#a4b5bd', fill: 'none' }} /></g> : <circle key={p.seat} style={{ fill: seatCategory(displayConfig, row, p.seat).color }} cx={p.x} cy={p.y} r={active ? 6.5 : 5.2} />)}<text x={points[0].x - 28} y={points[0].y + 5}>{getRowLabel(displayConfig, row)}</text></g>
        })}
        {calibrationPoints.length > 0 && <g className="calibration-line"><circle cx={calibrationPoints[0].x} cy={calibrationPoints[0].y} r="8" />{calibrationPoints[1] && <><line x1={calibrationPoints[0].x} y1={calibrationPoints[0].y} x2={calibrationPoints[1].x} y2={calibrationPoints[1].y} /><circle cx={calibrationPoints[1].x} cy={calibrationPoints[1].y} r="8" /></>}</g>}
        <ObstaclePlan config={config} />
      </svg>
      {calibrating && <div className="calibration-card"><Crosshair size={18} /><div><b>{calibrationPoints.length < 2 ? `Select point ${calibrationPoints.length + 1} of 2` : 'Enter the real distance'}</b><span>Mark both ends of a known distance. This sets the plan scale, not the existing venue dimensions.</span></div>{calibrationPoints.length === 2 && <>{measurements.length > 0 && <label>Saved measurement<select defaultValue="" onChange={(event) => { const item = measurements.find((entry) => entry.id === event.target.value); if (item) setKnownDistance(item.meters) }}><option value="">Choose a reference…</option>{measurements.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.meters} m · {item.confidence}</option>)}</select></label>}<label><input aria-label="Known distance in metres" type="number" min="0.1" step="0.1" value={knownDistance} onChange={(event) => setKnownDistance(Number(event.target.value))} /> metres</label><button disabled={!calibratePlan(calibrationPoints, knownDistance)} onClick={applyCalibration}>Apply scale</button></>}<button onClick={() => { setCalibrating(false); setCalibrationPoints([]) }}>Cancel</button></div>}
      {autoOpen && <div className="auto-layout-panel"><header><div><Sparkles /><span><b>Auto Layout</b><small>Generate rows inside a boundary</small></span></div><button onClick={() => { setAutoOpen(false); setDrawingBoundary(false); setPreview(null) }}><X /></button></header><div className="auto-fields"><label>Seat spacing<input type="number" min="0.45" max="1.2" step="0.05" value={config.seatSpacing ?? .72} onChange={(event) => onConfigChange({ seatSpacing: Number(event.target.value) })} /><span>m</span></label><label>Row spacing<input type="number" min="0.5" max="2" step="0.05" value={config.rowSpacing ?? .92} onChange={(event) => onConfigChange({ rowSpacing: Number(event.target.value) })} /><span>m</span></label><label>Edge clearance<input type="number" min="0" max="3" step="0.1" value={config.edgeClearance ?? .6} onChange={(event) => onConfigChange({ edgeClearance: Number(event.target.value) })} /><span>m</span></label><label>Aisle width<input type="number" min="0" max="3" step="0.1" value={config.aisleWidth ?? .9} onChange={(event) => onConfigChange({ aisleWidth: Number(event.target.value) })} /><span>m</span></label></div><div className="stage-settings"><span>Stage angle</span><button onClick={() => onConfigChange({ stagePosition: { ...stage, rotation: Math.max(-90, stage.rotation - 5) } })}><RotateCcw /></button><b>{stage.rotation}°</b><button onClick={() => onConfigChange({ stagePosition: { ...stage, rotation: Math.min(90, stage.rotation + 5) } })}><RotateCw /></button></div><div className="boundary-actions">{drawingBoundary ? <><span>{boundaryDraft.length} points selected</span><button onClick={() => setBoundaryDraft((points) => points.slice(0, -1))}>Undo point</button><button className="primary" disabled={boundaryDraft.length < 3} onClick={finishBoundary}>Finish boundary</button></> : <><button onClick={() => { setBoundaryDraft([]); setDrawingBoundary(true); setPreview(null) }}>{visibleBoundary.length ? 'Redraw boundary' : 'Draw boundary'}</button>{visibleBoundary.length >= 3 && <button onClick={() => { onConfigChange({ planBoundary: [] }); setBoundaryDraft([]); setPreview(null) }}>Clear</button>}</>}</div><button className="generate-layout" disabled={visibleBoundary.length < 3 || drawingBoundary} onClick={createPreview}><Sparkles /> Generate preview</button><small className="auto-note">{!config.calibration && 'Using the default scale. Calibrate an image plan first for measured spacing. '}Drag the stage directly on the plan. Rows follow its angle.</small></div>}
      {preview && <div className="layout-preview-card"><div><small>LAYOUT PREVIEW</small><strong>{preview.capacity} seats</strong><span>{preview.rows} rows · {config.sectors} sections</span></div><button onClick={() => setPreview(null)}>Cancel</button><button className="apply" onClick={applyPreview}>Apply layout</button></div>}
    </div>
    <div className="row-editor-bar row-editor-v2"><div className="selected-row-label"><small>SELECTED ROW</small><strong>{getRowLabel(config, selectedRow)}</strong></div><div className="row-control"><span>Seats</span><button onClick={() => updateRow(selectedRow, { seats: Math.max(2, selectedSeats - 1) })}><Minus /></button><b>{selectedSeats}</b><button onClick={() => updateRow(selectedRow, { seats: Math.min(60, selectedSeats + 1) })}><Plus /></button></div><div className="row-control"><span>X position</span><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) - .5 })}><MoveHorizontal /></button><b>{(selectedOverride.offsetX ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) + .5 })}><MoveHorizontal /></button></div><div className="row-control"><span>Y position</span><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) - .5 })}><MoveVertical /></button><b>{(selectedOverride.offsetY ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) + .5 })}><MoveVertical /></button></div><div className="row-control"><span>Rotation</span><button onClick={() => updateRow(selectedRow, { rotation: Math.max(-90, (selectedOverride.rotation ?? 0) - 5) })}><RotateCcw /></button><b>{selectedOverride.rotation ?? 0}°</b><button onClick={() => updateRow(selectedRow, { rotation: Math.min(90, (selectedOverride.rotation ?? 0) + 5) })}><RotateCw /></button></div><div className="row-control"><span>Curve</span><button onClick={() => updateRow(selectedRow, { curve: Math.max(-1, round((selectedOverride.curve ?? config.curve) - .1)) })}><Minus /></button><b>{(selectedOverride.curve ?? config.curve).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { curve: Math.min(1, round((selectedOverride.curve ?? config.curve) + .1)) })}><Plus /></button></div><div className="row-actions"><button onClick={() => addRow(false)} title="Add row"><Plus /></button><button onClick={() => addRow(true)} title="Duplicate row"><Copy /></button><button onClick={resetRow} title="Reset row"><RotateCcw /></button><button className="danger" onClick={deleteRow} disabled={config.rows <= 3} title="Delete row"><Trash2 /></button></div></div>
  </div>
}
