import { describe, expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { generateAutoLayout } from './autoLayout'

const rectangle = [{ x: 250, y: 170 }, { x: 750, y: 170 }, { x: 750, y: 530 }, { x: 250, y: 530 }]

describe('auto layout', () => {
  it('fills a rectangular boundary with rows and seats', () => {
    const result = generateAutoLayout({ ...defaultVenue, planBoundary: rectangle })
    expect(result.rows).toBeGreaterThan(10)
    expect(result.capacity).toBeGreaterThan(200)
  })

  it('reserves more horizontal space when aisles are wider', () => {
    const narrow = generateAutoLayout({ ...defaultVenue, planBoundary: rectangle, aisleWidth: 0.5 })
    const wide = generateAutoLayout({ ...defaultVenue, planBoundary: rectangle, aisleWidth: 2 })
    expect(wide.capacity).toBeLessThan(narrow.capacity)
  })

  it('aligns generated rows with the stage rotation', () => {
    const result = generateAutoLayout({ ...defaultVenue, planBoundary: rectangle, stagePosition: { offsetX: 0, offsetY: 0, rotation: 15 } })
    expect(result.rowOverrides[0].rotation).toBe(15)
  })
})
