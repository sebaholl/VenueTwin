import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Color, Euler, InstancedMesh, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { LoadedProduction } from '../lib/productionAssets'
import type { ProductionSeat } from '../utils/productionViewer'

type Props = { loaded: LoadedProduction; selected: ProductionSeat | null; inside: boolean; onSelect: (seat: ProductionSeat) => void; onExit: () => void; onReady: () => void; onFailure: () => void }
function Chairs({ seats, selected, onSelect }: { seats: ProductionSeat[]; selected: string | undefined; onSelect: Props['onSelect'] }) {
  const bases = useRef<InstancedMesh>(null), backs = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    for (const [i, seat] of seats.entries()) {
      const base = new Object3D(); base.position.set(...seat.position); base.rotation.y = seat.yaw; base.updateMatrix()
      bases.current!.setMatrixAt(i, base.matrix)
      base.translateY(.25); base.translateZ(.19); base.updateMatrix()
      backs.current!.setMatrixAt(i, base.matrix)
      const color = new Color(seat.id === selected ? '#ffad78' : '#3cbda5')
      bases.current!.setColorAt(i, color); backs.current!.setColorAt(i, color)
    }
    for (const ref of [bases, backs]) {
      ref.current!.instanceMatrix.needsUpdate = true
      if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
      ref.current!.computeBoundingSphere()
    }
  }, [seats, selected])
  const pick = (event: ThreeEvent<MouseEvent>) => { if (event.instanceId !== undefined && event.delta < 6) { event.stopPropagation(); onSelect(seats[event.instanceId]) } }
  return <><instancedMesh ref={bases} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.44, .12, .44]} /><meshStandardMaterial roughness={.65} /></instancedMesh><instancedMesh ref={backs} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.44, .5, .1]} /><meshStandardMaterial roughness={.65} /></instancedMesh></>
}
function CameraRig({ loaded, selected, inside, look, onReady, onFailure }: Props & { look: [number, number] }) {
  const { camera, gl, invalidate } = useThree()
  const centre = loaded.bounds.getCenter(new Vector3()), size = Math.max(4, loaded.bounds.getSize(new Vector3()).length())
  const source = selected ? loaded.cameras.get(selected.id) : null
  useEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return
    if (inside && source) {
      camera.position.copy(source.getWorldPosition(new Vector3()))
      camera.quaternion.copy(source.getWorldQuaternion(new Quaternion())).multiply(new Quaternion().setFromEuler(new Euler(look[1], look[0], 0, 'YXZ')))
      camera.fov = source.fov; camera.near = .05; camera.far = 2000
    } else {
      const middle = loaded.bounds.getCenter(new Vector3())
      camera.position.copy(middle).add(new Vector3(size * .65, size * .55, size * .7))
      camera.lookAt(middle); camera.fov = 45; camera.near = .05; camera.far = 2000
    }
    camera.updateProjectionMatrix(); invalidate(); onReady()
  }, [camera, source, inside, loaded, size, look, invalidate, onReady])
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    gl.domElement.addEventListener('webglcontextlost', lost)
    return () => gl.domElement.removeEventListener('webglcontextlost', lost)
  }, [gl, onFailure])
  return inside ? null : <OrbitControls makeDefault target={centre} minDistance={1} maxDistance={size * 4} maxPolarAngle={Math.PI * .49} />
}
export function ProductionScene(props: Props) {
  const [look, setLook] = useState<[number, number]>([0, 0])
  const drag = useRef<[number, number] | null>(null)
  const region = useRef<HTMLDivElement>(null)
  useEffect(() => { setLook([0, 0]); if (props.inside) region.current?.focus({ preventScroll: true }) }, [props.selected?.id, props.inside])
  return <div className="managed-scene" ref={region} tabIndex={props.inside ? 0 : -1} aria-label={props.inside ? 'Seat view. Arrow keys or drag to look around. Escape returns to overview.' : 'Interactive auditorium'}
    onKeyDown={e => { if (!props.inside) return; if (e.key === 'Escape') props.onExit(); const delta: Record<string, [number, number]> = { ArrowLeft: [.08, 0], ArrowRight: [-.08, 0], ArrowUp: [0, .08], ArrowDown: [0, -.08] }; if (delta[e.key]) { e.preventDefault(); const [x, y] = delta[e.key]; setLook(([a, b]) => [a + x, Math.max(-1.2, Math.min(1.2, b + y))]) } }}
    onPointerDown={e => { if (props.inside && e.isPrimary && e.button === 0) { drag.current = [e.clientX, e.clientY]; e.currentTarget.setPointerCapture(e.pointerId) } }}
    onPointerMove={e => { if (!props.inside || !drag.current || !e.isPrimary) return; const [x, y] = drag.current; drag.current = [e.clientX, e.clientY]; setLook(([a, b]) => [a - (e.clientX - x) * .004, Math.max(-1.2, Math.min(1.2, b - (e.clientY - y) * .004))]) }}
    onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}>
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ near: .05, far: 2000 }} fallback={<p role="alert">3D is unavailable. Use the seat map below.</p>}>
      <color attach="background" args={['#101f28']} />
      <ambientLight intensity={1.4} /><hemisphereLight args={['#f0f5ff', '#596b6d', 2]} /><directionalLight position={[0, 12, 4]} intensity={2.5} />
      <primitive object={props.loaded.model} dispose={null} />
      <Chairs seats={props.loaded.manifest.seats} selected={props.selected?.id} onSelect={props.onSelect} />
      <CameraRig {...props} look={look} />
    </Canvas>
    {props.inside && <button className="managed-reset" onClick={() => setLook([0, 0])}>Face stage</button>}
  </div>
}
