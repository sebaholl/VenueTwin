import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import type { ArchitectureBox } from '../utils/levelGeometry'

function BoxInstances({ boxes, color }: { boxes: ArchitectureBox[]; color: string }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const object = new Object3D()
    boxes.forEach((box, index) => {
      object.position.set(box.position[0], box.position[1], box.position[2])
      object.rotation.set(0, box.rotation, 0)
      object.scale.set(box.size[0], box.size[1], box.size[2])
      object.updateMatrix(); mesh.current!.setMatrixAt(index, object.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [boxes])
  return <instancedMesh ref={mesh} args={[undefined, undefined, boxes.length]} onClick={(event) => event.stopPropagation()}><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color={color} roughness={boxes[0].roughness ?? .7} metalness={boxes[0].metalness ?? 0} /></instancedMesh>
}

export function LevelArchitecture({ boxes }: { boxes: ArchitectureBox[] }) {
  const groups = useMemo(() => {
    const result = new Map<string, ArchitectureBox[]>()
    boxes.forEach((box) => { const key = `${box.color}:${box.roughness ?? .7}:${box.metalness ?? 0}`; result.set(key, [...(result.get(key) ?? []), box]) })
    return [...result.entries()]
  }, [boxes])
  return <>{groups.map(([color, items]) => <BoxInstances key={`${color}-${items.length}`} color={items[0].color} boxes={items} />)}</>
}
