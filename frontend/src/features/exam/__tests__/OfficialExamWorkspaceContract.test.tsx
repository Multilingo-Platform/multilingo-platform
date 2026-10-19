import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { toEditorParts, toOfficialExamRequest } from '../../exams/utils/examContentMapping';
import { usePracticeFeedback } from '../hooks/usePracticeFeedback';
import * as attemptApi from '../api/attemptApi';
import { initialState } from '../store/answerSlice';
import type { WorkspaceResponse, PracticeFeedbackResponse } from '../types/api.types';
import type { Question } from '../types/exam.types';

vi.mock('../api/attemptApi', () => ({ checkPracticeAnswer: vi.fn() }));

const pairMetadata = {
  id: 'listening-17-18',
  mode: 'DISTINCT_UNORDERED' as const,
  question_ids: ['l_017', 'l_018'],
};

interface MappedQuestion {
  question_id: string;
  type: string;
  question_text: string;
  options: Array<{ id: string; text: string }>;
  correct_answer: unknown;
  answer_group: typeof pairMetadata;
}

const options = ['A', 'B', 'C', 'D', 'E'].map(id => ({ id, text: `Option ${id}` }));
const canonicalSource = {
  title: 'Cambridge IELTS 20 Test 1',
  type: 'IELTS_ACADEMIC',
  examLanguage: 'en',
  published: false,
  sections: [{
    skillType: 'LISTENING',
    durationMinutes: 30,
    parts: [{
      partNumber: 2,
      contentData: {
        part_title: 'Part 2',
        shared_audio: { url: 'https://media.example.test/audio-2.mp3' },
        question_groups: [{
          group_id: 'listening-g2',
          instruction: 'Choose an answer for each slot.',
          questions: ['l_017', 'l_018'].map((questionId) => ({
            question_id: questionId,
            type: 'SINGLE_CHOICE',
            question_text: `Question ${questionId}`,
            options,
            correct_answer: ['A', 'E'],
            explanation: '',
            answer_group: pairMetadata,
          })),
        }],
      },
    }],
  }],
};

const workspace: WorkspaceResponse = {
  attempt_id: 42,
  status: 'IN_PROGRESS',
  test_scope: 'SINGLE_PART',
  test_mode: 'PRACTICE',
  startTime: '2026-10-17T00:00:00Z',
  serverTime: '2026-10-17T00:00:00Z',
  deadline: null,
  gracePeriodSeconds: 15,
  lockedSections: [],
  version: 3,
  saved_answers: [],
  serverTimeOffset: 0,
  exam_snapshot: { exam_id: 9, code: 'IELTS-T1', title: canonicalSource.title, type: 'IELTS_ACADEMIC', sections: [] },
};

describe('official exam canonical-to-workspace contract', () => {
  it('keeps paired question identity through editor mapping and sends both current answers to Practice', async () => {
    const editorParts = toEditorParts(canonicalSource);
    const savedRequest = toOfficialExamRequest(canonicalSource.title, canonicalSource.type, editorParts, false);
    const group = savedRequest.sections[0].parts[0].contentData.question_groups[0] as {
      questions: MappedQuestion[];
    };
    expect(group.questions.map(question => question.answer_group)).toEqual([pairMetadata, pairMetadata]);
    expect(group.questions.map(question => question.correct_answer)).toEqual([['A', 'E'], ['A', 'E']]);
    expect(savedRequest.sections[0].parts[0].contentData.shared_audio).toEqual(canonicalSource.sections[0].parts[0].contentData.shared_audio);

    const questions: Question[] = group.questions.map((question, questionIndex) => ({
      question_id: question.question_id,
      question_number: 17 + questionIndex,
      type: 'SINGLE_CHOICE',
      question_text: question.question_text,
      options: question.options,
      media: null,
      answer_group: question.answer_group,
    }));
    const store = createTestStore({
      answers: {
        ...initialState,
        attemptId: 42,
        contextRevision: 1,
        version: 3,
        answers: { 2: { 'l_017': 'A', 'l_018': 'E' } },
      },
    });
    const response: PracticeFeedbackResponse = {
      attemptId: 42,
      partId: 2,
      questionId: 'l_017',
      type: 'SINGLE_CHOICE',
      userAnswer: 'A',
      verdict: 'CORRECT',
      score: 1,
      correctAnswer: ['A', 'E'],
      explanation: 'Slot 1 explanation',
      groupResults: [
        { questionId: 'l_017', userAnswer: 'A', verdict: 'CORRECT', score: 1, correctAnswer: ['A', 'E'], explanation: 'Slot 1 explanation' },
        { questionId: 'l_018', userAnswer: 'E', verdict: 'CORRECT', score: 1, correctAnswer: ['A', 'E'], explanation: 'Slot 2 explanation' },
      ],
    };
    vi.mocked(attemptApi.checkPracticeAnswer).mockResolvedValueOnce(response);
    const { result } = renderHook(() => usePracticeFeedback({ workspace, partId: 2, questions }), {
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    });

    await act(async () => result.current.check('l_017'));

    expect(attemptApi.checkPracticeAnswer).toHaveBeenCalledWith(42, {
      partId: 2,
      questionId: 'l_017',
      answer: 'A',
      groupAnswers: { 'l_017': 'A', 'l_018': 'E' },
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(result.current.getFeedback('l_017').data?.verdict).toBe('CORRECT');
    expect(result.current.getFeedback('l_018').data).toMatchObject({ questionId: 'l_018', userAnswer: 'E', verdict: 'CORRECT' });
  });
});
