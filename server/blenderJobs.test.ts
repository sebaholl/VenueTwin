import { describe, expect, it, vi } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { defaultVenue } from '../src/types/venue'
import { geometrySignature } from '../src/utils/customerViewer'
import { createBlenderJobs, blenderRunner, type BlenderRunner } from './blenderJobs'
function glb() {
  const json = JSON.stringify({ asset: { version: '2.0' } })
  const text = Buffer.from(json + ' '.repeat((4 - json.length % 4) % 4))
  const output = Buffer.alloc(text.length + 20)
  output.writeUInt32LE(0x46546c67, 0); output.writeUInt32LE(2, 4); output.writeUInt32LE(output.length, 8)
  output.writeUInt32LE(text.length, 12); output.writeUInt32LE(0x4e4f534a, 16); text.copy(output, 20)
  return output
}
const successful: BlenderRunner = async (_input, output, _signal, progress) => { progress('Building architecture'); await writeFile(output, glb()) }
const waitsForCancel: BlenderRunner = async (_input, _output, signal) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(new Error('Cancelled')), { once: true })
  if (signal.aborted) reject(new Error('Cancelled'))
})
describe('local Blender jobs', () => {
  it('creates a trusted blueprint and returns a validated model tied to the original geometry', async () => {
    let inputPath = ''
    const jobs = createBlenderJobs(async (input, output, signal, progress) => {
      inputPath = input
      expect(JSON.parse(await readFile(input, 'utf8'))).toMatchObject({ format: 'venuetwin-blender', version: 1, axes: 'three-y-up' })
      await successful(input, output, signal, progress)
    })
    const config = structuredClone(defaultVenue)
    try {
      const job = await jobs.start(config)
      config.stageWidth = 55
      await vi.waitFor(() => expect(jobs.status(job.id).state).toBe('completed'))
      expect(jobs.status(job.id).signature).toBe(geometrySignature(defaultVenue))
      expect(await jobs.model(job.id)).toEqual(glb())
    } finally { await jobs.close() }
    await expect(readFile(inputPath)).rejects.toThrow()
  })
  it('rejects concurrent builds, cancels, and allows retry', async () => {
    const jobs = createBlenderJobs(waitsForCancel)
    try {
      const job = await jobs.start(defaultVenue)
      await expect(jobs.start(defaultVenue)).rejects.toThrow('already running')
      expect((await jobs.cancel(job.id)).state).toBe('cancelled')
      await expect(jobs.model(job.id)).rejects.toThrow('not ready')
      const next = await jobs.start(defaultVenue)
      expect(next.id).not.toBe(job.id)
    } finally { await jobs.close() }
  })
  it('times out a worker and cleans its input directory', async () => {
    const jobs = createBlenderJobs(waitsForCancel, 10)
    try {
      const job = await jobs.start(defaultVenue)
      await vi.waitFor(() => expect(jobs.status(job.id).state).toBe('failed'))
      expect(jobs.status(job.id).error).toContain('build limit')
    } finally { await jobs.close() }
  })
  it('rejects corrupt model output instead of offering it for import', async () => {
    const jobs = createBlenderJobs(async (_input, output) => { await writeFile(output, 'invalid glb') })
    try {
      const job = await jobs.start(defaultVenue)
      await vi.waitFor(() => expect(jobs.status(job.id).state).toBe('failed'))
      await expect(jobs.model(job.id)).rejects.toThrow('not ready')
    } finally { await jobs.close() }
  })
  it('reports a missing executable with actionable setup guidance', async () => {
    const jobs = createBlenderJobs(blenderRunner('/missing/venuetwin/blender', '/missing/job.py'))
    try {
      const job = await jobs.start(defaultVenue)
      await vi.waitFor(() => expect(jobs.status(job.id).state).toBe('failed'))
      expect(jobs.status(job.id).error).toContain('BLENDER_PATH')
    } finally { await jobs.close() }
  })
  it('rejects invalid geometry before starting a process and unknown job IDs', async () => {
    const run = vi.fn<BlenderRunner>()
    const jobs = createBlenderJobs(run)
    try {
      await expect(jobs.start({ ...defaultVenue, rows: 3000 })).rejects.toThrow()
      expect(run).not.toHaveBeenCalled()
      expect(() => jobs.status('../../somewhere')).toThrow('expired')
    } finally { await jobs.close() }
  })
})
