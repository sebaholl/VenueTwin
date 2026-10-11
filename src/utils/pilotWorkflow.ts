export const reviewedLayoutBrief = 'Build an editable venue layout from my accepted reference findings and saved measurements. Preserve unrelated settings. Use identifiable row counts and dimensions; do not derive row arrangements from total capacity. Apply supported, confirmed details and ask focused questions for missing information. Clearly distinguish estimates. Prepare the layout for the general Blender architecture build.'
export function briefWithAnswers(brief: string, questions: string[], answers: string[]) {
  const supplied = questions.flatMap((question, index) => answers[index]?.trim() ? [`Question: ${question}\nMy answer: ${answers[index].trim()}`] : [])
  if (!supplied.length) throw new Error('Answer at least one question before generating again.')
  const next = `${brief}\n\nAdditional information:\n${supplied.join('\n\n')}`
  if (next.length > 12000) throw new Error('Your brief and answers exceed 12,000 characters. Shorten the brief first.')
  return next
}
