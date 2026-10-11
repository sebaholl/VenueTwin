import { expect, it } from 'vitest'
import { defaultVenue } from '../types/venue'
import { layoutChecks } from './layoutChecks'
const base = { ...defaultVenue, geometry: 'straight' as const, rows: 2, seatsPerRow: 2, sectors: 1, rake: 0, curve: 0 }
it('detects coincident rows without changing the project', () => {
  const config = { ...base, rowOverrides: { 1: { offsetY: -.92 } } }
  const before = JSON.stringify(config)
  expect(layoutChecks(config).find((f) => f.id === 'seat-overlap')?.count).toBe(2)
  expect(JSON.stringify(config)).toBe(before)
})
it('does not flag vertically separated balcony seats', () => {
  expect(layoutChecks({ ...base, rowOverrides: { 1: { offsetY: -.92, elevation: 3 } } }).some((f) => f.id === 'seat-overlap')).toBe(false)
})
it('detects stage intersection and excludes seats above its volume', () => {
  expect(layoutChecks({ ...base, rowOverrides: { 0: { offsetY: -2.2 } } }).find((f) => f.id === 'stage-overlap')?.count).toBe(2)
  expect(layoutChecks({ ...base, rowOverrides: { 0: { offsetY: -2.2, elevation: 2 } } }).some((f) => f.id === 'stage-overlap')).toBe(false)
})
it('keeps ordinary layouts clear and labels defaults without treating configured values as verified', () => {
  expect(layoutChecks(base).filter((f) => f.severity === 'warning')).toEqual([])
  expect(layoutChecks(base).some((f) => f.id === 'default-dimensions')).toBe(true)
  expect(layoutChecks({ ...base, stageDepth: 2.2, screenWidth: 9, screenHeight: 4, screenBottom: .4 }).some((f) => f.id === 'default-dimensions')).toBe(false)
})
it('caps examples while counting all intersections', () => {
  const result = layoutChecks({ ...base, seatsPerRow: 20, rowOverrides: { 1: { offsetY: -.92 } } }).find((f) => f.id === 'seat-overlap')!
  expect(result.count).toBe(20)
  expect(result.examples).toHaveLength(8)
})
it('handles rotated seats and stage geometry', () => {
  const config = { ...base, rows: 1, stagePosition: { offsetX: 0, offsetY: 0, rotation: 90 }, rowOverrides: { 0: { rotation: 90, offsetX: -2.2 } } }
  expect(layoutChecks(config).find((f) => f.id === 'stage-overlap')?.count).toBe(2)
})
