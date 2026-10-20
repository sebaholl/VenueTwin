import { expect, it } from 'vitest'
import { acceptedFindings, parseReferenceAnalysis, type Finding } from './referenceAnalysis'
const sources = [{ id: 'plan', name: 'plan.pdf', mime: 'application/pdf', hash: 'a'.repeat(64) }]
const finding: Finding = { sourceId: 'plan', page: 2, location: 'Stage', evidence: '11 m', kind: 'dimension', label: 'Stage width', value: 11, unit: 'm', statement: 'Printed width', basis: 'documented' }
const report = (f = finding) => ({ summary: 'Dimensions', findings: [f], questions: [] })
it('rejects fabricated sources and unsupported page references', () => {
  expect(() => parseReferenceAnalysis(report({ ...finding, sourceId: 'other' }), sources)).toThrow()
  expect(() => parseReferenceAnalysis(report(), [{ ...sources[0], mime: 'image/png' }])).toThrow()
})
it('never accepts a numeric uncertain result or fractional seat count', () => {
  expect(() => parseReferenceAnalysis(report({ ...finding, basis: 'uncertain' }), sources)).toThrow()
  expect(() => parseReferenceAnalysis(report({ ...finding, unit: 'count', value: 11.5 }), sources)).toThrow()
})
it('keeps inference labels and excludes removed sources', () => {
  const record = { analysis: report({ ...finding, basis: 'inferred' }), sources, accepted: [0] }
  expect(acceptedFindings(record, ['plan'])[0].basis).toBe('inferred')
  expect(acceptedFindings(record, [])).toEqual([])
})
