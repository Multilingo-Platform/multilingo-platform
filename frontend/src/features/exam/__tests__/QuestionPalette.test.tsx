import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { setAttemptContext, setAnswer } from '../store/answerSlice';
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

  it('TC_WS_PAL_02: Enter key triggers onNavigate', () => {
    const onNavigate = vi.fn();
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={onNavigate} />
      </Provider>
    );
    const cell = screen.getByTestId('palette-q_003');
    cell.focus();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('q_003');
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
});
