import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { buildRedutaStudySeats } from './reduta-study-seats'

describe('Reduta photo-guided seating study', () => {
  it('places the authored 241 stalls positions on the imported floor and exposes unique eye views', () => {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 20), new THREE.MeshBasicMaterial())
    shell.position.set(13.75, -.1, -13)
    shell.updateMatrixWorld(true)
    const { seats, group } = buildRedutaStudySeats(shell)
    expect(seats).toHaveLength(241)
    expect(new Set(seats.map(seat => seat.id)).size).toBe(241)
    expect(seats.every(seat => Math.abs(seat.eye.y - 1.16) < .001)).toBe(true)
    expect(group.children).toHaveLength(6)
  })

  it('refuses to place seating when no shell floor is present', () => {
    expect(() => buildRedutaStudySeats(new THREE.Group())).toThrow('No imported floor')
  })
})
