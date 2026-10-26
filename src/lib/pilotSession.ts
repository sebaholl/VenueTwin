import { parsePilotPlan, type PilotPlan } from '../utils/studioPilot'

export type PilotRun = { at: string; brief: string; plan: PilotPlan; snapshot: string; references: string }
export type PendingPilotApproval = { id: string; requestedAt: string; brief: string; plan: PilotPlan; base: string; evidenceSha256: string; allowEstimates: boolean; review?: { attempts: number; outcome: string; note: string } }
export type PilotDecision = { id: string; at: string; decision: 'approved' | 'rejected'; buildRequested: boolean }
export type PilotSession = { version: 2; brief: string; allowEstimates: boolean; includeReferences: boolean; autoReview: boolean; lastApplied: PilotRun | null; pendingApproval: PendingPilotApproval | null; decisions: PilotDecision[] }
type LegacyPilotSession = Omit<PilotSession, 'version' | 'pendingApproval' | 'decisions'> & { version: 1 }
export const emptyPilotSession = (): PilotSession => ({ version: 2, brief: '', allowEstimates: false, includeReferences: true, autoReview: true, lastApplied: null, pendingApproval: null, decisions: [] })
const key = (projectId: string) => `venuetwin-pilot-v1:${projectId}`
export function parsePilotSession(raw: string): PilotSession {
  if (raw.length > 500000) throw new Error('Saved Pilot draft is too large.')
  const value = JSON.parse(raw) as PilotSession | LegacyPilotSession
  if (!value || (value.version !== 1 && value.version !== 2) || typeof value.brief !== 'string' || value.brief.length > 12000 || (['allowEstimates', 'includeReferences', 'autoReview'] as const).some((k) => typeof value[k] !== 'boolean')) throw new Error('Saved Pilot draft is invalid.')
  const run = value.lastApplied
  if (run !== null) {
    if (!run || typeof run.at !== 'string' || !Number.isFinite(Date.parse(run.at)) || typeof run.brief !== 'string' || run.brief.length > 12000 || typeof run.snapshot !== 'string' || run.snapshot.length > 200000 || typeof run.references !== 'string' || run.references.length > 80000) throw new Error('Saved Pilot history is invalid.')
    parsePilotPlan(run.plan)
  }
  if (value.version === 1) return { ...structuredClone(value), version: 2, pendingApproval: null, decisions: [] }
  const pending = value.pendingApproval
  if (pending !== null) {
    if (!pending || typeof pending.id !== 'string' || pending.id.length > 80 || typeof pending.requestedAt !== 'string' || !Number.isFinite(Date.parse(pending.requestedAt)) || typeof pending.brief !== 'string' || pending.brief.length > 12000 || typeof pending.base !== 'string' || pending.base.length > 200000 || !/^[a-f0-9]{64}$/.test(pending.evidenceSha256) || typeof pending.allowEstimates !== 'boolean') throw new Error('Saved owner approval is invalid.')
    parsePilotPlan(pending.plan)
    if (pending.review && (!Number.isInteger(pending.review.attempts) || pending.review.attempts < 0 || pending.review.attempts > 2 || typeof pending.review.outcome !== 'string' || pending.review.outcome.length > 80 || typeof pending.review.note !== 'string' || pending.review.note.length > 2000)) throw new Error('Saved owner approval review is invalid.')
  }
  if (!Array.isArray(value.decisions) || value.decisions.length > 20 || value.decisions.some((item) => !item || typeof item.id !== 'string' || item.id.length > 80 || typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at)) || !['approved', 'rejected'].includes(item.decision) || typeof item.buildRequested !== 'boolean')) throw new Error('Saved owner decisions are invalid.')
  return structuredClone(value)
}
// Pending packets contain bounded actions and a source hash, never file bytes or API keys.
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
