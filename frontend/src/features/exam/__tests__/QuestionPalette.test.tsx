import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { setAttemptContext, setAnswer, toggleFlag } from '../store/answerSlice';
import QuestionPalette from '../components/QuestionPalette';
import type { Question } from '../types/exam.types';

function makeQuestion(id: string, num: number): Question {
  return { question_id: id, question_number: num, type: 'SINGLE_CHOICE', question_text: '', options: [], media: null };
}

function makeStore(answeredIds: string[] = []) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  store.dispatch(setAttemptContext({ attemptId: 1, version: 1, savedAnswers: [] }));
  answeredIds.forEach(id => store.dispatch(setAnswer({ partId: 1, questionId: id, value: 'A' })));
  return store;
}

const questions = [
  makeQuestion('q_001', 1), makeQuestion('q_002', 2), makeQuestion('q_003', 3),
  makeQuestion('q_004', 4), makeQuestion('q_005', 5),
];

describe('QuestionPalette', () => {
  it('TC_WS_PAL_01: shows answered/blank distinction for 3 of 5 answered', () => {
    const store = makeStore(['q_001', 'q_003', 'q_005']);
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_002')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('palette-q_003')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_005')).toHaveAttribute('data-answered', 'true');
  });

  it('TC_WS_PAL_02: activates through native button semantics exactly once', () => {
    const onNavigate = vi.fn();
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={onNavigate} />
      </Provider>
    );
    const cell = screen.getByTestId('palette-q_003');
    expect(cell.tagName).toBe('BUTTON');

    // A real Enter/Space press on a native button produces a single click; the cell must not add
    // its own key handler or the browser's native activation would trigger navigation twice.
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onNavigate).not.toHaveBeenCalled();

    fireEvent.click(cell);
    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('q_003');

    fireEvent.keyUp(cell, { key: ' ' });
    fireEvent.keyDown(cell, { key: ' ' });
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('TC_WS_PAL_03: renders all 5 cells', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getAllByTestId(/palette-q_/)).toHaveLength(5);
  });

  it('click triggers onNavigate', () => {
    const onNavigate = vi.fn();
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={onNavigate} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('palette-q_002'));
    expect(onNavigate).toHaveBeenCalledWith('q_002');
  });

  it('TC_WS_PAL_04: shows flagged state on cell and in legend', () => {
    const store = makeStore();
    store.dispatch(toggleFlag({ partId: 1, questionId: 'q_002' }));
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    const cell = screen.getByTestId('palette-q_002');
    expect(cell).toHaveAttribute('data-flagged', 'true');
    expect(screen.getByText(/Đánh dấu xem lại/i)).toBeInTheDocument();
  });

  it('TC_WS_PAL_05: question with empty string or whitespace is considered unanswered', () => {
    const store = makeStore();
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: '' }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: '   ' }));
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('palette-q_002')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByText('0/5 câu')).toBeInTheDocument();
  });

  it('TC_WS_PAL_06: typing text then clearing returns question to unanswered state', () => {
    const store = makeStore();
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'Essay draft' }));
    const { rerender } = render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByText('1/5 câu')).toBeInTheDocument();

    // User clears all text
    act(() => {
      store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: '' }));
    });
    rerender(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByText('0/5 câu')).toBeInTheDocument();
  });

  it('TC_WS_PAL_07: traverses nested questionGroups without a flat questions list', () => {
    const groupedQuestions = [
      { question_id: 'q_007', type: 'SINGLE_CHOICE' as const, question_text: '', options: [], media: null },
      { question_id: 'q_008', type: 'SINGLE_CHOICE' as const, question_text: '', options: [], media: null },
    ];
    const groupedPart = {
      part_id: 20,
      part_number: 2,
      title: 'Part 2',
      questionGroups: [{ group_id: 'g2', questions: groupedQuestions }],
    };
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette allParts={[groupedPart]} activePartId={20} isToeicExam onNavigate={vi.fn()} />
      </Provider>
    );

    // Whole-exam numbers come from the canonical q_ id, not from the array index.
    expect(screen.getByTestId('palette-q_007')).toHaveTextContent('7');
    expect(screen.getByTestId('palette-q_008')).toHaveTextContent('8');
    expect(screen.getByText('0/2 câu')).toBeInTheDocument();
  });

  it('TC_WS_PAL_08: marks the active question with aria-current', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} activeQuestionId="q_003" onNavigate={vi.fn()} />
      </Provider>
    );

    expect(screen.getByTestId('palette-q_003')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('palette-q_002')).not.toHaveAttribute('aria-current');
  });

  it('TC_WS_PAL_09: never labels a cell with the DB id or array index', () => {
    const identityless = [
      { id: 555, question_id: 'custom_1', type: 'SINGLE_CHOICE' as const, question_text: '', options: [], media: null },
    ];
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={identityless as any} partId={1} isToeicExam onNavigate={vi.fn()} />
      </Provider>
    );

    const cell = screen.getByTestId('palette-custom_1');
    expect(cell.textContent ?? '').not.toContain('555');
    expect(cell.getAttribute('aria-label') ?? '').not.toContain('555');
    expect(cell.getAttribute('aria-label') ?? '').not.toContain('1)');
  });

  it('TC_WS_PAL_11: non-TOEIC exams keep their own numbering instead of a TOEIC "–"', () => {
    // IELTS Listening Part 3: global-Part id 3 but questions are numbered 21..30, outside the
    // TOEIC Part 3 range (32..70). The shared palette must not blank them.
    const ieltsQuestions = [
      { question_id: 'l_021', question_number: 21, type: 'SINGLE_CHOICE' as const, question_text: '', options: [], media: null },
      { question_id: 'l_022', question_number: 22, type: 'SINGLE_CHOICE' as const, question_text: '', options: [], media: null },
    ];
    const ieltsPart = {
      id: 203,
      part_number: 3,
      title: 'Part 3',
      question_groups: [{ group_id: 'ielts-p3-g1', questions: ieltsQuestions }],
    };
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette allParts={[ieltsPart]} activePartId={203} onNavigate={vi.fn()} />
      </Provider>
    );

    expect(screen.getByTestId('palette-l_021')).toHaveTextContent('21');
    expect(screen.getByTestId('palette-l_022')).toHaveTextContent('22');
    expect(screen.getByTestId('palette-l_021')).toHaveAccessibleName(/Câu 21/);
  });

  it('TC_WS_PAL_10: exposes answered and flagged state in the accessible name', () => {
    const store = makeStore();
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: 'A' }));
    store.dispatch(toggleFlag({ partId: 1, questionId: 'q_002' }));
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );

    const cell = screen.getByTestId('palette-q_002');
    expect(cell).toHaveAccessibleName(/Câu 2/);
    expect(cell).toHaveAccessibleName(/đã gắn cờ/i);
    expect(cell).toHaveAccessibleName(/đã trả lời/i);
    expect(cell.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});
