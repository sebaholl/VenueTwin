import { expect, it, vi } from 'vitest'
import { defaultVenue } from '../src/types/venue'
import { generateReviewedPlan } from './pilotReview'
const settings = { apiKey: 'test', model: 'test' }
const input = { config: defaultVenue, brief: 'Stage width 11; preserve unrelated settings.', references: '', allowEstimates: false }
const action = { tool: 'set_stage', width: 11, x: null, z: null, rotation: null, basis: 'provided', source: 'Brief' }
const plan = { summary: 'Stage', actions: [action], questions: [], limitations: [], expectedSeatCount: null }
const response = (p: unknown) => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', name: 'propose_studio_changes', arguments: JSON.stringify(p) }] }))
it('uses one request for a valid clean proposal', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(plan))
  const result = await generateReviewedPlan(input, settings, fetcher)
  expect(result.plan).toEqual(plan)
  expect(result.review.attempts).toBe(1)
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('repairs invalid actions once against the original project', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ ...plan, actions: [{ ...action, width: -1 }] })).mockResolvedValueOnce(response(plan))
  const result = await generateReviewedPlan(input, settings, fetcher)
  expect(result.review.attempts).toBe(2)
  const sent = JSON.parse(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).input[0].content)
  expect(sent.config.stageWidth).toBe(defaultVenue.stageWidth)
  expect(sent.reviewContext.validationError).toBeTruthy()
  expect(input.config).toEqual(defaultVenue)
})
it('stops after two invalid responses', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response({ ...plan, actions: [{ ...action, width: -1 }] }))
  await expect(generateReviewedPlan(input, settings, fetcher)).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('does not retry quota failures', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('private provider body', { status: 429 }))
  await expect(generateReviewedPlan(input, settings, fetcher)).rejects.toThrow('limit')
  expect(fetcher).toHaveBeenCalledTimes(1)
})
it('retains a valid proposal when geometry correction fails', async () => {
  const intersecting = { ...plan, actions: [{ ...action, z: 2.2 }] }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(intersecting)).mockRejectedValueOnce(new Error('private network detail'))
  const result = await generateReviewedPlan(input, settings, fetcher)
  expect(result.plan).toEqual(intersecting)
  expect(result.review.outcome).toBe('needs-review')
  expect(JSON.stringify(result)).not.toContain('private network detail')
})
it('does not repair unrelated existing intersections', async () => {
  const config = { ...defaultVenue, stagePosition: { offsetX: 0, offsetY: 2.2, rotation: 0 } }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(plan))
  expect((await generateReviewedPlan({ ...input, config }, settings, fetcher)).review.attempts).toBe(1)
})
it('does not bypass estimate restrictions in the correction pass', async () => {
  const estimated = { ...plan, actions: [{ ...action, basis: 'estimated' }] }
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(estimated))
  await expect(generateReviewedPlan(input, settings, fetcher)).rejects.toThrow('estimates')
  expect(fetcher).toHaveBeenCalledTimes(2)
})
it('keeps the first proposal if the correction increases intersections', async () => {
  const first = { ...plan, actions: [{ ...action, width: 1, z: 2.2 }] }
  const worse = { ...plan, actions: [{ ...action, width: 100, z: 2.2 }] }
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response(first)).mockResolvedValueOnce(response(worse))
  const result = await generateReviewedPlan(input, settings, fetcher)
  expect(result.plan).toEqual(first)
  expect(result.review.note).toContain('increased')
})
it('does not return a fallback proposal after cancellation', async () => {
  const controller = new AbortController()
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(response({ ...plan, actions: [{ ...action, z: 2.2 }] })).mockImplementationOnce(async () => { controller.abort(); throw new Error('aborted') })
  await expect(generateReviewedPlan(input, settings, fetcher, controller.signal)).rejects.toThrow()
  expect(fetcher).toHaveBeenCalledTimes(2)
})
