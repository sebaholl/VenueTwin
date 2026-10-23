import type { ProjectReferences } from '../lib/projectReferences'

export function pilotInputStatus(references: ProjectReferences, reviewedFindings: number) {
  const plans = references.assets.filter((asset) => asset.kind === 'plan').length
  const photos = references.assets.filter((asset) => asset.kind === 'photo').length
  const measured = references.measurements.filter((item) => item.confidence === 'measured').length
  const estimates = references.measurements.filter((item) => item.confidence === 'estimated').length
  const missingForSourceDraft = [
    ...(plans ? [] : ['a floor plan or measured drawing']),
    ...(measured ? [] : ['at least one measured dimension']),
  ]
  return { plans, photos, measured, estimates, reviewedFindings, missingForSourceDraft }
}
