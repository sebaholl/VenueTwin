import { expect, it, vi } from 'vitest'
import { reviewedFindings, saveAnalysis, sourceFor } from './referenceAnalysis'
import type { ReferenceAsset } from './projectReferences'
it('invalidates accepted findings when source bytes or captions change', async () => {
  const cache = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => cache.get(key), setItem: (key: string, value: string) => cache.set(key, value) })
  try {
    const asset: ReferenceAsset = { id: 'p', kind: 'plan', name: 'p.pdf', caption: '', file: new Blob(['plan'], { type: 'application/pdf' }) }
    saveAnalysis('test', { sources: [await sourceFor(asset)], accepted: [0], analysis: { summary: 'Plan', questions: [], findings: [{ sourceId: 'p', page: 1, location: 'Stage', evidence: '11m', label: 'Width', kind: 'dimension', value: 11, unit: 'm', statement: 'Printed width', basis: 'documented' }] } })
    expect(await reviewedFindings('test', [asset])).toHaveLength(1)
    expect(await reviewedFindings('test', [{ ...asset, caption: 'Different source context' }])).toHaveLength(0)
    expect(await reviewedFindings('test', [{ ...asset, file: new Blob(['changed'], { type: 'application/pdf' }) }])).toHaveLength(0)
    expect(await reviewedFindings('test', [])).toHaveLength(0)
  } finally { vi.unstubAllGlobals() }
})
