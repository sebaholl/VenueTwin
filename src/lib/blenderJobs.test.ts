import { describe, expect, it, vi } from 'vitest'
import { defaultVenue } from '../types/venue'
import { geometrySignature } from '../utils/customerViewer'
import { buildLocalModel, assertBuildCurrent } from './blenderJobs'
const status = { id: 'job-id', state: 'completed', stage: 'Model ready', signature: geometrySignature(defaultVenue) }
const response = (value: unknown) => new Response(JSON.stringify(value))
describe('Studio build client', () => {
  it('downloads the model and carries its build signature into the import', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(status)).mockResolvedValueOnce(new Response('model-content'))
    const result = await buildLocalModel(defaultVenue, new AbortController().signal, vi.fn(), fetcher)
    expect(result.signature).toBe(status.signature)
    expect(result.file.name).toBe('venue-built.glb')
    expect(fetcher.mock.calls[1][0]).toBe('/api/blender/jobs/job-id/model')
  })
  it('rejects a result from different geometry', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ ...status, signature: 'different' })).mockResolvedValue(response({}))
    await expect(buildLocalModel(defaultVenue, new AbortController().signal, vi.fn(), fetcher)).rejects.toThrow('does not match')
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/model'))).toBe(false)
  })
  it('cancels a submitted job even if cancellation arrived before its ID', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(async () => { controller.abort(); return response({ ...status, state: 'running' }) }).mockResolvedValue(response({}))
    await expect(buildLocalModel(defaultVenue, controller.signal, vi.fn(), fetcher)).rejects.toThrow('Cancelled')
    expect(fetcher.mock.calls.at(-1)).toEqual(['/api/blender/jobs/job-id', { method: 'DELETE' }])
  })
  it('surfaces a worker failure and never downloads an unsuccessful model', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ ...status, state: 'failed', error: 'Blender missing' })).mockResolvedValue(response({}))
    await expect(buildLocalModel(defaultVenue, new AbortController().signal, vi.fn(), fetcher)).rejects.toThrow('Blender missing')
  })
})

it('blocks architecture changes even when interactive seat positions stay the same', () => {
  expect(() => assertBuildCurrent(defaultVenue, defaultVenue)).not.toThrow()
  expect(() => assertBuildCurrent(defaultVenue, { ...defaultVenue, studyNotice: 'Changes curtain material' })).toThrow('layout changed')
})
