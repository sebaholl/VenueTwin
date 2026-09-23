import { Crosshair, Minus, MoveHorizontal, Plus, Ruler, RotateCcw } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { VenueConfig } from '../types/venue'
import { getRowSeats } from '../utils/venue'

type Point = { x: number; y: number }

type FloorplanEditorProps = {
  config: VenueConfig
  imageUrl: string | null
  fileName: string | null
  onConfigChange: (patch: Partial<VenueConfig>) => void
}

export function FloorplanEditor({ config, imageUrl, fileName, onConfigChange }: FloorplanEditorProps) {
  const [selectedRow, setSelectedRow] = useState(0)
  const [calibrating, setCalibrating] = useState(false)
  const [points, setPoints] = useState<Point[]>([])
  const [knownDistance, setKnownDistance] = useState(10)
  const drag = useRef<{ row: number; startX: number; startOffset: number } | null>(null)
  const rowGap = Math.min(34, 350 / Math.max(config.rows - 1, 1))
  const rows = useMemo(() => Array.from({ length: config.rows }, (_, row) => ({ row, seats: getRowSeats(config, row) })), [config])
  const selectedOverride = config.rowOverrides?.[selectedRow] ?? {}
  const selectedSeats = getRowSeats(config, selectedRow)

  const updateRow = (row: number, patch: { seats?: number; offsetX?: number; curve?: number }) => {
    onConfigChange({ rowOverrides: { ...(config.rowOverrides ?? {}), [row]: { ...(config.rowOverrides?.[row] ?? {}), ...patch } } })
  }
  const resetRow = () => {
    const next = { ...(config.rowOverrides ?? {}) }
    delete next[selectedRow]
    onConfigChange({ rowOverrides: next })
  }
  const canvasPoint = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: ((event.clientX - rect.left) / rect.width) * 1000, y: ((event.clientY - rect.top) / rect.height) * 620 }
  }
  const handleCanvasClick = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!calibrating) return
    const next = [...points, canvasPoint(event)].slice(-2)
    setPoints(next)
  }
  const applyCalibration = () => {
    if (points.length !== 2) return
    const pixels = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    onConfigChange({ calibration: { meters: knownDistance, pixels } })
    setCalibrating(false)
  }
  const startDrag = (event: ReactPointerEvent<SVGGElement>, row: number) => {
    if (calibrating) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedRow(row)
    drag.current = { row, startX: event.clientX, startOffset: config.rowOverrides?.[row]?.offsetX ?? 0 }
  }
  const moveDrag = (event: ReactPointerEvent<SVGGElement>) => {
    if (!drag.current) return
    updateRow(drag.current.row, { offsetX: Math.round((drag.current.startOffset + (event.clientX - drag.current.startX) / 24) * 10) / 10 })
  }
  const endDrag = () => { drag.current = null }

  return (
    <div className="plan-editor">
      <div className="plan-toolbar">
        <div><strong>Floor plan editor</strong><span>{fileName ?? 'Generated plan · upload an image for an overlay'}</span></div>
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
            const offset = (config.rowOverrides?.[row]?.offsetX ?? 0) * 24
            const y = 170 + row * rowGap
            const active = selectedRow === row
            return <g key={row} className={active ? 'plan-row active' : 'plan-row'} transform={`translate(${500 + offset}, ${y})`} onPointerDown={(event) => startDrag(event, row)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
              <path d={`M ${-width / 2} 0 Q 0 ${config.geometry === 'fan' ? 18 + (config.rowOverrides?.[row]?.curve ?? 0) * 20 : 0} ${width / 2} 0`} />
              {Array.from({ length: seats }, (_, seat) => {
                const x = seats === 1 ? 0 : -width / 2 + (seat / (seats - 1)) * width
                const normal = seats === 1 ? 0 : seat / (seats - 1) - .5
                const seatY = config.geometry === 'fan' ? Math.abs(normal) * (28 + config.curve * 20) : 0
                return <circle key={seat} cx={x} cy={seatY} r={active ? 6.5 : 5.2} />
              })}
              <text x={-width / 2 - 28} y="5">{String.fromCharCode(65 + row)}</text>
              {active && <rect className="row-hitbox" x={-width / 2 - 15} y="-17" width={width + 30} height="50" rx="10" />}
            </g>
          })}
          {points.length > 0 && <g className="calibration-line"><circle cx={points[0].x} cy={points[0].y} r="8" />{points[1] && <><line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} /><circle cx={points[1].x} cy={points[1].y} r="8" /></>}</g>}
        </svg>
        {calibrating && <div className="calibration-card"><Crosshair size={18} /><div><b>{points.length < 2 ? `Select point ${points.length + 1} of 2` : 'Enter the real distance'}</b><span>Mark two known points on the plan.</span></div>{points.length === 2 && <><label><input type="number" min="0.1" step="0.1" value={knownDistance} onChange={(event) => setKnownDistance(Number(event.target.value))} /> metres</label><button onClick={applyCalibration}>Apply scale</button></>}</div>}
      </div>
      <div className="row-editor-bar">
        <div><small>SELECTED ROW</small><strong>{String.fromCharCode(65 + selectedRow)}</strong></div>
        <div className="row-control"><span>Seats</span><button onClick={() => updateRow(selectedRow, { seats: Math.max(2, selectedSeats - 1) })}><Minus /></button><b>{selectedSeats}</b><button onClick={() => updateRow(selectedRow, { seats: Math.min(30, selectedSeats + 1) })}><Plus /></button></div>
        <div className="row-control"><span>Horizontal position</span><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) - .5 })}><MoveHorizontal /></button><b>{(selectedOverride.offsetX ?? 0).toFixed(1)} m</b><button onClick={() => updateRow(selectedRow, { offsetX: (selectedOverride.offsetX ?? 0) + .5 })}><MoveHorizontal /></button></div>
        <button className="reset-row" onClick={resetRow}><RotateCcw size={14} /> Reset row</button>
      </div>
    </div>
  )
}
