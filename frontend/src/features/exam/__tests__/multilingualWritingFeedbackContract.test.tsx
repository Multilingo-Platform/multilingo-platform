import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../../../i18n';
import { normalizeWritingFeedback, WritingFeedbackContractError } from '../api/writingFeedbackContract';
import { WritingFeedbackTask } from '../components/result/writing/WritingFeedbackTask';
import { validAiDoneTextOnlyWire } from './fixtures/writingFeedback';

function wire() {
  const response = structuredClone(validAiDoneTextOnlyWire);
  const task = response.tasks[0];
  return { ...response, tasks: [{ ...task, schemaVersion: 2, rubricCode: 'WRITING_GENERIC_V1',
    scoreUnit: 'PRACTICE_0_10', maxScore: 10, overall: 10, language: 'ja', feedbackLanguage: 'fr', wordCount: 1,
    lengthMetric: { value: 3, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' },
    originalText: '日本語', correctedEssay: '日本語', corrections: [], diff: [{ type: 'EQUAL', text: '日本語' }],
    overallFeedback: 'Très bien.', criteria: ['TR', 'CC', 'LR', 'GRA'].map(code => ({ code, score: 10, feedback: 'Bien.' })),
  }] };
}
afterEach(async () => { await i18n.changeLanguage('vi'); });

describe('multilingual feedback consumer contract', () => {
  it('retains character metrics and renders practice scores and separate content languages', async () => {
    await i18n.changeLanguage('en');
    const data = normalizeWritingFeedback(wire(), 101, 202);
    expect(data.tasks[0]).toHaveProperty('lengthMetric.value', 3);
    render(<WritingFeedbackTask task={data.tasks[0]} />);
    expect(screen.getByText('Writing practice score')).toBeInTheDocument();
    expect(screen.getByText('characters')).toBeInTheDocument();
    expect(screen.getByText('Très bien.').closest('[lang]')).toHaveAttribute('lang', 'fr');
    expect(screen.getByRole('region', { name: 'Essay content' }).closest('[lang]')).toHaveAttribute('lang', 'ja');
    await act(async () => { await i18n.changeLanguage('vi'); });
    expect(screen.getByText('Très bien.')).toBeInTheDocument();
    expect(screen.getByText('Điểm luyện viết')).toBeInTheDocument();
  });

  it('accepts an empty generic system result without inventing model criteria or feedback', () => {
    const response = wire();
    Object.assign(response.tasks[0], { source: 'SYSTEM', reasonCode: 'EMPTY_ESSAY', originalText: '', correctedEssay: '',
      overall: 0, criteria: [], corrections: [], diff: [], overallFeedback: '', wordCount: 0,
      lengthMetric: { value: 0, unit: 'CHARACTERS', policyVersion: 'TV3_LENGTH_V1' } });
    expect(normalizeWritingFeedback(response, 101, 202).tasks[0].reasonCode).toBe('EMPTY_ESSAY');
  });

  it('rejects unknown public versions and malformed character metrics', () => {
    const response = wire();
    Object.assign(response.tasks[0], { schemaVersion: 3 });
    expect(() => normalizeWritingFeedback(response, 101, 202)).toThrow(WritingFeedbackContractError);
    Object.assign(response.tasks[0], { schemaVersion: 2, lengthMetric: { value: -1, unit: 'BYTES', policyVersion: 'bad' } });
    expect(() => normalizeWritingFeedback(response, 101, 202)).toThrow(WritingFeedbackContractError);
  });
});
