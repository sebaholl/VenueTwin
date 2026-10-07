import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { SeatRef } from '../types/venue'
import type { PositionedSeat } from '../utils/venue'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// Seven instanced parts, rather than seven draw calls for every seat.
const parts = [
  { size: [.5, .68, .1], offset: [0, .35, .16], fabric: false },
  { size: [.43, .57, .105], offset: [0, .36, .095], fabric: true },
  { size: [.44, .13, .43], offset: [0, .16, -.065], fabric: true },
  ...[-1, 1].flatMap((side) => [
    { size: [.055, .08, .5], offset: [side * .245, .24, -.025], fabric: false },
    { size: [.045, .39, .06], offset: [side * .18, -.045, 0], fabric: false },
  ]),
]
type Props = { seats: PositionedSeat[]; selectedSeat: SeatRef | null; onSeatSelect: (seat: SeatRef) => void }

function SeatPart({ seats, selectedSeat, onSeatSelect, part }: Props & { part: typeof parts[number] }) {
  const ref = useRef<InstancedMesh>(null)
  const matrix = useMemo(() => new Matrix4(), [])
  const geometry = useMemo(() => new RoundedBoxGeometry(1, 1, 1, 2, .08), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const local = new Matrix4().makeTranslation(...part.offset as [number, number, number])
    local.scale(new Vector3(...part.size))
    const axis = new Vector3(0, 1, 0), rotation = new Quaternion(), scale = new Vector3(1, 1, 1)
    seats.forEach((seat, i) => {
      matrix.compose(new Vector3(...seat.position), rotation.setFromAxisAngle(axis, seat.rotation), scale).multiply(local)
      mesh.setMatrixAt(i, matrix)
      mesh.setColorAt(i, new Color(part.fabric ? selectedSeat?.label === seat.label ? '#ff7a59' : '#761a2c' : '#241819'))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [seats, selectedSeat, part, matrix])
  return <instancedMesh ref={ref} args={[undefined, undefined, seats.length]} onClick={(event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    if (event.delta <= 6 && event.instanceId !== undefined && seats[event.instanceId]) onSeatSelect(seats[event.instanceId])
  }} geometry={geometry}><meshStandardMaterial roughness={part.fabric ? .92 : .5} /></instancedMesh>
}

export function DetailedSeats(props: Props) {
  return <group>{parts.map((part, i) => <SeatPart key={`${i}-${props.seats.length}`} {...props} part={part} />)}</group>
}
