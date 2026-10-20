import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPublishedViewer } from './viewerAssets'
import { viewerManifest } from '../utils/customerViewer'
import { defaultVenue } from '../types/venue'

afterEach(() => vi.unstubAllGlobals())
describe('published viewer loading', () => {
  it('loads only the paired same-origin model and preserves seat data', async () => {
    const model = new Blob(['model bytes'])
    const manifest = await viewerManifest({ config: defaultVenue, model, createdAt: '' })
    vi.stubGlobal('location', { origin: 'https://venue.test' })
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest))).mockResolvedValueOnce(new Response(model))
    vi.stubGlobal('fetch', fetch)
    const result = await loadPublishedViewer('/venues/demo/venue.json', new AbortController().signal)
    expect(await result.model?.text()).toBe('model bytes')
    expect(result.config).toEqual(defaultVenue)
    expect(fetch.mock.calls[1][0]).toBe('https://venue.test/venues/demo/venue.glb')
    expect(fetch.mock.calls[1][1]).toMatchObject({ redirect: 'error', credentials: 'omit' })
  })
  it('rejects a mismatched GLB instead of showing incorrect seating', async () => {
    const manifest = await viewerManifest({ config: defaultVenue, model: new Blob(['old']), createdAt: '' })
    vi.stubGlobal('location', { origin: 'https://venue.test' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(manifest))).mockResolvedValueOnce(new Response('different model')))
    await expect(loadPublishedViewer('/venues/demo/venue.json', new AbortController().signal)).rejects.toThrow('does not match')
  })
  it('does not fall back to the private local snapshot when public files fail', async () => {
    vi.stubGlobal('location', { origin: 'https://venue.test' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Missing', { status: 404 })))
    await expect(loadPublishedViewer('/venues/missing/venue.json', new AbortController().signal)).rejects.toThrow('404')
  })
  it('rejects oversized responses before JSON parsing', async () => {
    vi.stubGlobal('location', { origin: 'https://venue.test' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Length': '99999999' } })))
    await expect(loadPublishedViewer('/venues/demo/venue.json', new AbortController().signal)).rejects.toThrow('size limit')
  })
})
