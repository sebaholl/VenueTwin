import { describe, expect, it } from 'vitest'
import { emptyReferences } from '../lib/projectReferences'
import { pilotInputStatus } from './pilotInputs'

describe('Pilot input status', () => {
  it('does not count estimates or accepted AI findings as measured dimensions', () => {
    const references = emptyReferences()
    references.measurements.push({ id: 'estimate', label: 'Room width', meters: 18, source: 'Photo estimate', confidence: 'estimated' })
    const status = pilotInputStatus(references, 2)
    expect(status.measured).toBe(0)
    expect(status.reviewedFindings).toBe(2)
    expect(status.missingForSourceDraft).toEqual(['a floor plan or measured drawing', 'at least one measured dimension'])
  })

  it('counts saved plans, photos and measured dimensions without claiming verified seat views', () => {
    const references = emptyReferences()
    references.assets = [
      { id: 'plan', kind: 'plan', name: 'plan.pdf', caption: '', file: new Blob(['plan'], { type: 'application/pdf' }) },
      { id: 'photo', kind: 'photo', name: 'stage.jpg', caption: '', file: new Blob(['photo'], { type: 'image/jpeg' }) },
    ]
    references.measurements.push({ id: 'width', label: 'Room width', meters: 18, source: 'Owner drawing', confidence: 'measured' })
    expect(pilotInputStatus(references, 0)).toMatchObject({ plans: 1, photos: 1, measured: 1, estimates: 0, missingForSourceDraft: [] })
  })
})
