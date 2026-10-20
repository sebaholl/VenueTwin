import type { VenueConfig } from '../types/venue'
import { parseViewerConfig } from './customerViewer'
type Level = NonNullable<VenueConfig['seatingLevels']>[number]

export function saveSeatingLevel(config: VenueConfig, level: Level): VenueConfig {
  const levels = config.seatingLevels ?? []
  const name = level.name.trim()
  if (!name || name.length > 80 || levels.some((item) => item.id !== level.id && item.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('Give each level a distinct name, up to 80 characters.')
  if (!level.id || level.id === '__main') throw new Error('Invalid level ID.')
  return parseViewerConfig({ ...config, seatingLevels: levels.some((item) => item.id === level.id) ? levels.map((item) => item.id === level.id ? { ...level, name } : item) : [...levels, { ...level, name }] })
}
export function assignRowRange(config: VenueConfig, first: number, last: number, levelId: string): VenueConfig {
  if (!Number.isInteger(first) || !Number.isInteger(last) || first < 0 || last >= config.rows || first > last) throw new Error('Choose a valid first and last row.')
  if (levelId && !config.seatingLevels?.some((level) => level.id === levelId)) throw new Error('Choose an existing level.')
  const rowOverrides = { ...config.rowOverrides }
  for (let row = first; row <= last; row++) rowOverrides[row] = { ...rowOverrides[row], levelId: levelId || undefined }
  return parseViewerConfig({ ...config, rowOverrides })
}
export function removeSeatingLevel(config: VenueConfig, id: string): VenueConfig {
  const level = config.seatingLevels?.find((item) => item.id === id)
  if (!level) throw new Error('This level no longer exists.')
  const rowOverrides = { ...config.rowOverrides }
  for (let row = 0; row < config.rows; row++) {
    const item = rowOverrides[row]
    if (item?.levelId === id) rowOverrides[row] = { ...item, levelId: undefined, elevation: level.elevation + (item.elevation ?? row * config.rake) }
  }
  return parseViewerConfig({ ...config, seatingLevels: config.seatingLevels?.filter((item) => item.id !== id), rowOverrides })
}
