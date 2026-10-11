import { expect, it } from 'vitest'
import { briefWithAnswers } from './pilotWorkflow'
it('keeps the original brief and ties supplied answers to their questions', () => {
  expect(briefWithAnswers('Keep the balcony.', ['Stage width?', 'Row count?', 'Aisle width?'], ['11 m', '', '  1.2 m  '])).toBe('Keep the balcony.\n\nAdditional information:\nQuestion: Stage width?\nMy answer: 11 m\n\nQuestion: Aisle width?\nMy answer: 1.2 m')
})
it('does not turn empty answers into evidence', () => {
  expect(() => briefWithAnswers('Brief', ['Height?'], ['  '])).toThrow('at least one')
})
it('rejects oversized requests without truncating source information', () => {
  expect(() => briefWithAnswers('x'.repeat(12000), ['Width?'], ['11m'])).toThrow('12,000')
})
