import { afterEach, expect, it, vi } from 'vitest'
import fixture from '../../tests/fixtures/production/venue.json'
import { loadProductionVenue } from './productionAssets'
afterEach(() => vi.unstubAllGlobals())
it('rejects an external manifest without fetching it', async () => {
  vi.stubGlobal('location', { origin: 'https://venue.test' }); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  await expect(loadProductionVenue('https://other.test/venues/a.json', new AbortController().signal)).rejects.toThrow()
  expect(fetch).not.toHaveBeenCalled()
})
it('rejects an altered model before creating a 3D scene', async () => {
  vi.stubGlobal('location', { origin: 'https://venue.test' })
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(fixture))).mockResolvedValueOnce(new Response('wrong model'))
  vi.stubGlobal('fetch', fetch)
  await expect(loadProductionVenue('/venues/a/v1/venue.json', new AbortController().signal)).rejects.toThrow('does not match')
  expect(fetch.mock.calls[1][1]).toMatchObject({ credentials: 'omit', redirect: 'error' })
})
it('reports missing public files without opening a local private project', async () => {
  vi.stubGlobal('location', { origin: 'https://venue.test' }); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
  await expect(loadProductionVenue('/venues/a/v1/venue.json', new AbortController().signal)).rejects.toThrow('404')
})
