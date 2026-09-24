import { Copy, Crosshair, Minus, MoveHorizontal, MoveVertical, Plus, RotateCcw, RotateCw, Ruler, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { RowOverride, VenueConfig } from '../types/venue'
import { getRowSeats } from '../utils/venue'

type Point = { x: number; y: number }

type FloorplanEditorProps = {
  config: VenueConfig
  imageUrl: string | null
  fileName: string | null
  onConfigChange: (patch: Partial<VenueConfig>) => void
  onBeginEdit: () => void
  onCommitEdit: () => void
}

const rowLabel = (row: number) => String.fromCharCode(65 + row)

export function FloorplanEditor({ config, imageUrl, fileName, onConfigChange, onBeginEdit, onCommitEdit }: FloorplanEditorProps) {
  const [selectedRow, setSelectedRow] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [knownDistance, setKnownDistance] = useState(10)
  const drag = useRef<{ row: number; startX: number; startY: number; offsetX: number; offsetY: number; width: number; height: number } | null>(null)
  const rowGap = Math.min(34, 350 / Math.max(config.rows - 1, 1))
  const rows = useMemo(() => Array.from({ length: config.rows }, (_, row) => ({ row, seats: getRowSeats(config, row) })), [config])
  const selectedOverride = config.rowOverrides?.[selectedRow] ?? {}
  const selectedSeats = getRowSeats(config, selectedRow)

  useEffect(() => { if (selectedRow >= config.rows) setSelectedRow(Math.max(0, config.rows - 1)) }, [config.rows, selectedRow])

  const updateRow = (row: number, patch: Partial<RowOverride>) => {
    onConfigChange({ rowOverrides: { ...(config.rowOverrides ?? {}), [row]: { ...(config.rowOverrides?.[row] ?? {}), ...patch } } })
  }
  const resetRow = () => {
    const next = { ...(config.rowOverrides ?? {}) }
    delete next[selectedRow]
    onConfigChange({ rowOverrides: next })
  }
  const addRow = (duplicate = false) => {
    if (config.rows >= 24) return
    const insertAt = selectedRow + 1
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) {
      const override = config.rowOverrides?.[row]
      if (override) next[row < insertAt ? row : row + 1] = override
    }
    if (duplicate) next[insertAt] = { ...selectedOverride, offsetY: (selectedOverride.offsetY ?? 0) + 0.9 }
    onConfigChange({ rows: config.rows + 1, rowOverrides: next })
    setSelectedRow(insertAt)
  }
  const deleteRow = () => {
    if (config.rows <= 3) return
    const next: Record<number, RowOverride> = {}
    for (let row = 0; row < config.rows; row += 1) {
      if (row === selectedRow) continue
      const override = config.rowOverrides?.[row]
      if (override) next[row < selectedRow ? row : row - 1] = override
    }
    onConfigChange({ rows: config.rows - 1, rowOverrides: next })
    setSelectedRow(Math.min(selectedRow, config.rows - 2))
  }
  const canvasPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 620 }
  }
  const handleCanvasClick = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!calibrating) return
    setPoints((current) => [...current, canvasPoint(event)].slice(-2))
  }
  const applyCalibration = () => {
    if (points.length !== 2) return
    const pixels = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    onConfigChange({ calibration: { meters: knownDistance, pixels } })
    setCalibrating(false)
  }
  const startDrag = (event: ReactPointerEvent<SVGGElement>, row: number) => {
    if (calibrating) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedRow(row); onBeginEdit()
    drag.current = {
      row, startX: event.clientX, startY: event.clientY,
      offsetX: config.rowOverrides?.[row]?.offsetX ?? 0,
      offsetY: config.rowOverrides?.[row]?.offsetY ?? 0,
      width: rect.width, height: rect.height,
    }
  }
  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag.current) return
    const deltaX = ((event.clientX - drag.current.startX) / drag.current.width) * 1000 / 24
    const deltaY = ((event.clientY - drag.current.startY) / drag.current.height) * 620 / 24
    updateRow(drag.current.row, {
      offsetX: Math.round((drag.current.offsetX + deltaX) * 10) / 10,
      offsetY: Math.round((drag.current.offsetY + deltaY) * 10) / 10,
    })
  }
  const endDrag = () => { if (drag.current) onCommitEdit(); drag.current = null }

  return (
    <div className="plan-editor">
      <div className="plan-toolbar">
        <div><strong>Floor plan editor</strong><span>{fileName ?? 'Generated plan · drag rows to position them freely'}</span></div>
        <div>
          {config.calibration && <span className="scale-chip">1 px = {(config.calibration.meters / config.calibration.pixels).toFixed(3)} m</span>}
          <button className={calibrating ? 'active' : ''} onClick={() => { setCalibrating((value) => !value); setPoints([]) }}><Ruler size={15} /> Calibrate</button>
        </div>
      </div>
      <div className="plan-canvas">
        {imageUrl && <img src={imageUrl} alt="Uploaded venue floor plan" />}
        {!imageUrl && <div className="plan-grid" />}
        <svg viewBox="0 0 1000 620" onPointerDown={handleCanvasClick}>
          <g className="plan-stage"><rect x={350 - config.stageWidth * 10} y="42" width={300 + config.stageWidth * 20} height="68" rx="7" /><text x="500" y="82">STAGE · {config.stageWidth} M</text></g>
          {rows.map(({ row, seats }) => {
            const width = Math.min(680, seats * 24)
            const override = config.rowOverrides?.[row]
            const offsetX = (override?.offsetX ?? 0) * 24
            const offsetY = (override?.offsetY ?? 0) * 24
            const rotation = override?.rotation ?? 0
            const curve = config.geometry === 'fan' ? (override?.curve ?? config.curve) : 0
            const y = 170 + row * rowGap + offsetY
            const active = selectedRow === row
            return <g key={row} className={active ? 'plan-row active' : 'plan-row'} transform={`translate(${500 + offsetX}, ${y}) rotate(${rotation})`} onPointerDown={(event) => startDrag(event, row)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
              <path d={`M ${-width / 2} 0 Q 0 ${curve * 55} ${width / 2} 0`} />
              {Array.from({ length: seats }, (_, seat) => {
                const normalized = seats === 1 ? 0 : seat / (seats - 1) - .5
                const x = seats === 1 ? 0 : -width / 2 + (seat / (seats - 1)) * width
                const seatY = Math.abs(normalized * 2) ** 2 * curve * 28
                return <circle key={seat} cx={x} cy={seatY} r={active ? 6.5 : 5.2} />
              })}
              <text x={-width / 2 - 28} y="5">{rowLabel(row)}</text>
              {active && <rect className="row-hitbox" x={-width / 2 - 15} y="-20" width={width + 30} height="55" rx="10" />}
            </g>
          })}
          {points.length > 0 && <g className="calibration-line"><circle cx={points[0].x} cy={points[0].y} r="8" />{points[1] && <><line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} /><circle cx={points[1].x} cy={points[1].y} r="8" /></>}</g>}
        </svg>
        {calibrating && <div className="calibration-card"><Crosshair size={18} /><div><b>{points.length < 2 ? `Select point ${points.length + 1} of 2` : 'Enter the real distance'}</b><span>Mark two known points on the plan.</span></div>{points.length === 2 && <><label><input type="number" min="0.1" step="0.1" value={knownDistance} onChange={(event) => setKnownDistance(Number(event.target.value))} /> metres</label><button onClick={applyCalibration}>Apply scale</button></>}</div>}
      </div>
      <div className="row-editor-bar row-editor-v2">
        <div className="selected-row-label"><small>SELECTED ROW</small><strong>{rowLabel(selectedRow)}</strong></div>
        <div className="row-control"><span>Seats</span><button onClick={() => updateRow(selectedRow, { seats: Math.max(2, selectedSeats - 1) })}><Minus /></button><b>{selectedSeats}</b><button onClick={() => updateRow(selectedRow, { seats: Math.min(30, selectedSeats + 1) })}><Plus /></button></div>
        <div className="row-control"><span>X position</span><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) - .5 })}><MoveHorizontal /></button><b>{(selectedOverride.offsetX ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) + .5 })}><MoveHorizontal /></button></div>
        <div className="row-control"><span>Y position</span><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) - .5 })}><MoveVertical /></button><b>{(selectedOverride.offsetY ?? 0).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { offsetY: (selectedOverride.offsetY ?? 0) + .5 })}><MoveVertical /></button></div>
        <div className="row-control"><span>Rotation</span><button onClick={() => updateRow(selectedRow, { rotation: Math.max(-90, (selectedOverride.rotation ?? 0) - 5) })}><RotateCcw /></button><b>{selectedOverride.rotation ?? 0}°</b><button onClick={() => updateRow(selectedRow, { rotation: Math.min(90, (selectedOverride.rotation ?? 0) + 5) })}><RotateCw /></button></div>
        <div className="row-control"><span>Curve</span><button onClick={() => updateRow(selectedRow, { curve: Math.max(-1, Math.round(((selectedOverride.curve ?? config.curve) - .1) * 10) / 10) })}><Minus /></button><b>{(selectedOverride.curve ?? config.curve).toFixed(1)}</b><button onClick={() => updateRow(selectedRow, { curve: Math.min(1, Math.round(((selectedOverride.curve ?? config.curve) + .1) * 10) / 10) })}><Plus /></button></div>
        <div className="row-actions"><button onClick={() => addRow(false)} title="Add row"><Plus /></button><button onClick={() => addRow(true)} title="Duplicate row"><Copy /></button><button onClick={resetRow} title="Reset row"><RotateCcw /></button><button className="danger" onClick={deleteRow} disabled={config.rows <= 3} title="Delete row"><Trash2 /></button></div>
      </div>
    </div>
  )
}
