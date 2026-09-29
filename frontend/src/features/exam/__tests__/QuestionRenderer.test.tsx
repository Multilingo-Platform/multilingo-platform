import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionRenderer from '../components/renderers/QuestionRenderer';
import type { Question } from '../types/exam.types';

function makeQuestion(type: string, options?: Array<{id: string; text: string}>): Question {
  return {
    question_id: 'q_001',
    question_number: 1,
    type: type as Question['type'],
    question_text: 'Test question?',
    options: options ?? null,
    media: null,
  };
}

const opts = [
  { id: 'A', text: 'Option A' },
  { id: 'B', text: 'Option B' },
  { id: 'C', text: 'Option C' },
  { id: 'D', text: 'Option D' },
];

describe('QuestionRenderer', () => {
  it('TC_WS_QTYPE_01: SINGLE_CHOICE renders radio buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('SINGLE_CHOICE', opts)} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('TC_WS_QTYPE_02: TRUE_FALSE_NOT_GIVEN renders 3 buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('TRUE_FALSE_NOT_GIVEN')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText('TRUE')).toBeTruthy();
    expect(screen.getByText('FALSE')).toBeTruthy();
    expect(screen.getByText('NOT GIVEN')).toBeTruthy();
  });

  it('TC_WS_QTYPE_03: YES_NO_NOT_GIVEN renders 3 buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('YES_NO_NOT_GIVEN')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText('YES')).toBeTruthy();
    expect(screen.getByText('NO')).toBeTruthy();
    expect(screen.getByText('NOT GIVEN')).toBeTruthy();
  });

  it('TC_WS_QTYPE_04: FILL_IN_THE_BLANK renders text input', () => {
    render(
      <QuestionRenderer question={makeQuestion('FILL_IN_THE_BLANK')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('TC_WS_QTYPE_05: ESSAY renders textarea', () => {
    render(
      <QuestionRenderer question={makeQuestion('ESSAY')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole('textbox').tagName.toLowerCase()).toBe('textarea');
  });

  it('TC_WS_QTYPE_06: MULTIPLE_CHOICE renders checkboxes', () => {
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={[]} onChange={vi.fn()} />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('TC_WS_QTYPE_07: unknown type renders fallback without crashing', () => {
    render(
      <QuestionRenderer question={makeQuestion('FUTURE_TYPE')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText(/chưa được hỗ trợ/i)).toBeTruthy();
  });

  it('SINGLE_CHOICE onChange returns option id string', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('SINGLE_CHOICE', opts)} partId={1} currentAnswer={null} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option A'));
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('MULTIPLE_CHOICE adds to array on check', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={['B']} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option C'));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['B', 'C']));
  });

  it('MULTIPLE_CHOICE removes from array on uncheck', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={['B', 'C']} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option B'));
    expect(onChange).toHaveBeenCalledWith(['C']);
  });
});
