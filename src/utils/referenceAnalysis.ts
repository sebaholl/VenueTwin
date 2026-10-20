export type Finding = { sourceId: string; page: number | null; location: string; evidence: string; kind: 'dimension' | 'seating' | 'feature'; label: string; value: number | null; unit: 'm' | 'count' | 'none'; statement: string; basis: 'documented' | 'inferred' | 'uncertain' }
export type ReferenceAnalysis = { summary: string; findings: Finding[]; questions: string[] }
export type AnalysisSource = { id: string; name: string; mime: string; hash: string }
export type AnalysisRecord = { analysis: ReferenceAnalysis; sources: AnalysisSource[]; accepted: number[] }
const text = (maxLength: number) => ({ type: 'string', minLength: 1, maxLength })
export const analysisSchema = {
  type: 'object', additionalProperties: false, required: ['summary', 'findings', 'questions'],
  properties: {
    summary: text(1200),
    findings: { type: 'array', maxItems: 40, items: { type: 'object', additionalProperties: false,
      required: ['sourceId', 'page', 'location', 'evidence', 'kind', 'label', 'value', 'unit', 'statement', 'basis'],
      properties: { sourceId: text(100), page: { anyOf: [{ type: 'integer', minimum: 1, maximum: 1000 }, { type: 'null' }] }, location: text(200), evidence: text(350), kind: { type: 'string', enum: ['dimension', 'seating', 'feature'] }, label: text(100), value: { anyOf: [{ type: 'number', minimum: 0, maximum: 100000 }, { type: 'null' }] }, unit: { type: 'string', enum: ['m', 'count', 'none'] }, statement: text(400), basis: { type: 'string', enum: ['documented', 'inferred', 'uncertain'] } },
    } },
    questions: { type: 'array', maxItems: 10, items: text(500) },
  },
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const string = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
export function parseReferenceAnalysis(value: unknown, sources: Pick<AnalysisSource, 'id' | 'mime'>[]): ReferenceAnalysis {
  if (!record(value) || Object.keys(value).some((key) => !['summary', 'findings', 'questions'].includes(key)) || !string(value.summary, 1200) || !Array.isArray(value.findings) || value.findings.length > 40 || !Array.isArray(value.questions) || value.questions.length > 10 || value.questions.some((q) => !string(q, 500))) throw new Error('Invalid reference analysis.')
  for (const f of value.findings) {
    if (!record(f) || Object.keys(f).some((key) => !['sourceId', 'page', 'location', 'evidence', 'kind', 'label', 'value', 'unit', 'statement', 'basis'].includes(key))) throw new Error('Invalid finding.')
    const source = sources.find((s) => s.id === f.sourceId)
    if (!source || !string(f.location, 200) || !string(f.evidence, 350) || !string(f.label, 100) || !string(f.statement, 400) || !['dimension', 'seating', 'feature'].includes(String(f.kind)) || !['m', 'count', 'none'].includes(String(f.unit)) || !['documented', 'inferred', 'uncertain'].includes(String(f.basis))) throw new Error('A finding has an unknown source or invalid evidence.')
    if (f.page !== null && (source.mime !== 'application/pdf' || typeof f.page !== 'number' || !Number.isInteger(f.page) || f.page < 1 || f.page > 1000)) throw new Error('Invalid source page.')
    if (f.value !== null && (typeof f.value !== 'number' || !Number.isFinite(f.value) || f.value < 0 || f.value > 100000)) throw new Error('Invalid finding value.')
    if ((f.unit === 'none' || f.basis === 'uncertain') && f.value !== null) throw new Error('Uncertain findings cannot supply a modelling value.')
    if (f.unit === 'count' && f.value !== null && !Number.isInteger(f.value)) throw new Error('Seat and row counts must be whole numbers.')
    if (f.unit === 'm' && f.value !== null && f.value > 1000) throw new Error('Dimension exceeds the supported range.')
  }
  return structuredClone(value) as ReferenceAnalysis
}
export function acceptedFindings(record: AnalysisRecord, validSourceIds: string[]) {
  return record.accepted.map((index) => record.analysis.findings[index]).filter((finding) => finding && validSourceIds.includes(finding.sourceId) && finding.basis !== 'uncertain').map((finding) => ({ ...finding, sourceName: record.sources.find((source) => source.id === finding.sourceId)!.name, review: 'Accepted by user; not independently verified' }))
}
