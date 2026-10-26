import * as THREE from 'three'

// Photo-guided material/lighting proxies. These are deliberately separate from
// the imported source model so they cannot be mistaken for surveyed geometry.
export function buildRedutaStudyFinishes(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Inferred photo-guided finishes and lights'
  const paleWood = new THREE.MeshStandardMaterial({ color: 0xc4a77c, roughness: .86 })
  const joint = new THREE.MeshStandardMaterial({ color: 0x9d876b, roughness: .9 })
  const stageBlack = new THREE.MeshStandardMaterial({ color: 0x171b22, roughness: .95 })
  const ceilingDark = new THREE.MeshStandardMaterial({ color: 0x262b32, roughness: .88 })
  const luminaire = new THREE.MeshStandardMaterial({ color: 0xfff0d2, emissive: 0xffe0a3, emissiveIntensity: 2.2 })
  const box = (size: [number, number, number], position: [number, number, number], material: THREE.MeshStandardMaterial) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
    mesh.position.set(...position)
    mesh.receiveShadow = true
    group.add(mesh)
  }
  // Light timber wall panels in the supplied auditorium images. Shell wall
  // location comes from the imported model; the panel grid is approximate.
  for (const x of [7.13, 21.38]) {
    box([.035, 5.0, 14.8], [x, 2.5, -14.0], paleWood)
    for (let z = -21; z <= -7; z += 1.4) box([.04, 5.0, .012], [x, 2.5, z], joint)
    for (let y = 1.25; y < 5; y += 1.25) box([.04, .012, 14.8], [x, y, -14.0], joint)
  }
  box([13.9, .055, 15.8], [14.25, 8.52, -14.25], ceilingDark)
  const disc = new THREE.CylinderGeometry(.105, .105, .035, 16)
  for (const x of [8.8, 11.5, 14.2, 16.9, 19.6]) {
    for (let z = -20.5; z < -7.5; z += 2.1) {
      const lamp = new THREE.Mesh(disc, luminaire)
      lamp.position.set(x, 8.47, z)
      group.add(lamp)
    }
  }
  // A neutral dark stage setup replaces the converter's bare grey technical
  // backstage. Temporary furniture or scenery from photos is not reconstructed.
  box([11.5, .035, 10.5], [13.75, .025, -29.0], stageBlack)
  box([11.5, 8.1, .055], [13.75, 4.05, -34.25], stageBlack)
  box([.09, 8.1, 10.5], [8.05, 4.05, -29.0], stageBlack)
  box([.09, 8.1, 10.5], [19.45, 4.05, -29.0], stageBlack)
  return group
}
