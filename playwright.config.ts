import { defineConfig, devices } from '@playwright/test'
const port = Number(process.env.PORT ?? 4174)
const baseURL = `http://127.0.0.1:${port}`
export default defineConfig({
  testDir: './e2e', fullyParallel: true, workers: 2, retries: 0, timeout: 30000,
  use: { baseURL, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    { name: 'safari', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: { command: 'node scripts/serve-managed.mjs', url: baseURL, reuseExistingServer: false },
})
