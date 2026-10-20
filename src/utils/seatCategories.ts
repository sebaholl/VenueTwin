import type { SeatCategory, VenueConfig } from '../types/venue'
import { generateSeatLayout } from './venue'

export const standardCategory: SeatCategory = { id: 'standard', name: 'Standard', color: '#5be2c3' }
export function getCategories(config: VenueConfig): SeatCategory[] {
  const valid = Array.isArray(config.categories) ? config.categories.filter((c) => c && typeof c.id === 'string' && c.id !== 'standard' && typeof c.name === 'string') : []
  const standard = config.categories?.find?.((c) => c?.id === 'standard')
  return [standard && typeof standard.name === 'string' ? standard : standardCategory, ...valid].map((c) => ({
    ...c, color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#5be2c3',
    price: typeof c.price === 'number' && Number.isFinite(c.price) && c.price >= 0 ? c.price : undefined,
  }))
}
export function seatCategory(config: VenueConfig, row: number, seat: number) {
  const override = config.rowOverrides?.[row]
  const id = override?.seatCategories?.[seat] ?? override?.categoryId ?? 'standard'
  const categories = getCategories(config)
  return categories.find((c) => c.id === id) ?? categories[0]
}
export function categorySummary(config: VenueConfig) {
  const counts = getCategories(config).map((category) => ({ ...category, count: 0 }))
  let accessible = 0
  for (const seat of generateSeatLayout(config)) {
    const category = seatCategory(config, seat.row, seat.seat)
    counts.find((c) => c.id === category.id)!.count++
    if (config.rowOverrides?.[seat.row]?.accessibleSeats?.[seat.seat]) accessible++
  }
  return { counts, accessible, unpriced: counts.reduce((n, c) => n + (c.price === undefined ? c.count : 0), 0), revenue: counts.reduce((n, c) => n + Math.round((c.price ?? 0) * 100) * c.count, 0) / 100 }
}
export function removeCategory(config: VenueConfig, id: string): Partial<VenueConfig> {
  return { categories: getCategories(config).filter((c) => c.id !== id), rowOverrides: Object.fromEntries(Object.entries(config.rowOverrides ?? {}).map(([row, value]) => [row, {
    ...value, categoryId: value.categoryId === id ? 'standard' : value.categoryId,
    seatCategories: Object.fromEntries(Object.entries(value.seatCategories ?? {}).map(([seat, category]) => [seat, category === id ? 'standard' : category])),
  }])) }
}
