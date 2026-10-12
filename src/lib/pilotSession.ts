import { parsePilotPlan, type PilotPlan } from '../utils/studioPilot'

export type PilotRun = { at: string; brief: string; plan: PilotPlan; snapshot: string; references: string }
export type PilotSession = { version: 1; brief: string; allowEstimates: boolean; includeReferences: boolean; autoReview: boolean; lastApplied: PilotRun | null }
export const emptyPilotSession = (): PilotSession => ({ version: 1, brief: '', allowEstimates: false, includeReferences: true, autoReview: true, lastApplied: null })
const key = (projectId: string) => `venuetwin-pilot-v1:${projectId}`
export function parsePilotSession(raw: string): PilotSession {
  if (raw.length > 500000) throw new Error('Saved Pilot draft is too large.')
  const value = JSON.parse(raw) as PilotSession
  if (!value || value.version !== 1 || typeof value.brief !== 'string' || value.brief.length > 12000 || ['allowEstimates', 'includeReferences', 'autoReview'].some((k) => typeof value[k as keyof PilotSession] !== 'boolean')) throw new Error('Saved Pilot draft is invalid.')
  const run = value.lastApplied
  if (run !== null) {
    if (!run || typeof run.at !== 'string' || !Number.isFinite(Date.parse(run.at)) || typeof run.brief !== 'string' || run.brief.length > 12000 || typeof run.snapshot !== 'string' || run.snapshot.length > 200000 || typeof run.references !== 'string' || run.references.length > 80000) throw new Error('Saved Pilot history is invalid.')
    parsePilotPlan(run.plan)
  }
  return structuredClone(value)
}
// Never persist pending proposals, API keys or file bytes. A refreshed draft needs a fresh proposal.
export function loadPilotSession(projectId: string): { session: PilotSession; error: string } {
  try {
    const raw = localStorage.getItem(key(projectId))
    return { session: raw ? parsePilotSession(raw) : emptyPilotSession(), error: '' }
  } catch { return { session: emptyPilotSession(), error: 'Could not restore the local Pilot draft. Your venue is unchanged.' } }
}
export function savePilotSession(projectId: string, session: PilotSession) {
  const raw = JSON.stringify(session)
  parsePilotSession(raw)
  localStorage.setItem(key(projectId), raw)
}
