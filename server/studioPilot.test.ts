import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { defaultVenue } from '../src/types/venue'
import { generatePilotPlan, isLocalPilotRequest } from './studioPilot'
const settings = { apiKey: 'test-key-not-real', model: 'configured-model' }
const input = { config: defaultVenue, brief: 'Set stage width to 11 metres, retain position.', allowEstimates: false, references: '' }
const plan = { summary: 'Stage update', actions: [{ tool: 'set_stage', width: 11, x: 0, z: 0, rotation: 0, basis: 'provided', source: 'Brief and current position' }], questions: [], limitations: [], expectedSeatCount: null }
const result = { status: 'completed', output: [{ type: 'function_call', name: 'propose_studio_changes', arguments: JSON.stringify(plan) }] }
const mock = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }))
describe('Pilot provider boundary', () => {
  it('sends a strict, bounded tool request and validates the proposal', async () => {
    const fetcher = mock(result)
    expect(await generatePilotPlan(input, settings, fetcher)).toEqual({ plan })
    const [url, request] = fetcher.mock.calls[0]
    expect(url).toBe('https://api.openai.com/v1/responses')
    const body = JSON.parse(String(request?.body))
    expect(body).toMatchObject({ model: 'configured-model', store: false, parallel_tool_calls: false, max_output_tokens: 10000, tool_choice: { type: 'function', name: 'propose_studio_changes' } })
    expect(body.tools[0].strict).toBe(true)
    expect(JSON.stringify(await generatePilotPlan(input, settings, mock(result)))).not.toContain(settings.apiKey)
  })
  it('does not contact the provider without a key or with invalid input', async () => {
    const fetcher = mock(result)
    await expect(generatePilotPlan(input, { ...settings, apiKey: '' }, fetcher)).rejects.toThrow('OPENAI_API_KEY')
    await expect(generatePilotPlan({ ...input, brief: '' }, settings, fetcher)).rejects.toThrow('brief')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects incomplete output, refusals, unknown tools and multiple tool calls', async () => {
    for (const data of [{ ...result, status: 'incomplete' }, { ...result, output: [{ type: 'message' }] }, { ...result, output: [{ ...result.output[0], name: 'run_shell' }] }, { ...result, output: [...result.output, ...result.output] }]) await expect(generatePilotPlan(input, settings, mock(data))).rejects.toThrow()
  })
  it('rejects malformed arguments and estimates when disallowed', async () => {
    await expect(generatePilotPlan(input, settings, mock({ ...result, output: [{ ...result.output[0], arguments: '{' }] }))).rejects.toThrow()
    const estimated = { ...plan, actions: [{ ...plan.actions[0], basis: 'estimated' }] }
    await expect(generatePilotPlan(input, settings, mock({ ...result, output: [{ ...result.output[0], arguments: JSON.stringify(estimated) }] }))).rejects.toThrow('estimates')
  })
  it('does not relay private provider error bodies', async () => {
    for (const status of [401, 429, 500]) {
      try { await generatePilotPlan(input, settings, mock({ secret: 'DO_NOT_RELAY' }, status)); throw new Error('unexpected success') }
      catch (error) { expect(String(error)).not.toContain('DO_NOT_RELAY'); expect(String(error)).not.toContain('unexpected success') }
    }
  })
  it('handles network failure without changing the project', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive network details'))
    await expect(generatePilotPlan(input, settings, fetcher)).rejects.toThrow('could not reach')
    expect(input.config).toEqual(defaultVenue)
  })
  it('allows only loopback hosts with a matching browser origin', () => {
    const request = (host: string, origin?: string, remoteAddress = '127.0.0.1') => ({ headers: { host, origin }, socket: { remoteAddress } }) as Pick<IncomingMessage, 'headers' | 'socket'>
    expect(isLocalPilotRequest(request('localhost:5173', 'http://localhost:5173'))).toBe(true)
    expect(isLocalPilotRequest(request('127.0.0.1:5173'))).toBe(true)
    expect(isLocalPilotRequest(request('localhost:5173', 'https://evil.example'))).toBe(false)
    expect(isLocalPilotRequest(request('evil.example'))).toBe(false)
    expect(isLocalPilotRequest(request('localhost:5173', undefined, '192.168.1.2'))).toBe(false)
  })
})
