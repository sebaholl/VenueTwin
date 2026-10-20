import { generatePilotPlan, PilotError, type PilotSettings } from './studioPilot'
import { applyPilotPlan } from '../src/utils/studioPilot'
import { layoutChecks, type LayoutFinding } from '../src/utils/layoutChecks'
import { parseViewerConfig } from '../src/utils/customerViewer'
const warnings = (items: LayoutFinding[]) => items.filter((item) => item.severity === 'warning')
const score = (items: LayoutFinding[]) => items.reduce((total, item) => total + (item.count ?? 1), 0)
export async function generateReviewedPlan(input: unknown, settings: PilotSettings, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const request = input as { config?: unknown; allowEstimates?: boolean }
  const config = parseViewerConfig(request?.config)
  const baseline = warnings(layoutChecks(config))
  const sessionSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(125000)]) : AbortSignal.timeout(125000)
  let first: Awaited<ReturnType<typeof generatePilotPlan>> | undefined
  let findings: LayoutFinding[] = [], validation = ''
  try {
    first = await generatePilotPlan(input, settings, fetcher, sessionSignal)
    findings = warnings(layoutChecks(applyPilotPlan(config, first.plan, request.allowEstimates === true)))
  } catch (error) {
    if (!(error instanceof PilotError) || error.status !== 422 || sessionSignal.aborted) throw error
    validation = error.message.slice(0, 500)
  }
  const introduced = findings.filter((item) => {
    const previous = baseline.find((old) => old.id === item.id)
    return !previous || (item.count ?? 0) > (previous.count ?? 0) || item.examples?.some((example) => !previous.examples?.includes(example))
  })
  if (first && !introduced.length) return { ...first, review: { attempts: 1, outcome: findings.length ? 'needs-review' : 'checked', note: findings.length ? 'Existing geometry warnings remain. No correction request was needed for this proposal.' : 'Action validation and local geometry checks passed.', warnings: findings } }
  if (sessionSignal.aborted) throw new PilotError('Pilot review cancelled. Nothing was changed.')
  try {
    const repaired = await generatePilotPlan(input, settings, fetcher, sessionSignal, { previousProposal: first?.plan, validationError: validation || undefined, geometryWarnings: introduced, instruction: 'Make one corrected proposal against the ORIGINAL current config. The previous proposal was NOT applied. Fix only supported changes; do not invent measurements, remove requested seats or relabel estimates as provided to pass checks. If evidence is missing, ask focused questions and explain remaining warnings. Preserve unrelated settings and the original goal.' })
    const remaining = warnings(layoutChecks(applyPilotPlan(config, repaired.plan, request.allowEstimates === true)))
    if (first && score(remaining) > score(findings)) return { ...first, review: { attempts: 2, outcome: 'needs-review', note: 'The correction increased detected intersections. Kept the first valid proposal for your review.', warnings: findings } }
    return { ...repaired, review: { attempts: 2, outcome: remaining.length || repaired.plan.questions.length ? 'needs-review' : 'corrected', note: 'One correction pass completed. Review the changes, questions and source evidence before applying.', warnings: remaining } }
  } catch (error) {
    if (sessionSignal.aborted || !first) throw error
    return { ...first, review: { attempts: 2, outcome: 'needs-review', note: 'The correction attempt did not produce a usable response. Kept the first valid proposal; no further API requests were made.', warnings: findings } }
  }
}
