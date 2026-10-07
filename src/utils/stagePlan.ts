import type { VenueConfig } from '../types/venue'
import { planScale } from './planScale'

// Matches the local stage centre at z=-2.2 in the Three.js scene and Blender export.
export function stagePlanPose(config: VenueConfig) {
  const stage = config.stagePosition ?? { offsetX: 0, offsetY: 0, rotation: 0 }
  const radians = stage.rotation * Math.PI / 180, scale = planScale(config.calibration)
  return { x: 500 + (stage.offsetX - Math.sin(radians) * 2.2) * scale, y: 150 + (stage.offsetY - Math.cos(radians) * 2.2) * scale, rotation: -stage.rotation }
}
