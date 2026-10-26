import * as THREE from 'three'

// The official capacity is 241 stalls seats. This row split and every position below
// are authored estimates for visual study, not official numbering or a seat survey.
export const STUDY_ROW_COUNTS = [14, 16, 17, 18, 19, 20, 21, 21, 21, 20, 19, 18, 17]
export type StudySeat = { id: string; label: string; eye: THREE.Vector3 }

type Piece = { material: THREE.MeshStandardMaterial; offset: [number, number, number]; size: [number, number, number]; side?: boolean }

export function buildRedutaStudySeats(model: THREE.Object3D): { group: THREE.Group; seats: StudySeat[] } {
  const stageX = 13.75
  const stageZ = -23.5
  const ray = new THREE.Raycaster()
  const navy = new THREE.MeshStandardMaterial({ color: 0x151d39, roughness: 0.88 })
  const maple = new THREE.MeshStandardMaterial({ color: 0xc9a46e, roughness: 0.72 })
  const frame = new THREE.MeshStandardMaterial({ color: 0x777a7c, metalness: 0.45, roughness: 0.55 })
  const parts: Piece[] = [
    { material: maple, offset: [0, .77, .18], size: [.46, .67, .055] },
    { material: navy, offset: [0, .79, .12], size: [.42, .60, .11] },
    { material: maple, offset: [0, .41, -.09], size: [.46, .07, .44] },
    { material: navy, offset: [0, .47, -.09], size: [.42, .09, .40] },
    { material: maple, offset: [.26, .61, -.04], size: [.055, .075, .41], side: true },
    { material: frame, offset: [.22, .22, .15], size: [.035, .44, .035], side: true },
  ]
  const group = new THREE.Group()
  group.name = 'Photo-guided inferred stalls seating — not surveyed'
  const count = STUDY_ROW_COUNTS.reduce((sum, value) => sum + value, 0)
  if (count !== 241) throw new Error('The authored Reduta stalls study must contain 241 visual seats')
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const batches = parts.map((part, index) => {
    const mesh = new THREE.InstancedMesh(geometry, part.material, count * (part.side ? 2 : 1))
    mesh.name = `Inferred Reduta seat part ${index + 1}`
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
    return mesh
  })
  const dummy = new THREE.Object3D()
  const seats: StudySeat[] = []
  const yAxis = new THREE.Vector3(0, 1, 0)
  let index = 0
  for (let row = 0; row < STUDY_ROW_COUNTS.length; row++) {
    const countInRow = STUDY_ROW_COUNTS[row]
    const rowZ = -18.42 + row * .79
    ray.set(new THREE.Vector3(stageX, 4.4, rowZ), new THREE.Vector3(0, -1, 0))
    const floor = ray.intersectObject(model, true).find(hit => hit.point.y < 4.1 && hit.point.y > -.8)?.point.y
    if (floor === undefined) throw new Error(`No imported floor below inferred row ${row + 1}`)
    for (let number = 0; number < countInRow; number++) {
      const x = stageX + (number - (countInRow - 1) / 2) * .51
      const z = rowZ + .017 * (x - stageX) ** 2
      const yaw = Math.atan2(x - stageX, z - stageZ)
      const origin = new THREE.Vector3(x, floor, z)
      const rotation = new THREE.Quaternion().setFromAxisAngle(yAxis, yaw)
      parts.forEach((part, partIndex) => {
        for (let side = 0; side < (part.side ? 2 : 1); side++) {
          const offset = new THREE.Vector3(part.offset[0] * (side ? -1 : 1), part.offset[1], part.offset[2]).applyQuaternion(rotation)
          dummy.position.copy(origin).add(offset)
          dummy.quaternion.copy(rotation)
          dummy.scale.set(...part.size)
          dummy.updateMatrix()
          batches[partIndex].setMatrixAt(index * (part.side ? 2 : 1) + side, dummy.matrix)
        }
      })
      seats.push({ id: `study-r${String(row + 1).padStart(2, '0')}-s${String(number + 1).padStart(2, '0')}`, label: `Estimated row ${row + 1}, seat ${number + 1}`, eye: new THREE.Vector3(x, floor + 1.16, z) })
      index++
    }
  }
  batches.forEach(mesh => { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere() })
  return { group, seats }
}
