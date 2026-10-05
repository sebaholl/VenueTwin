import { ContactShadows, Environment, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { PerspectiveCamera } from 'three'
import { getSeatView, lookDirection, modelOffset } from '../utils/seatView'
import type { SeatRef, VenueConfig } from '../types/venue'
import { seatCategory } from '../utils/seatCategories'
import { generateSeatLayout } from '../utils/venue'

type SceneProps = {
  config: VenueConfig
  selectedSeat: SeatRef | null
  onSeatSelect: (seat: SeatRef) => void
}

function VenueModel({ config, selectedSeat, onSeatSelect }: SceneProps) {
  const seats = useMemo(() => generateSeatLayout(config), [config])
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const stageRotation = stage.rotation * Math.PI / 180

  return (
    <group position={modelOffset}>
      <group position={[stage.offsetX, 0, stage.offsetY]} rotation={[0, stageRotation, 0]}>
        <RoundedBox args={[config.stageWidth, 0.45, 2.2]} radius={0.12} position={[0, 0, -2.2]}>
          <meshStandardMaterial color="#17243a" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 2.7, -3.25]}>
          <planeGeometry args={[config.stageWidth * 0.84, 4.6]} />
          <meshStandardMaterial color="#e8f0f3" emissive="#19304b" emissiveIntensity={0.16} />
        </mesh>
        <Text position={[0, 2.7, -3.18]} fontSize={0.42} color="#07111f" anchorX="center">VENUE TWIN</Text>
      </group>
      {seats.map((seat) => {
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, config.rows * 0.5]}>
        <planeGeometry args={[26, 28]} />
        <meshStandardMaterial color="#0c1725" roughness={0.9} />
      </mesh>
    </group>
  )
}

export function VenueScene(props: SceneProps) {
  const [requested, setRequested] = useState(false)
  const [look, setLook] = useState({ yaw: 0, pitch: 0 })
  const [eyeHeight, setEyeHeight] = useState(1.15)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const seatView = useMemo(() => getSeatView(props.config, props.selectedSeat, eyeHeight), [props.config, props.selectedSeat, eyeHeight])
  const active = requested && !!seatView
  return (
    <div className={`venue-scene ${active ? 'seat-view-active' : ''}`}>
    <div className="seat-view-toolbar">
      <button type="button" disabled={!seatView} aria-pressed={active} onClick={() => { setRequested(!active); setLook({ yaw: 0, pitch: 0 }) }}>{active ? 'Back to overview' : 'View from seat'}</button>
      {active && <><button type="button" onClick={() => setLook({ yaw: 0, pitch: 0 })}>Face stage</button><label>Eye height <select value={eyeHeight} onChange={(e) => setEyeHeight(Number(e.target.value))}><option value={.95}>0.95 m</option><option value={1.15}>1.15 m</option><option value={1.35}>1.35 m</option></select></label></>}
      <span>{active ? `Seat ${props.selectedSeat?.label} · Drag or use arrow keys to look around · Esc to exit` : 'Select a seat to preview its view'}</span>
    </div>
    <div className="venue-scene-canvas" tabIndex={active ? 0 : -1} role="group" aria-label={active ? 'Seat view. Drag or use arrow keys to look around. Escape returns to overview.' : 'Venue overview'}
      onKeyDown={(e) => { if (!active) return; if (e.key === 'Escape') { setRequested(false); return } const keys: Record<string, [number, number]> = { ArrowLeft: [-.08, 0], ArrowRight: [.08, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }; const delta = keys[e.key]; if (delta) { e.preventDefault(); setLook((v) => ({ yaw: v.yaw + delta[0], pitch: Math.max(-1.2, Math.min(1.2, v.pitch + delta[1])) })) } }}
      onPointerDown={(e) => { if (!active || !e.isPrimary || e.button !== 0) return; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY } }}
      onPointerMove={(e) => { if (!active || !drag.current || !e.isPrimary) return; const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y; drag.current = { x: e.clientX, y: e.clientY }; setLook((v) => ({ yaw: v.yaw - dx * .004, pitch: Math.max(-1.2, Math.min(1.2, v.pitch + dy * .004)) })) }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
    <Canvas camera={{ position: [11, 11, 18], fov: 44, near: .05 }} dpr={[1, 1.6]}>
      <color attach="background" args={['#07111f']} />
      {!active && <fog attach="fog" args={['#07111f', 24, 48]} />}
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 12, 8]} intensity={2.4} color="#e6fff8" />
      <Suspense fallback={null}>
        <VenueModel {...props} onSeatSelect={active ? () => {} : (seat) => { setLook({ yaw: 0, pitch: 0 }); props.onSeatSelect(seat) }} />
        <Environment preset="city" />
        <ContactShadows position={[0, -1.35, 2]} opacity={0.42} scale={30} blur={2.5} />
      </Suspense>
      <SeatCamera view={active ? seatView : null} yaw={look.yaw} pitch={look.pitch} />
      {!active && <OrbitControls makeDefault target={[0, 1.7, 2]} minDistance={8} maxDistance={32} maxPolarAngle={Math.PI / 2.04} />}
    </Canvas>
    </div>
    {active && <p className="seat-view-disclaimer">Approximate view of the current model. Missing structures, spectators and event equipment are not represented.</p>}
    </div>
  )
}

function SeatCamera({ view, yaw, pitch }: { view: ReturnType<typeof getSeatView>; yaw: number; pitch: number }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    if (view) {
      camera.position.set(...view.position)
      const direction = lookDirection(view.yaw + yaw, view.pitch + pitch)
      camera.lookAt(view.position[0] + direction[0], view.position[1] + direction[1], view.position[2] + direction[2])
      camera.fov = 65
    } else { camera.position.set(11, 11, 18); camera.lookAt(0, 1.7, 2); camera.fov = 44 }
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, view, yaw, pitch])
  return null
}
