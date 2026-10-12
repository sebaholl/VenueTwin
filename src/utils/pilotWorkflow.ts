export const reviewedLayoutBrief = 'Build an editable venue layout from my accepted reference findings and saved measurements. Preserve unrelated settings. Use identifiable row counts and dimensions; do not derive row arrangements from total capacity. Apply supported, confirmed details and ask focused questions for missing information. Clearly distinguish estimates. Prepare the layout for the general Blender architecture build.'
export function briefWithAnswers(brief: string, questions: string[], answers: string[]) {
  const supplied = questions.flatMap((question, index) => answers[index]?.trim() ? [`Question: ${question}\nMy answer: ${answers[index].trim()}`] : [])
  if (!supplied.length) throw new Error('Answer at least one question before generating again.')
  const next = `${brief}\n\nAdditional information:\n${supplied.join('\n\n')}`
  if (next.length > 12000) throw new Error('Your brief and answers exceed 12,000 characters. Shorten the brief first.')
  return next
}

// Reusable modelling briefs. These are transparent starting points, not hidden autonomous jobs.
export const pilotSkills = [
  { id: 'materials', title: 'Build from materials', brief: reviewedLayoutBrief },
  { id: 'architecture', title: 'Complete the architecture', brief: 'Review the current venue and accepted materials. Add or update the supported room shell, wall openings, stage, screen, levels, railings and obstacles where sources identify them. Preserve seating and unrelated settings. Ask for missing dimensions. List any architectural features the general Blender builder cannot represent. Do not invent ornate details.' },
  { id: 'seating', title: 'Refine seating', brief: 'Compare the current seating with my accepted findings. Correct supported row counts, spacing, elevations, arcs, labels and level assignments. Preserve existing categories and unrelated settings. Check the actual chair count and list excluded wheelchair spaces. Ask for unresolved row arrangements rather than deriving them from total capacity.' },
  { id: 'ticketing', title: 'Prepare seat categories', brief: 'Use supplied ticket labels, category definitions, prices and seat assignments to prepare the existing layout for the customer viewer. Ask for missing category details or ambiguous seat numbers. Preserve geometry. Do not infer accessibility or convert prices. Explain that accessibility labels do not create wheelchair bays.' },
  { id: 'review', title: 'Review before delivery', brief: 'Review the CURRENT venue against my accepted materials and brief for missing inputs, inconsistent chair counts and unsupported details. Return no editing actions. List focused questions and limitations to resolve before delivery. Do not claim a Blender build, image comparison, source verification or publication has happened.' },
] as const
