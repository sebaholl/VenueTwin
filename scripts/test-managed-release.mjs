import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const run = (args, env = {}) => spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/managed-release.mjs', ...args], { encoding: 'utf8', env: { ...process.env, VITE_OPERATOR_NAME: 'Test operator', VITE_SUPPORT_EMAIL: 'support@venue.test', VITE_PRIVACY_URL: 'https://venue.test/privacy', VITE_TERMS_URL: 'https://venue.test/terms', ...env } })
test('real release requires configured contact and reviewed packages', () => {
  const contact = run([], { VITE_SUPPORT_EMAIL: 'demo@example.invalid' })
  assert.notEqual(contact.status, 0); assert.match(contact.stderr, /Configure real/)
  const absent = run([]); assert.notEqual(absent.status, 0); assert.match(absent.stderr, /Supply --venues/)
})
for (const scenario of ['demo', 'study', 'hash', 'metadata', 'revision', 'extra-file']) test(`release rejects ${scenario}`, async () => {
  const root = await mkdtemp(join(tmpdir(), 'vt-release-test-'))
  try {
    const dir = join(root, 'theatre', 'v1'); await mkdir(dir, { recursive: true })
    const manifest = JSON.parse(await readFile('tests/fixtures/production/venue.json', 'utf8'))
    if (scenario !== 'demo') manifest.quality = scenario === 'study' ? 'study' : 'reviewed'
    if (scenario === 'hash') manifest.model.sha256 = '0'.repeat(64)
    if (scenario === 'metadata') manifest.sources = ['private source']
    if (scenario === 'revision') manifest.revision = 2
    await writeFile(join(dir, 'venue.json'), JSON.stringify(manifest))
    await copyFile('tests/fixtures/production/venue.glb', join(dir, 'venue.glb'))
    if (scenario === 'extra-file') await writeFile(join(dir, 'review.json'), '{}')
    const result = run(['--venues', root]); assert.notEqual(result.status, 0)
    assert.match(result.stderr, /reviewed|minimal|integrity|Invalid customer|Directory version|Only venue/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
