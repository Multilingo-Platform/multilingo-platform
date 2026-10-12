import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { attemptReviewFixture } from './fixtures/attemptReview';

describe('PartReviewContent', () => {
  const fixture = attemptReviewFixture(42, 10);

  it('renders part header, title, and statistics correctly', () => {
    render(<PartReviewContent reviewData={fixture as any} />);

    expect(screen.getByText('Reading Passage 1')).toBeInTheDocument();
    expect(screen.getByText(/50%/i)).toBeInTheDocument(); // accuracy
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument(); // 1/2 correct
  });

  it('renders question groups with instruction and sanitized contentHtml', () => {
    render(<PartReviewContent reviewData={fixture as any} />);

    expect(screen.getByText('Choose the correct option for questions 1-2')).toBeInTheDocument();
    expect(screen.getByText('Passage content')).toBeInTheDocument();
  });

  it('renders question cards for all questions in the part', () => {
    render(<PartReviewContent reviewData={fixture as any} />);

    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();
    expect(screen.getByText('Is it adaptive?')).toBeInTheDocument();
  });

  it('filters questions when filter controls are toggled', () => {
    render(<PartReviewContent reviewData={fixture as any} />);

    const wrongFilter = screen.getByRole('button', { name: /Câu sai/i });
    fireEvent.click(wrongFilter);

    // Question 1 was CORRECT, Question 2 was WRONG
    expect(screen.queryByText('What does AI offer?')).not.toBeInTheDocument();
    expect(screen.getByText('Is it adaptive?')).toBeInTheDocument();

    const allFilter = screen.getByRole('button', { name: /Tất cả/i });
    fireEvent.click(allFilter);

    expect(screen.getByText('What does AI offer?')).toBeInTheDocument();
    expect(screen.getByText('Is it adaptive?')).toBeInTheDocument();
  });

  it('renders audio player without autoplay when audio is present', () => {
    const fixtureWithAudio = {
      ...fixture,
      skill: 'LISTENING',
      audioUrl: 'https://example.com/audio.mp3',
    };

    const { container } = render(<PartReviewContent reviewData={fixtureWithAudio as any} />);

    const audio = container.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio?.autoplay).toBe(false);
  });

  it('renders part-level passage stimulus and audio from examData wire contract', () => {
    const fixtureWithPartContext = {
      ...fixture,
      examData: {
        title: 'Reading Part 10',
        contentHtml: '<div class="passage-body">Full Part 10 reading passage text.</div>',
        sharedAudio: { url: 'https://example.com/part-shared-audio.mp3' },
      },
    };

    render(<PartReviewContent reviewData={fixtureWithPartContext as any} />);

    expect(screen.getByTestId('part-stimulus')).toBeInTheDocument();
    expect(screen.getByText('Full Part 10 reading passage text.')).toBeInTheDocument();

    const partAudio = screen.getByTestId('part-audio').querySelector('audio');
    expect(partAudio).toBeInTheDocument();
    expect(partAudio?.src).toBe('https://example.com/part-shared-audio.mp3');
    expect(partAudio?.autoplay).toBe(false);
  });

  it('renders group-level audio from group.sharedAudio wire contract', () => {
    const fixtureWithGroupAudio = {
      ...fixture,
      skill: 'LISTENING',
      questionGroups: [
        {
          groupId: 'g_audio_1',
          instruction: 'Listen to the conversation',
          contentHtml: '<p>Conversation transcript</p>',
          sharedAudio: { url: 'https://example.com/group-audio-conv.mp3' },
          questions: [
            {
              questionId: 'q1',
              type: 'SINGLE_CHOICE',
              questionText: 'What does AI offer?',
              verdict: 'CORRECT',
            },
          ],
        },
      ],
    };

    render(<PartReviewContent reviewData={fixtureWithGroupAudio as any} />);

    expect(screen.getByTestId('group-audio')).toBeInTheDocument();
    const groupAudio = screen.getByTestId('group-audio').querySelector('audio');
    expect(groupAudio).toBeInTheDocument();
    expect(groupAudio?.src).toBe('https://example.com/group-audio-conv.mp3');
  });

  it('passes resultSummary down to render Writing task status correctly', () => {
    const writingFixture = {
      ...fixture,
      skill: 'WRITING',
      partId: 20,
      questions: [
        {
          questionId: 'essay_task',
          type: 'ESSAY',
          label: 'Writing Task 1',
          prompt: 'Write an email',
          verdict: 'PENDING',
          score: null,
          userAnswer: 'My submitted email',
        },
      ],
      questionGroups: [],
    };

    const summary = {
      writing: {
        status: 'FAILED',
        tasks: [
          {
            partId: 20,
            questionId: 'essay_task',
            label: 'Writing Task 1',
            status: 'FAILED',
            wordCount: 150,
            score: null,
            maxScore: null,
          },
        ],
      },
    } as any;

    render(<PartReviewContent reviewData={writingFixture as any} resultSummary={summary} />);

    expect(screen.getByText('Chấm điểm không thành công')).toBeInTheDocument();
    expect(screen.queryByText('Đang chấm')).not.toBeInTheDocument();
  });

  it('cleans up and pauses audio playback when partId changes', () => {
    const pauseSpy = vi.fn();
    HTMLMediaElement.prototype.pause = pauseSpy;

    const fixtureA = {
      ...fixture,
      partId: 10,
      examData: {
        sharedAudio: { url: 'https://example.com/audio10.mp3' },
      },
    };

    const fixtureB = {
      ...fixture,
      partId: 15,
      examData: {
        sharedAudio: { url: 'https://example.com/audio15.mp3' },
      },
    };

    const { rerender } = render(<PartReviewContent reviewData={fixtureA as any} />);
    expect(screen.getByTestId('part-audio')).toBeInTheDocument();

    rerender(<PartReviewContent reviewData={fixtureB as any} />);
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('renders empty message when no questions exist in part', () => {
    const emptyFixture = {
      ...fixture,
      questions: [],
      questionGroups: [],
    };

    render(<PartReviewContent reviewData={emptyFixture as any} />);
    expect(screen.getByText(/Không có câu hỏi trong phần thi này/i)).toBeInTheDocument();
  });
});
