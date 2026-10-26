import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Color, Euler, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Quaternion, Vector3 } from 'three'
import type { LoadedProduction } from '../lib/productionAssets'
import type { ProductionSeat } from '../utils/productionViewer'
import chairSpec from '../../venue-data/lantern-opera-house/chair-spec.json'

type Props = { loaded: LoadedProduction; selected: ProductionSeat | null; inside: boolean; onSelect: (seat: ProductionSeat) => void; onExit: () => void; onReady: () => void; onFailure: () => void }
function Chairs({ loaded, seats, selected, onSelect }: { loaded: LoadedProduction; seats: ProductionSeat[]; selected: string | undefined; onSelect: Props['onSelect'] }) {
  const parts = useRef<(InstancedMesh | null)[]>([])
  const textures = useMemo(() => {
    const maps: Record<string, MeshStandardMaterial['map']> = {}
    loaded.model.traverse(object => {
      if (!(object instanceof Mesh)) return
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of materials) if (material instanceof MeshStandardMaterial && material.map && !maps[material.name]) maps[material.name] = material.map
    })
    return maps
  }, [loaded])
  useLayoutEffect(() => {
    const placement = new Object3D()
    for (const [partIndex, part] of chairSpec.parts.entries()) {
      const mesh = parts.current[partIndex]
      if (!mesh) continue
      for (const [i, seat] of seats.entries()) {
        placement.position.set(...seat.position)
        placement.rotation.set(0, seat.yaw, 0)
        placement.scale.set(1, 1, 1)
        placement.translateX(part.centre[0]); placement.translateY(part.centre[1]); placement.translateZ(part.centre[2])
        placement.updateMatrix()
        mesh.setMatrixAt(i, placement.matrix)
        mesh.setColorAt(i, new Color(seat.id === selected ? '#efb980' : '#ffffff'))
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [seats, selected])
  const pick = (event: ThreeEvent<MouseEvent>) => { if (event.instanceId !== undefined && event.delta < 6) { event.stopPropagation(); onSelect(seats[event.instanceId]) } }
  return <>{chairSpec.parts.map((part, i) => <instancedMesh key={i} ref={node => { parts.current[i] = node }} args={[undefined, undefined, seats.length]} onClick={pick} castShadow receiveShadow>
    <boxGeometry args={[part.size[0], part.size[1], part.size[2]]} />
    <meshStandardMaterial map={textures[part.material] ?? null} color={part.material === 'wood' && !textures.wood ? '#35251f' : part.material === 'velvet' && !textures.velvet ? '#852e43' : '#ffffff'} roughness={part.material === 'wood' ? .48 : .92} />
  </instancedMesh>)}</>
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
    loaded.model.traverse(object => {
      if (object.userData.venueTwinShell === true) object.visible = inside
      if (object instanceof Mesh) { object.castShadow = true; object.receiveShadow = true }
    })
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
    <Canvas frameloop="demand" shadows dpr={[1, 1.5]} camera={{ near: .05, far: 2000 }} fallback={<p role="alert">3D is unavailable. Use the seat map below.</p>}>
      <color attach="background" args={['#17131b']} />
      <ambientLight intensity={.35} /><hemisphereLight args={['#ffe7c0', '#291820', .65]} />
      <directionalLight position={[0, 14, 2]} color="#ffe2ab" intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-22} shadow-camera-right={22} shadow-camera-top={22} shadow-camera-bottom={-22} shadow-camera-near={.5} shadow-camera-far={45} shadow-bias={-.0002} />
      <spotLight position={[0, 9, -1]} color="#ffe8cb" intensity={90} angle={.65} penumbra={.65} distance={30} />
      <ModelCutaway loaded={props.loaded} inside={props.inside} />
      <Chairs loaded={props.loaded} seats={props.loaded.manifest.seats} selected={props.selected?.id} onSelect={props.onSelect} />
      <CameraRig {...props} look={look} />
    </Canvas>
    {props.inside && <button className="managed-reset" onClick={() => setLook([0, 0])}>Face stage</button>}
  </div>
}
