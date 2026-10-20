import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import WritingPromptContent from '../components/workspace/WritingPromptContent';
import type { QuestionGroup, Question } from '../types/exam.types';

describe('WritingPromptContent', () => {
  it('renders Writing Task 1 with group.shared_media image and prompt text', () => {
    const groups: QuestionGroup[] = [
      {
        group_id: 'ielts-p8-g1',
        instruction: 'You should spend about 20 minutes on this task. Write at least 150 words.',
        context_html: null,
        shared_audio: null,
        shared_media: {
          type: 'image',
          url: 'https://res.cloudinary.com/demo/image/upload/v1/chart.png',
        },
        questions: [
          {
            type: 'ESSAY',
            question_id: 'w_001',
            question_number: 1,
            question_text: 'The table shows changes in NYC population...',
            options: null,
            media: null,
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 1"
        partInstruction="You should spend about 20 minutes on this task."
        groups={groups}
      />
    );

    // Title and instructions
    expect(screen.getByRole('heading', { level: 2, name: /Writing Task 1/i })).toBeInTheDocument();
    expect(screen.getByText(/You should spend about 20 minutes on this task/i)).toBeInTheDocument();

    // Image rendered
    const img = screen.getByRole('img', { name: /hình minh họa|Writing Task 1|ielts-p8-g1/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/v1/chart.png');

    // Prompt text
    expect(screen.getByText(/The table shows changes in NYC population/i)).toBeInTheDocument();
  });

  it('renders Writing Task 2 without duplicating prompt when group context and question text match', () => {
    const prompt = 'Access to clean water is a basic human right. Do you agree or disagree?';
    const groups: any[] = [
      {
        group_id: 'ielts-p9-g1',
        instruction: 'You should spend about 40 minutes on this task. Write at least 250 words.',
        content_html: `<p>${prompt}</p>`,
        shared_audio: null,
        shared_media: null,
        questions: [
          {
            type: 'ESSAY',
            question_id: 'w_002',
            question_number: 2,
            question_text: prompt,
            options: null,
            media: null,
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 2"
        partInstruction="You should spend about 40 minutes on this task."
        groups={groups}
      />
    );

    // Prompt text should appear exactly once in the document
    const promptElements = screen.getAllByText(new RegExp(prompt, 'i'));
    expect(promptElements).toHaveLength(1);
  });

  it('does not duplicate prompt when question_text contains "Writing Task 1:" prefix and extra newlines', () => {
    const rawPrompt =
      'The first table below shows changes in the total population of New York City from 1800 to 2000.\nSummarise the information by selecting and reporting the main features.';
    const questionTextWithPrefix =
      'Writing Task 1: The first table below shows changes in the total population of New York City from 1800 to 2000.\n\nSummarise the information by selecting and reporting the main features.';

    const groups: any[] = [
      {
        group_id: 'ielts-p8-g1',
        instruction: 'You should spend about 20 minutes on this task. Write at least 150 words.',
        content_html: rawPrompt,
        shared_audio: null,
        shared_media: null,
        questions: [
          {
            type: 'ESSAY',
            question_id: 'w_001',
            question_number: 1,
            question_text: questionTextWithPrefix,
            options: null,
            media: null,
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 1"
        partInstruction="You should spend about 20 minutes on this task."
        groups={groups}
      />
    );

    // The text from rawPrompt must appear only once, not twice
    const matches = screen.getAllByText(/The first table below shows changes in the total population of New York City/i);
    expect(matches).toHaveLength(1);
  });

  it('does not duplicate prompt when question_text contains "Writing Task 2:" prefix and extra newlines', () => {
    const rawPrompt =
      'Access to clean water is a basic human right. Therefore, every home should have a water supply.\nDo you agree or disagree?';
    const questionTextWithPrefix =
      'Writing Task 2: Access to clean water is a basic human right. Therefore, every home should have a water supply.\n\nDo you agree or disagree?';

    const groups: any[] = [
      {
        group_id: 'ielts-p9-g1',
        instruction: 'You should spend about 40 minutes on this task. Write at least 250 words.',
        content_html: rawPrompt,
        shared_audio: null,
        shared_media: null,
        questions: [
          {
            type: 'ESSAY',
            question_id: 'w_002',
            question_number: 2,
            question_text: questionTextWithPrefix,
            options: null,
            media: null,
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 2"
        partInstruction="You should spend about 40 minutes on this task."
        groups={groups}
      />
    );

    const matches = screen.getAllByText(/Access to clean water is a basic human right/i);
    expect(matches).toHaveLength(1);
  });

  it('falls back to question_text when group content_html and context_html are empty', () => {
    const fallbackText = 'Write about the effects of social media.';
    const groups: QuestionGroup[] = [
      {
        group_id: 'g-fallback',
        instruction: null,
        context_html: null,
        shared_audio: null,
        shared_media: null,
        questions: [
          {
            type: 'ESSAY',
            question_id: 'w_fallback',
            question_number: 1,
            question_text: fallbackText,
            options: null,
            media: null,
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 2"
        groups={groups}
      />
    );

    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('handles image error with a friendly notice while keeping text readable', () => {
    const groups: QuestionGroup[] = [
      {
        group_id: 'g-err',
        instruction: 'Spend 20 mins.',
        context_html: '<p>Prompt with broken image</p>',
        shared_audio: null,
        shared_media: {
          type: 'image',
          url: 'https://example.com/broken.png',
        },
        questions: [],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 1"
        groups={groups}
      />
    );

    const img = screen.getByRole('img');
    fireEvent.error(img);

    expect(screen.getByText(/Không tải được hình minh họa đề bài/i)).toBeInTheDocument();
    expect(screen.getByText(/Prompt with broken image/i)).toBeInTheDocument();
  });

  it('deduplicates media when the same URL appears in part and group', () => {
    const mediaUrl = 'https://example.com/same-chart.png';
    const groups: QuestionGroup[] = [
      {
        group_id: 'g-1',
        instruction: null,
        context_html: '<p>Group 1</p>',
        shared_audio: null,
        shared_media: { type: 'image', url: mediaUrl },
        questions: [
          {
            type: 'ESSAY',
            question_id: 'q1',
            question_number: 1,
            question_text: 'Q1',
            options: null,
            media: { type: 'image', url: mediaUrl },
          },
        ],
      },
    ];

    render(
      <WritingPromptContent
        partTitle="Writing Task 1"
        partSharedMedia={{ type: 'image', url: mediaUrl }}
        groups={groups}
      />
    );

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(images[0]).toHaveAttribute('src', mediaUrl);
  });

  it('renders question.media when group does not have shared_media and preserves group order', () => {
    const groups: QuestionGroup[] = [
      {
        group_id: 'g-order-1',
        instruction: null,
        context_html: '<p>First Topic</p>',
        shared_audio: null,
        shared_media: null,
        questions: [
          {
            type: 'ESSAY',
            question_id: 'q_media',
            question_number: 1,
            question_text: 'Describe this graph',
            options: null,
            media: { type: 'image', url: 'https://example.com/q-media.png' },
          },
        ],
      },
      {
        group_id: 'g-order-2',
        instruction: null,
        context_html: '<p>Second Topic</p>',
        shared_audio: null,
        shared_media: null,
        questions: [],
      },
    ];

    const { container } = render(
      <WritingPromptContent partTitle="Writing Task 1" groups={groups} />
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/q-media.png');

    // Check order of First Topic before Second Topic
    const textContent = container.textContent || '';
    const firstIdx = textContent.indexOf('First Topic');
    const secondIdx = textContent.indexOf('Second Topic');
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
  });
});
