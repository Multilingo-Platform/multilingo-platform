import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useToeicWorkspaceNavigation } from '../hooks/useToeicWorkspaceNavigation';
import { buildToeicWorkspaceModel } from '../utils/toeicWorkspaceModel';
import type { ToeicWorkspaceModel } from '../utils/toeicWorkspaceModel';

function canonicalId(n: number): string {
  return `q_${String(n).padStart(3, '0')}`;
}

function question(n: number) {
  return { question_id: canonicalId(n), type: 'SINGLE_CHOICE', question_text: '', options: [], media: null };
}

function makeModel(): ToeicWorkspaceModel {
  return buildToeicWorkspaceModel({
    code: 'TOEIC-ETS-2024-T1-V2',
    type: 'TOEIC',
    sections: [
      {
        id: 11,
        skill_type: 'LISTENING',
        parts: [
          { id: 101, part_number: 1, questionGroups: [{ group_id: 'g1', questions: [question(1), question(2)] }] },
          { id: 102, part_number: 2, questionGroups: [{ group_id: 'g2', questions: [question(7), question(8)] }] },
        ],
      },
      {
        id: 12,
        skill_type: 'READING',
        parts: [
          { id: 105, part_number: 5, questionGroups: [{ group_id: 'g5', questions: [question(101), question(102)] }] },
        ],
      },
    ],
  });
}

const MODEL = makeModel();

function renderNav(overrides: Record<string, unknown> = {}) {
  return renderHook(
    (props: { attemptId: number; lockedPartIds: number[] }) =>
      useToeicWorkspaceNavigation({ model: MODEL, ...props }),
    { initialProps: { attemptId: 42, lockedPartIds: [] as number[], ...overrides } }
  );
}

describe('useToeicWorkspaceNavigation', () => {
  it('starts on the first navigable question', () => {
    const { result } = renderNav();
    expect(result.current.activePartId).toBe(101);
    expect(result.current.activeQuestionId).toBe('q_001');
  });

  it('moves across group and Part boundaries in server order', () => {
    const { result } = renderNav();

    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activeQuestionId).toBe('q_002');

    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activePartId).toBe(102);
    expect(result.current.activeQuestionId).toBe('q_007');

    act(() => { result.current.nextQuestion(); });
    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activePartId).toBe(105);
    expect(result.current.activeQuestionId).toBe('q_101');

    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activeQuestionId).toBe('q_102');

    act(() => { expect(result.current.nextQuestion()).toBe(false); });
    expect(result.current.activeQuestionId).toBe('q_102');
  });

  it('stops at the first question when moving backwards', () => {
    const { result } = renderNav();
    act(() => { expect(result.current.previousQuestion()).toBe(false); });
    expect(result.current.activeQuestionId).toBe('q_001');
  });

  it('navigates to an explicit Part/question pair and keeps the active question independent', () => {
    const { result } = renderNav();

    act(() => { expect(result.current.navigate(105, 'q_102')).toBe(true); });
    expect(result.current.activePartId).toBe(105);
    expect(result.current.activeQuestionId).toBe('q_102');

    act(() => { expect(result.current.navigateToQuestion('q_007')).toBe(true); });
    expect(result.current.activePartId).toBe(102);
    expect(result.current.activeQuestionId).toBe('q_007');
  });

  it('refuses a mismatched Part/question pair or an unknown question', () => {
    const { result } = renderNav();

    act(() => { expect(result.current.navigate(101, 'q_101')).toBe(false); });
    act(() => { expect(result.current.navigate(101, 'q_999')).toBe(false); });
    act(() => { expect(result.current.navigateToQuestion('q_999')).toBe(false); });
    expect(result.current.activePartId).toBe(101);
    expect(result.current.activeQuestionId).toBe('q_001');
  });

  it('guards locked Parts and skips them when stepping', () => {
    const { result } = renderNav({ lockedPartIds: [102] });

    expect(result.current.isLocked(102)).toBe(true);
    act(() => { expect(result.current.navigate(102, 'q_007')).toBe(false); });
    act(() => { expect(result.current.navigateToQuestion('q_008')).toBe(false); });
    expect(result.current.activeQuestionId).toBe('q_001');

    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activeQuestionId).toBe('q_002');

    act(() => { expect(result.current.nextQuestion()).toBe(true); });
    expect(result.current.activePartId).toBe(105);
    expect(result.current.activeQuestionId).toBe('q_101');
  });

  it('starts on the first unlocked Part when the first Part is locked', () => {
    const { result } = renderNav({ lockedPartIds: [101] });
    expect(result.current.activePartId).toBe(102);
    expect(result.current.activeQuestionId).toBe('q_007');
  });

  it('resets the active question when the route identity (attemptId) changes', () => {
    const { result, rerender } = renderNav();

    act(() => { result.current.navigate(105, 'q_102'); });
    expect(result.current.activeQuestionId).toBe('q_102');

    rerender({ attemptId: 43, lockedPartIds: [] });
    expect(result.current.activePartId).toBe(101);
    expect(result.current.activeQuestionId).toBe('q_001');
  });

  it('evicts active question from newly locked Part when lockedPartIds updates', () => {
    const { result, rerender } = renderNav();

    act(() => {
      expect(result.current.navigate(102, 'q_007')).toBe(true);
    });
    expect(result.current.activePartId).toBe(102);
    expect(result.current.activeQuestionId).toBe('q_007');

    rerender({ attemptId: 42, lockedPartIds: [102] });

    expect(result.current.activePartId).not.toBe(102);
    expect(result.current.activePartId).toBe(101);
    expect(result.current.activeQuestionId).toBe('q_001');
  });

  it('preserves active question when an unrelated Part is locked', () => {
    const { result, rerender } = renderNav();

    act(() => {
      expect(result.current.navigate(105, 'q_102')).toBe(true);
    });
    expect(result.current.activePartId).toBe(105);
    expect(result.current.activeQuestionId).toBe('q_102');

    rerender({ attemptId: 42, lockedPartIds: [102] });

    expect(result.current.activePartId).toBe(105);
    expect(result.current.activeQuestionId).toBe('q_102');
  });

  it('sets active to null when all Parts become locked', () => {
    const { result, rerender } = renderNav();

    expect(result.current.activePartId).toBe(101);

    rerender({ attemptId: 42, lockedPartIds: [101, 102, 105] });

    expect(result.current.activePartId).toBeNull();
    expect(result.current.activeQuestionId).toBeNull();
  });
});
