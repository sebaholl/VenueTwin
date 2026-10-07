import type { PlanCalibration, PlanPoint } from '../types/venue'

export function planScale(calibration: PlanCalibration | null | undefined) {
  if (!calibration || !Number.isFinite(calibration.meters) || !Number.isFinite(calibration.pixels) || calibration.meters <= 0 || calibration.pixels < 2) return 24
  const scale = calibration.pixels / calibration.meters
  return Number.isFinite(scale) && scale >= .002 && scale <= 10000 ? scale : 24
}
export function calibratePlan(points: PlanPoint[], meters: number): PlanCalibration | null {
  if (points.length !== 2 || !Number.isFinite(meters) || meters < .01 || meters > 1000 || points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return null
  const pixels = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
  if (pixels < 2 || pixels / meters > 10000) return null
  return { pixels, meters }
}
