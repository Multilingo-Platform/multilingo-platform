import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { setAttemptContext, addHighlightRecord } from '../store/answerSlice';
import authReducer from '../../auth/store/authSlice';
import WorkspaceText from '../components/content/WorkspaceText';
import {
  WorkspaceAnnotationsContext,
  useWorkspaceAnnotations,
} from '../hooks/useWorkspaceAnnotations';
import SingleChoiceRenderer from '../components/renderers/SingleChoiceRenderer';
import MultipleChoiceRenderer from '../components/renderers/MultipleChoiceRenderer';
import TFNGRenderer from '../components/renderers/TFNGRenderer';
import MatchingRenderer from '../components/renderers/MatchingRenderer';
import FillInBlankRenderer from '../components/renderers/FillInBlankRenderer';
import EssayRenderer from '../components/renderers/EssayRenderer';
import QuestionCard from '../components/workspace/QuestionCard';
import type { WorkspaceTextSource } from '../types/workspaceText.types';
import { workspaceTextSourceKey, workspaceTextHash } from '../utils/workspaceTextDocuments';

describe('WorkspaceText and WorkspaceAnnotations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders plain text with proper data attributes and lang tag', () => {
    const source: WorkspaceTextSource = { kind: 'QUESTION_TEXT', questionId: 'q-101' };
    const content = 'What is the main topic of the passage?';
    const hash = workspaceTextHash(content);

    render(
      <WorkspaceText
        source={source}
        format="TEXT"
        content={content}
        lang="en"
        className="font-medium text-slate-900"
      />
    );

    const el = screen.getByText('What is the main topic of the passage?');
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute('data-highlight-scope', workspaceTextSourceKey(source));
    expect(el).toHaveAttribute('data-highlight-hash', hash);
    expect(el).toHaveAttribute('data-source-kind', 'QUESTION_TEXT');
    expect(el).toHaveAttribute('lang', 'en');
  });

  it('renders HTML content sanitized and applies highlight marks from context', () => {
    const source: WorkspaceTextSource = { kind: 'PART_CONTENT' };
    const content = '<p>Welcome to the international conference on AI.</p>';
    const text = 'Welcome to the international conference on AI.';
    const hash = workspaceTextHash(text);

    const contextValue = {
      getHighlights: (s: WorkspaceTextSource, h?: string | null) => {
        if (s.kind === 'PART_CONTENT') {
          return [
            { id: 'hl-1', start: 0, end: 7, text: 'Welcome', color: 'green' as const },
            { id: 'hl-2', start: 15, end: 28, text: 'international', color: 'pink' as const },
          ];
        }
        return [];
      },
      namespaceFor: () => 'hl:test',
      learningLanguage: 'en',
    };

    render(
      <WorkspaceAnnotationsContext.Provider value={contextValue}>
        <WorkspaceText
          source={source}
          format="HTML"
          content={content}
          lang="en"
          className="prose"
        />
      </WorkspaceAnnotationsContext.Provider>
    );

    const container = screen.getByTestId('workspace-text-PART_CONTENT');
    expect(container).toHaveAttribute('data-highlight-scope', 'PART_CONTENT');
    expect(container).toHaveAttribute('data-highlight-hash', hash);

    const markGreen = container.querySelector('mark[data-hl-color="green"]');
    expect(markGreen).toBeInTheDocument();
    expect(markGreen?.textContent).toBe('Welcome');
    expect(markGreen).toHaveClass('bg-green-200');

    const markPink = container.querySelector('mark[data-hl-color="pink"]');
    expect(markPink).toBeInTheDocument();
    expect(markPink?.textContent).toBe('international');
    expect(markPink).toHaveClass('bg-pink-200');
  });

  it('renders safely outside WorkspaceAnnotationsContext without crashing', () => {
    const source: WorkspaceTextSource = { kind: 'PART_TITLE' };
    const content = 'Reading Comprehension';

    render(<WorkspaceText source={source} format="TEXT" content={content} />);
    expect(screen.getByText('Reading Comprehension')).toBeInTheDocument();
  });

  describe('Option Drag vs Click vs Keyboard in SingleChoiceRenderer', () => {
    it('allows simple click to select option, but committed drag consumes trailing click without changing answer', () => {
      const onAnswer = vi.fn();
      let trailingClickActive = false;

      function TrailingClickCaptureWrapper({ children }: { children: React.ReactNode }) {
        return (
          <div
            onClickCapture={(e) => {
              if (trailingClickActive) {
                trailingClickActive = false;
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {children}
          </div>
        );
      }

      const { rerender } = render(
        <TrailingClickCaptureWrapper>
          <SingleChoiceRenderer
            options={[
              { id: 'A', text: 'First choice option' },
              { id: 'B', text: 'Second choice option' },
            ]}
            value={null}
            onChange={onAnswer}
            questionId="q-test-1"
          />
        </TrailingClickCaptureWrapper>
      );

      // 1. Normal click on option A calls onAnswer('A')
      const optionA = screen.getByText('First choice option');
      fireEvent.click(optionA);
      expect(onAnswer).toHaveBeenCalledWith('A');
      onAnswer.mockClear();

      // 2. Simulate text selection drag across option B:
      // When drag selection commits, trailingClickActive is set to true
      trailingClickActive = true;
      const optionB = screen.getByText('Second choice option');
      // The browser fires trailing click on option B after mouseup
      fireEvent.click(optionB);

      // Trailing click was intercepted and swallowed by capture phase!
      expect(onAnswer).not.toHaveBeenCalled();
      expect(trailingClickActive).toBe(false);

      // 3. Next normal click on option B succeeds
      fireEvent.click(optionB);
      expect(onAnswer).toHaveBeenCalledWith('B');
    });

    it('allows keyboard activation (Space / Enter) without trailing click interference', () => {
      const onAnswer = vi.fn();
      render(
        <SingleChoiceRenderer
          options={[
            { id: 'A', text: 'Keyboard option A' },
            { id: 'B', text: 'Keyboard option B' },
          ]}
          value={null}
          onChange={onAnswer}
          questionId="q-kb"
        />
      );

      const radioA = screen.getByRole('radio', { name: 'Keyboard option A' });
      fireEvent.click(radioA, { detail: 0 }); // Keyboard synthetic click has detail: 0
      expect(onAnswer).toHaveBeenCalledWith('A');
    });
  });

  describe('Integration with Question Renderers', () => {
    it('SingleChoiceRenderer wraps option texts in WorkspaceText', () => {
      render(
        <SingleChoiceRenderer
          options={[{ id: 'A', text: 'Paris is the capital' }]}
          value={null}
          onChange={vi.fn()}
          questionId="q-single"
        />
      );

      const el = screen.getByText('Paris is the capital');
      expect(el).toHaveAttribute('data-highlight-scope', 'OPTION_TEXT:8:q-single:1:A');
      expect(el).toHaveAttribute('data-source-kind', 'OPTION_TEXT');
    });

    it('MultipleChoiceRenderer wraps option texts in WorkspaceText', () => {
      render(
        <MultipleChoiceRenderer
          options={[{ id: 'A', text: 'Option Alpha' }]}
          value={[]}
          onChange={vi.fn()}
          questionId="q-multi"
        />
      );

      const el = screen.getByText('Option Alpha');
      expect(el).toHaveAttribute('data-highlight-scope', 'OPTION_TEXT:7:q-multi:1:A');
      expect(el).toHaveAttribute('data-source-kind', 'OPTION_TEXT');
    });

    it('TFNGRenderer wraps canonical tokens in WorkspaceText', () => {
      render(
        <TFNGRenderer
          variant="TRUE_FALSE_NOT_GIVEN"
          value={null}
          onChange={vi.fn()}
          questionId="q-tfng"
        />
      );

      const trueBtn = screen.getByRole('button', { name: /TRUE/i });
      const textSpan = trueBtn.querySelector('[data-highlight-scope]');
      expect(textSpan).toBeInTheDocument();
      expect(textSpan).toHaveAttribute('data-source-kind', 'OPTION_TEXT');
      expect(textSpan).toHaveAttribute('data-highlight-scope', 'OPTION_TEXT:6:q-tfng:4:TRUE');
    });

    it('MatchingRenderer provides static option bank alongside native select for selection/lookup', () => {
      render(
        <MatchingRenderer
          options={[
            { id: 'A', text: 'Heading One' },
            { id: 'B', text: 'Heading Two' },
          ]}
          value={null}
          onChange={vi.fn()}
          questionText="Match statement with heading"
          questionId="q-match"
        />
      );

      // Question prompt wrapped in WorkspaceText
      const prompt = screen.getByText('Match statement with heading');
      expect(prompt).toHaveAttribute('data-highlight-scope', 'QUESTION_TEXT:7:q-match');

      // Static option bank has selectable WorkspaceText items
      const optA = screen.getByText('Heading One');
      expect(optA).toHaveAttribute('data-highlight-scope', 'OPTION_TEXT:7:q-match:1:A');

      // Native select remains present for answering
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
    });

    it('FillInBlankRenderer and EssayRenderer annotate question text but NOT user input fields', () => {
      render(
        <div>
          <FillInBlankRenderer
            value="user answer"
            onChange={vi.fn()}
            questionText="Complete the sentence: ..."
            questionId="q-fib"
          />
          <EssayRenderer
            value="User typed essay content here..."
            onChange={vi.fn()}
            questionText="Write an essay about technology."
            questionId="q-essay"
          />
        </div>
      );

      // Prompts are annotated
      expect(screen.getByText('Complete the sentence: ...')).toHaveAttribute('data-highlight-scope', 'QUESTION_TEXT:5:q-fib');
      expect(screen.getByText('Write an essay about technology.')).toHaveAttribute('data-highlight-scope', 'QUESTION_TEXT:7:q-essay');

      // Input and textarea are NOT annotated
      const input = screen.getByRole('textbox', { name: /Complete the sentence/i });
      expect(input).not.toHaveAttribute('data-highlight-scope');

      const textarea = screen.getByPlaceholderText(/Viết bài tự luận/i);
      expect(textarea).not.toHaveAttribute('data-highlight-scope');
    });

    it('QuestionCard respects hidePrompt and hideOptionsText and does not leak hidden spoken content', () => {
      render(
        <QuestionCard
          question={{
            question_id: 'q-hidden-test',
            question_number: 1,
            type: 'SINGLE_CHOICE',
            question_text: 'Secret spoken prompt that should be hidden',
            options: [
              { id: 'A', text: 'Secret option text A' },
              { id: 'B', text: 'Secret option text B' },
            ],
            media: null,
          }}
          partId={1}
          questionNumber={1}
          value={null}
          flagged={false}
          disabled={false}
          onAnswer={vi.fn()}
          onToggleFlag={vi.fn()}
          hidePrompt={true}
          hideOptionsText={true}
          revealOptions={false}
        />
      );

      // Spoken prompt is hidden from DOM
      expect(screen.queryByText('Secret spoken prompt that should be hidden')).toBeNull();

      // Option texts are hidden from DOM
      expect(screen.queryByText('Secret option text A')).toBeNull();
      expect(screen.queryByText('Secret option text B')).toBeNull();

      // Only letter labels are visible
      expect(screen.getByText('(A)')).toBeInTheDocument();
      expect(screen.getByText('(B)')).toBeInTheDocument();
    });
  });
});
