import type { VenueConfig } from '../types/venue'
export function stageGeometry(config: VenueConfig) {
  const depth = config.stageDepth ?? 2.2
  const height = config.screenHeight ?? 4.6
  const bottom = config.screenBottom ?? .4
  return { depth, width: config.screenWidth ?? config.stageWidth * .84, height, bottom, screenY: bottom + height / 2, screenZ: config.stageDepth === undefined ? -3.25 : -2.2 - depth / 2 + .05 }
}
export const customStageGeometry = (config: VenueConfig) => [config.stageDepth, config.screenWidth, config.screenHeight, config.screenBottom].some((v) => v !== undefined)
