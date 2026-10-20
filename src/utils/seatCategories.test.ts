import { describe, expect, it } from 'vitest'
import { defaultVenue, type VenueConfig } from '../types/venue'
import { categorySummary, getCategories, removeCategory, seatCategory } from './seatCategories'
import { renderVenuePlanSvg } from './projectExport'

const venue: VenueConfig = { ...defaultVenue, geometry: 'straight', rows: 3, seatsPerRow: 5, categories: [{ id: 'standard', name: 'Standard', color: '#5be2c3', price: 10 }, { id: 'vip', name: 'VIP', color: '#aabbcc', price: 20 }], rowOverrides: { 0: { categoryId: 'vip', seatCategories: { 0: 'standard' }, accessibleSeats: { 0: true } } } }
describe('seat categories', () => {
  it('supports older projects without a migration', () => { expect(seatCategory(defaultVenue, 0, 0).id).toBe('standard'); expect(categorySummary(defaultVenue).revenue).toBe(0) })
  it('prioritises individual assignments and inherits rows', () => { expect(seatCategory(venue, 0, 0).id).toBe('standard'); expect(seatCategory(venue, 0, 1).id).toBe('vip') })
  it('counts seats, accessible properties and revenue independently', () => { const result = categorySummary(venue); expect(result.counts.map((c) => c.count)).toEqual([11, 4]); expect(result.revenue).toBe(190); expect(result.accessible).toBe(1); expect(result.unpriced).toBe(0) })
  it('reassigns removed categories to standard without losing accessibility', () => { const next = { ...venue, ...removeCategory(venue, 'vip') }; expect(seatCategory(next, 0, 1).id).toBe('standard'); expect(categorySummary(next).accessible).toBe(1) })
  it('ignores assignments outside existing rows and seats', () => { expect(categorySummary({ ...venue, rows: 1, seatsPerRow: 1 }).revenue).toBe(10) })
  it('normalizes invalid colors and prices', () => { const c = getCategories({ ...venue, categories: [{ id: 'bad', name: 'Bad', color: '" onload="alert(1)', price: -5 }] })[1]; expect(c.color).toBe('#5be2c3'); expect(c.price).toBeUndefined() })
  it('preserves assignments on JSON roundtrip', () => { expect(categorySummary(JSON.parse(JSON.stringify(venue)))).toEqual(categorySummary(venue)) })
  it('renders category colors in exported plans', () => { expect(renderVenuePlanSvg(venue)).toContain('fill="#aabbcc"') })
})
