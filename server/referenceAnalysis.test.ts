import { expect, it, vi } from 'vitest'
import { analyseReferences, parseAnalysisFiles } from './referenceAnalysis'
const file = { id: 'plan', name: 'plan.pdf', caption: '', mime: 'application/pdf', data: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7 test').toString('base64') }
it('rejects URLs, mismatched bytes and too many files before calling the provider', async () => {
  expect(() => parseAnalysisFiles([{ ...file, data: 'https://example.com/file' }])).toThrow()
  expect(() => parseAnalysisFiles([{ ...file, mime: 'image/png' }])).toThrow()
  const fetcher = vi.fn()
  await expect(analyseReferences({ files: Array(5).fill(file) }, { apiKey: 'test', model: 'test' }, fetcher)).rejects.toThrow()
  expect(fetcher).not.toHaveBeenCalled()
})
it('sends embedded PDF input and validates the returned report', async () => {
  const analysis = { summary: 'Need clearer plan', findings: [], questions: ['What is the scale?'] }
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', name: 'report_reference_findings', arguments: JSON.stringify(analysis) }] })))
  expect(await analyseReferences({ files: [file] }, { apiKey: 'test', model: 'test' }, fetcher)).toEqual({ analysis })
  const init = (fetcher.mock.calls as unknown as [string, RequestInit][])[0][1]
  const body = JSON.parse(String(init.body))
  expect(body.store).toBe(false)
  expect(body.input[0].content[1].file_data).toBe(file.data)
})
it('does not expose provider error bodies', async () => {
  await expect(analyseReferences({ files: [file] }, { apiKey: 'test', model: 'test' }, async () => new Response('private detail', { status: 500 }))).rejects.toThrow('rejected (500)')
})
