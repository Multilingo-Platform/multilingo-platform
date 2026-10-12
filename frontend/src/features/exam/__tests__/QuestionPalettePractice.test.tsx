import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { QuestionPalette } from '../components/QuestionPalette';
import { initialState } from '../store/answerSlice';
import type { Question } from '../types/exam.types';

const mockQuestionsPart1: Question[] = [
  {
    question_id: 'q1',
    question_number: 1,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 1',
    options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
    media: null,
  },
  {
    question_id: 'q2',
    question_number: 2,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 2',
    options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
    media: null,
  },
  {
    question_id: 'q3',
    question_number: 3,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 3',
    options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
    media: null,
  },
];

const mockQuestionsPart2: Question[] = [
  {
    question_id: 'q4',
    question_number: 4,
    type: 'SINGLE_CHOICE',
    question_text: 'Question 4',
    options: [{ id: 'A', text: 'Option A' }, { id: 'B', text: 'Option B' }],
    media: null,
  },
];

const mockAllParts = [
  {
    part_id: 10,
    title: 'Part 1',
    questions: mockQuestionsPart1,
  },
  {
    part_id: 20,
    title: 'Part 2',
    questions: mockQuestionsPart2,
  },
];

describe('QuestionPalette Practice Integration (AC-05, AC-08)', () => {
  it('enables all cells when visibleQuestionIds is omitted', () => {
    const store = createTestStore({
      answers: {
        ...initialState,
        answers: { 10: { q1: 'A' } },
      },
    });

    const handleNavigate = vi.fn();
    render(
      <Provider store={store}>
        <QuestionPalette
          allParts={mockAllParts}
          activePartId={10}
          onNavigate={handleNavigate}
        />
      </Provider>
    );

    const cellQ1 = screen.getByTestId('palette-q1');
    const cellQ2 = screen.getByTestId('palette-q2');
    const cellQ3 = screen.getByTestId('palette-q3');
    const cellQ4 = screen.getByTestId('palette-q4');

    expect(cellQ1).not.toBeDisabled();
    expect(cellQ2).not.toBeDisabled();
    expect(cellQ3).not.toBeDisabled();
    expect(cellQ4).not.toBeDisabled();

    fireEvent.click(cellQ2);
    expect(handleNavigate).toHaveBeenCalledWith(10, 'q2');
  });

  it('disables questions outside visibleQuestionIds in the current active Part during retry', () => {
    const store = createTestStore({
      answers: {
        ...initialState,
        answers: { 10: { q1: 'A', q2: 'B' } },
      },
    });

    const handleNavigate = vi.fn();
    // Only q2 is in retry round for Part 10
    render(
      <Provider store={store}>
        <QuestionPalette
          allParts={mockAllParts}
          activePartId={10}
          visibleQuestionIds={['q2']}
          onNavigate={handleNavigate}
        />
      </Provider>
    );

    const cellQ1 = screen.getByTestId('palette-q1');
    const cellQ2 = screen.getByTestId('palette-q2');
    const cellQ3 = screen.getByTestId('palette-q3');

    // q1 and q3 are outside visibleQuestionIds in Part 10 -> disabled
    expect(cellQ1).toBeDisabled();
    expect(cellQ1).toHaveAttribute('aria-disabled', 'true');
    expect(cellQ3).toBeDisabled();
    expect(cellQ3).toHaveAttribute('aria-disabled', 'true');

    // q2 is inside visibleQuestionIds -> enabled
    expect(cellQ2).not.toBeDisabled();
    expect(cellQ2).toHaveAttribute('aria-disabled', 'false');

    // Clicking disabled cell should not trigger navigation
    fireEvent.click(cellQ1);
    expect(handleNavigate).not.toHaveBeenCalled();

    // Clicking enabled cell triggers navigation
    fireEvent.click(cellQ2);
    expect(handleNavigate).toHaveBeenCalledWith(10, 'q2');
  });

  it('allows navigation to questions in OTHER parts even during retry in current Part', () => {
    const store = createTestStore({
      answers: {
        ...initialState,
        answers: {},
      },
    });

    const handleNavigate = vi.fn();
    // Active part is 10, retry is active with q2
    render(
      <Provider store={store}>
        <QuestionPalette
          allParts={mockAllParts}
          activePartId={10}
          visibleQuestionIds={['q2']}
          onNavigate={handleNavigate}
        />
      </Provider>
    );

    // Question in Part 20 (q4) is NOT disabled because it belongs to another Part
    const cellQ4 = screen.getByTestId('palette-q4');
    expect(cellQ4).not.toBeDisabled();
    expect(cellQ4).toHaveAttribute('aria-disabled', 'false');

    fireEvent.click(cellQ4);
    expect(handleNavigate).toHaveBeenCalledWith(20, 'q4');
  });

  it('preserves progress as answeredCount / total without converting to correct/checked count', () => {
    const store = createTestStore({
      answers: {
        ...initialState,
        answers: {
          10: { q1: 'A' },
          20: { q4: 'B' },
        },
      },
    });

    render(
      <Provider store={store}>
        <QuestionPalette
          allParts={mockAllParts}
          activePartId={10}
          visibleQuestionIds={['q2']}
          onNavigate={vi.fn()}
        />
      </Provider>
    );

    // Total across Part 10 (3) and Part 20 (1) = 4 questions
    // Answered = q1 and q4 = 2 questions
    // Progress should show 2/4 câu regardless of retry visibleQuestionIds
    expect(screen.getByText('2/4 câu')).toBeInTheDocument();
  });
});
