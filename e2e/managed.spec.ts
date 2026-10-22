import { test, expect } from '@playwright/test'
const venue = '/venue?venue=/venues/demo/v1/venue.json'
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
})
test('seat selection, camera view, level change, map and mobile layout', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto(venue)
  await expect(page.getByRole('heading', { name: /FICTIONAL four-seat/ })).toBeVisible()
  await page.getByRole('button', { name: 'Select seat A1', exact: true }).click()
  await page.getByRole('button', { name: 'View from this seat', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Seat A1', exact: true })).toBeVisible()
  await expect(page.getByTestId('scene-status')).toHaveText('3D ready')
  await page.screenshot({ path: `test-results/seat-view-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Seat map', exact: true }).click()
  await expect(page.getByRole('img', { name: /Seat map/ })).toBeVisible()
  await page.getByLabel('Choose level', { exact: true }).selectOption('raised')
  await expect(page.getByRole('button', { name: 'Select seat B1', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
  await page.screenshot({ path: `test-results/managed-${info.project.name}.png`, fullPage: true })
})
test('stable deep link and invalid-seat recovery', async ({ page }) => {
  await page.goto(venue + '&seat=b2')
  await expect(page.getByRole('heading', { name: 'Seat B2', exact: true })).toBeVisible()
  await page.goto(venue + '&seat=deleted')
  await expect(page.getByRole('status').filter({ hasText: 'not available' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'View from this seat', exact: true })).toBeDisabled()
})
test('model integrity failure and missing manifest are visible', async ({ page }) => {
  await page.route('**/venue.glb', route => route.fulfill({ body: 'tampered' }))
  await page.goto(venue)
  await expect(page.getByRole('alert')).toContainText('does not match')
  await page.goto('/venue?venue=/venues/missing/v1/venue.json')
  await expect(page.getByRole('alert')).toContainText('404')
})
test('managed bundle excludes studio and has a support page', async ({ page }) => {
  await page.goto('/studio'); await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await page.goto('/service'); await expect(page.getByRole('heading', { name: 'Service & support' })).toBeVisible()
})
test('WebGL loss leaves a usable seat map', async ({ page }) => {
  await page.goto(venue)
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByTestId('scene-status')).toHaveText('3D ready')
  await page.locator('canvas').dispatchEvent('webglcontextlost')
  await expect(page.getByRole('img', { name: /Seat map/ })).toBeVisible()
  await page.getByRole('button', { name: 'Select seat A2', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Select seat A2', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
test('devices without WebGL retain keyboard seat selection and map', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).includes('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto(venue)
  await page.getByRole('button', { name: 'Seat map', exact: true }).click()
  await expect(page.getByRole('img', { name: /Seat map/ })).toBeVisible()
  await page.getByRole('button', { name: 'Select seat A1', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Select seat A1', exact: true })).toHaveAttribute('aria-pressed', 'true')
})
