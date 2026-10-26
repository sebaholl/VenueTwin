import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Color, Euler, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { LoadedProduction } from '../lib/productionAssets'
import type { ProductionSeat } from '../utils/productionViewer'

type Props = { loaded: LoadedProduction; selected: ProductionSeat | null; inside: boolean; onSelect: (seat: ProductionSeat) => void; onExit: () => void; onReady: () => void; onFailure: () => void }
function Chairs({ loaded, seats, selected, onSelect }: { loaded: LoadedProduction; seats: ProductionSeat[]; selected: string | undefined; onSelect: Props['onSelect'] }) {
  const bases = useRef<InstancedMesh>(null), backs = useRef<InstancedMesh>(null), leftArms = useRef<InstancedMesh>(null), rightArms = useRef<InstancedMesh>(null)
  const upholstery = useMemo(() => {
    let map: MeshStandardMaterial['map'] = null
    loaded.model.traverse(object => {
      if (map || !(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      const velvet = materials.find(material => material.name === 'velvet')
      if (velvet instanceof MeshStandardMaterial) map = velvet.map
    })
    return map
  }, [loaded])
  useLayoutEffect(() => {
    for (const [i, seat] of seats.entries()) {
      const place = (ref: InstancedMesh, x: number, y: number, z: number) => {
        const part = new Object3D(); part.position.set(...seat.position); part.rotation.y = seat.yaw
        part.translateX(x); part.translateY(y); part.translateZ(z); part.updateMatrix()
        ref.setMatrixAt(i, part.matrix)
      }
      place(bases.current!, 0, .19, -.04)
      place(backs.current!, 0, .48, .19)
      place(leftArms.current!, -.27, .29, -.02)
      place(rightArms.current!, .27, .29, -.02)
      const color = new Color(seat.id === selected ? '#efb980' : upholstery ? '#ffffff' : '#852e43')
      bases.current!.setColorAt(i, color); backs.current!.setColorAt(i, color)
    }
    for (const ref of [bases, backs, leftArms, rightArms]) {
      ref.current!.instanceMatrix.needsUpdate = true
      if (ref.current!.instanceColor) ref.current!.instanceColor.needsUpdate = true
      ref.current!.computeBoundingSphere()
    }
  }, [seats, selected, upholstery])
  const pick = (event: ThreeEvent<MouseEvent>) => { if (event.instanceId !== undefined && event.delta < 6) { event.stopPropagation(); onSelect(seats[event.instanceId]) } }
  return <><instancedMesh ref={bases} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.47, .14, .44]} /><meshStandardMaterial map={upholstery} roughness={.9} /></instancedMesh><instancedMesh ref={backs} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.47, .58, .11]} /><meshStandardMaterial map={upholstery} roughness={.92} /></instancedMesh><instancedMesh ref={leftArms} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.07, .16, .48]} /><meshStandardMaterial color="#59402e" roughness={.48} /></instancedMesh><instancedMesh ref={rightArms} args={[undefined, undefined, seats.length]} onClick={pick}><boxGeometry args={[.07, .16, .48]} /><meshStandardMaterial color="#59402e" roughness={.48} /></instancedMesh></>
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
      camera.position.copy(middle).add(new Vector3(size * .38, size * .34, size * .43))
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
function ModelCutaway({ loaded, inside }: Pick<Props, 'loaded' | 'inside'>) {
  const { invalidate } = useThree()
  useEffect(() => {
    loaded.model.traverse(object => { if (object.userData.venueTwinShell === true) object.visible = inside })
    invalidate()
    return () => { loaded.model.traverse(object => { if (object.userData.venueTwinShell === true) object.visible = true }) }
  }, [loaded, inside, invalidate])
  return <primitive object={loaded.model} dispose={null} />
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
      <color attach="background" args={['#17131b']} />
      <ambientLight intensity={.75} /><hemisphereLight args={['#ffe7c0', '#291820', 1.25]} /><directionalLight position={[0, 14, 2]} color="#ffe2ab" intensity={2.2} /><spotLight position={[0, 9, -1]} color="#ffe8cb" intensity={90} angle={.65} penumbra={.65} distance={30} />
      <ModelCutaway loaded={props.loaded} inside={props.inside} />
      <Chairs loaded={props.loaded} seats={props.loaded.manifest.seats} selected={props.selected?.id} onSelect={props.onSelect} />
      <CameraRig {...props} look={look} />
    </Canvas>
    {props.inside && <button className="managed-reset" onClick={() => setLook([0, 0])}>Face stage</button>}
  </div>
}
