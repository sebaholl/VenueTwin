import type { ReviewCamera } from '../utils/viewReview'
import { ContactShadows, Environment, Lightformer, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { PerspectiveCamera, type Group } from 'three'
import { getSeatView, lookDirection, modelOffset, overviewPose } from '../utils/seatView'
import { levelArchitecture } from '../utils/levelGeometry'
import { LevelArchitecture } from './LevelArchitecture'
import { DetailedSeats } from './DetailedSeats'
import type { SeatRef, VenueConfig } from '../types/venue'
import { seatCategory } from '../utils/seatCategories'
import { generatePhysicalSeatLayout, generateSeatLayout } from '../utils/venue'
import { getObstacles, obstacleBoxes } from '../utils/obstacles'

type SceneProps = {
  reviewCamera?: ReviewCamera
  customer?: boolean
  viewMode?: 'overview' | 'seat'
  onViewModeChange?: (mode: 'overview' | 'seat') => void
  interior?: boolean
  importedModel?: Group | null
  config: VenueConfig
  selectedSeat: SeatRef | null
  onSeatSelect: (seat: SeatRef) => void
}

function VenueModel({ config, selectedSeat, onSeatSelect, importedModel, interior }: SceneProps) {
  const seats = useMemo(() => generateSeatLayout(config), [config])
  const architecture = useMemo(() => levelArchitecture(config), [config])
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const stageRotation = stage.rotation * Math.PI / 180
  const detailed = !!importedModel?.getObjectByName('VT_ND_DETAIL_ROOT')
  useEffect(() => {
    importedModel?.traverse((object) => { if (object.userData.venueTwinShell === true) object.visible = !!interior })
  }, [importedModel, interior])

  return (
    <group position={modelOffset}>
      {!importedModel && <LevelArchitecture boxes={architecture} />}
      {importedModel && <primitive object={importedModel} dispose={null} onClick={(event: { stopPropagation: () => void }) => event.stopPropagation()} />}
      {getObstacles(config).map((o) => <group key={o.id} position={[o.x, o.elevation, o.z]} rotation={[0, o.rotation * Math.PI / 180, 0]}>
        {obstacleBoxes(o).map((box, index) => <mesh key={index} position={[box.x, box.y, 0]} onClick={(event) => event.stopPropagation()}><boxGeometry args={[box.width, box.height, box.depth]} /><meshStandardMaterial color={o.kind === 'railing' ? '#b4bec9' : '#8d8478'} roughness={.7} /></mesh>)}
      </group>)}
      {!importedModel && <group position={[stage.offsetX, 0, stage.offsetY]} rotation={[0, stageRotation, 0]}>
        <RoundedBox args={[config.stageWidth, 0.45, 2.2]} radius={0.12} position={[0, 0, -2.2]}>
          <meshStandardMaterial color="#17243a" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 2.7, -3.25]}>
          <planeGeometry args={[config.stageWidth * 0.84, 4.6]} />
          <meshStandardMaterial color={config.studyNotice ? '#702b3b' : '#e8f0f3'} emissive="#19304b" emissiveIntensity={0.16} />
        </mesh>
        {!config.studyNotice && <Text position={[0, 2.7, -3.18]} fontSize={0.42} color="#07111f" anchorX="center">VENUE TWIN</Text>}
      </group>}
      {generatePhysicalSeatLayout(config).filter((seat) => seat.service).map((seat) => <group key={seat.label} position={seat.position} rotation={[0, seat.rotation, 0]} onClick={(event) => event.stopPropagation()}>
        <RoundedBox args={[.48, .48, .12]} radius={.05} position={[0, .34, .16]}><meshStandardMaterial color="#667780" /></RoundedBox>
        <RoundedBox args={[.48, .12, .48]} radius={.05} position={[0, .04, -.05]}><meshStandardMaterial color="#667780" /></RoundedBox>
      </group>)}
      {detailed ? <DetailedSeats seats={seats} selectedSeat={selectedSeat} onSeatSelect={onSeatSelect} /> : seats.map((seat) => {
        const active = selectedSeat?.label === seat.label
        return (
          <group
            key={seat.label}
            position={seat.position}
            rotation={[0, seat.rotation, 0]}
            onClick={(event) => { event.stopPropagation(); onSeatSelect(seat) }}
          >
            <RoundedBox args={[0.48, 0.48, 0.48]} radius={0.1} position={[0, 0.34, 0]}>
              <meshStandardMaterial color={active ? '#ff7a59' : seatCategory(config, seat.row, seat.seat).color} roughness={0.38} />
            </RoundedBox>
            <RoundedBox args={[0.52, 0.16, 0.52]} radius={0.07} position={[0, 0.04, -0.05]}>
              <meshStandardMaterial color={active ? '#d95136' : '#183349'} />
            </RoundedBox>
          </group>
        )
      })}
      {!importedModel && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, config.rows * 0.5]}>
        <planeGeometry args={[26, 28]} />
        <meshStandardMaterial color="#0c1725" roughness={0.9} />
      </mesh>}
    </group>
  )
}

export function VenueScene(props: SceneProps) {
  const [localRequested, setLocalRequested] = useState(false)
  const requested = props.viewMode ? props.viewMode === 'seat' : localRequested
  const setRequested = (value: boolean) => { setLocalRequested(value); props.onViewModeChange?.(value ? 'seat' : 'overview') }
  const [look, setLook] = useState({ yaw: 0, pitch: 0 })
  const [eyeHeight, setEyeHeight] = useState(1.15)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const canvasRegion = useRef<HTMLDivElement>(null)
  const seatView = useMemo(() => getSeatView(props.config, props.selectedSeat, props.reviewCamera?.eyeHeight ?? eyeHeight), [props.config, props.selectedSeat, eyeHeight, props.reviewCamera?.eyeHeight])
  const active = requested && !!seatView
  useEffect(() => { if (active) canvasRegion.current?.focus({ preventScroll: true }) }, [active])
  const overview = useMemo(() => overviewPose(props.config), [props.config])
  const detailNotice = props.importedModel?.getObjectByName('VT_ND_DETAIL_ROOT') ? 'Photo-informed theatre study. Unmeasured geometry and interpreted ornament; paintings and official seat mapping are not reproduced.' : null
  useEffect(() => { setLook({ yaw: 0, pitch: 0 }); drag.current = null }, [props.selectedSeat?.row, props.selectedSeat?.seat])
  return (
    <div className={`venue-scene ${active ? 'seat-view-active' : ''}`}>
    {!props.reviewCamera && <div className="seat-view-toolbar">
      {(!props.customer || active) && <button type="button" disabled={!seatView} aria-pressed={active} onClick={() => { setRequested(!active); setLook({ yaw: 0, pitch: 0 }) }}>{active ? 'Back to overview' : 'View from seat'}</button>}
      {active && <><button type="button" onClick={() => setLook({ yaw: 0, pitch: 0 })}>Face stage</button><label>Eye height <select value={eyeHeight} onChange={(e) => setEyeHeight(Number(e.target.value))}><option value={.95}>0.95 m</option><option value={1.15}>1.15 m</option><option value={1.35}>1.35 m</option></select></label></>}
      {!props.customer && <span>{active ? `Seat ${props.selectedSeat?.label} · Drag or use arrow keys to look around · Esc to exit` : seatView ? `Seat ${props.selectedSeat?.label} selected · View from seat to enter` : 'Select a seat to preview its view'}</span>}
    </div>}
    <div ref={canvasRegion} className="venue-scene-canvas" tabIndex={active ? 0 : -1} role="group" aria-label={active ? 'Seat view. Drag or use arrow keys to look around. Escape returns to overview.' : 'Venue overview'}
      onKeyDown={(e) => { if (!active || props.reviewCamera) return; if (e.key === 'Escape') { setRequested(false); return } const keys: Record<string, [number, number]> = { ArrowLeft: [-.08, 0], ArrowRight: [.08, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }; const delta = keys[e.key]; if (delta) { e.preventDefault(); setLook((v) => ({ yaw: v.yaw + delta[0], pitch: Math.max(-1.2, Math.min(1.2, v.pitch + delta[1])) })) } }}
      onPointerDown={(e) => { if (props.reviewCamera || !active || !e.isPrimary || e.button !== 0) return; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY } }}
      onPointerMove={(e) => { if (props.reviewCamera || !active || !drag.current || !e.isPrimary) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; drag.current = { x: e.clientX, y: e.clientY }; setLook((v) => ({ yaw: v.yaw - dx * .004, pitch: Math.max(-1.2, Math.min(1.2, v.pitch + dy * .004)) })) }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
    <Canvas camera={{ position: overview.position, fov: 44, near: .05 }} dpr={[1, 1.5]} frameloop="demand">
      <color attach="background" args={['#07111f']} />
      {!active && !props.config.seatingLevels?.length && <fog attach="fog" args={['#07111f', 24, 48]} />}
      <ambientLight intensity={detailNotice ? .8 : .65} color={detailNotice ? '#ffe5cc' : '#ffffff'} />
      <directionalLight position={[4, 12, 8]} intensity={detailNotice ? 1.7 : 2.4} color={detailNotice ? '#ffdfb0' : '#e6fff8'} />
      {detailNotice && <pointLight position={[0, 10, 0]} intensity={100} distance={40} decay={2} color="#ffd9ad" />}
      <Suspense fallback={null}>
        <VenueModel {...props} interior={active} onSeatSelect={active ? () => {} : (seat) => { setLook({ yaw: 0, pitch: 0 }); props.onSeatSelect(seat) }} />
        <Environment key={detailNotice ? 'warm' : 'neutral'} resolution={128} frames={1}><Lightformer position={[0, 14, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 16, 1]} intensity={2} color={detailNotice ? '#ffe1bc' : '#e6fff8'} /><Lightformer position={[0, 3, -12]} scale={[10, 8, 1]} intensity={1.5} color="#d7dfe4" /></Environment>
        <ContactShadows key={JSON.stringify([props.config, props.importedModel?.uuid])} position={[0, -1.35, 2]} opacity={0.42} scale={30} blur={2.5} frames={1} />
      </Suspense>
      <SeatCamera view={active ? seatView : null} yaw={props.reviewCamera?.yaw ?? look.yaw} pitch={props.reviewCamera?.pitch ?? look.pitch} fov={props.reviewCamera?.fov ?? 65} overview={overview} />
      {!active && <OrbitControls makeDefault target={overview.target} minDistance={8} maxDistance={100} maxPolarAngle={Math.PI / 2.04} />}
    </Canvas>
    </div>
    {(active || props.config.studyNotice || detailNotice) && <p className="seat-view-disclaimer">{detailNotice ?? props.config.studyNotice ?? 'Approximate view of the current model. Missing structures, spectators and event equipment are not represented.'}</p>}
    </div>
  )
}

function SeatCamera({ view, yaw, pitch, fov, overview }: { fov: number; view: ReturnType<typeof getSeatView>; yaw: number; pitch: number; overview: ReturnType<typeof overviewPose> }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    if (view) {
      camera.position.set(...view.position)
      const direction = lookDirection(view.yaw + yaw, view.pitch + pitch)
      camera.lookAt(view.position[0] + direction[0], view.position[1] + direction[1], view.position[2] + direction[2])
      camera.fov = fov
    } else { camera.position.set(...overview.position); camera.lookAt(...overview.target); camera.fov = 44 }
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, view, yaw, pitch, fov, overview])
  return null
}
