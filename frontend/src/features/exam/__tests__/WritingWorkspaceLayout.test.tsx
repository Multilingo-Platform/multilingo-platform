import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, { initialState } from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';
import * as workspaceHookModule from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';
import type { WorkspaceResponse } from '../types/api.types';
import { useAutosave } from '../hooks/useAutosave';

vi.mock('../hooks/useWorkspace');
vi.mock('../api/attemptApi');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

function setAutosaveController() {
  vi.mocked(useAutosave).mockReturnValue({
    pauseAndWait: vi.fn().mockResolvedValue({ status: 'ready' }),
    resume: vi.fn(),
    draftWarning: null,
  });
}
beforeEach(setAutosaveController);

const writingWorkspace: WorkspaceResponse = {
  attempt_id: 57,
  status: 'IN_PROGRESS',
  test_scope: 'FULL_EXAM',
  test_mode: 'MOCK_TEST',
  startTime: new Date(Date.now() - 60_000).toISOString(),
  deadline: new Date(Date.now() + 3600_000).toISOString(),
  serverTime: new Date().toISOString(),
  gracePeriodSeconds: 15,
  lockedSections: [],
  version: 1,
  saved_answers: [],
  serverTimeOffset: 0,
  exam_snapshot: {
    exam_id: 1,
    code: 'CAM20_T1',
    title: 'Cambridge IELTS 20 Academic Test 1',
    type: 'IELTS_ACADEMIC',
    sections: [
      {
        section_id: 3,
        id: 3,
        title: 'Writing',
        skill_type: 'WRITING',
        duration_minutes: 60,
        parts: [
          {
            part_id: 11,
            id: 11,
            title: 'Writing Task 1',
            instruction: 'You should spend about 20 minutes on this task.',
            questionGroups: [
              {
                group_id: 'g-w1',
                instruction: 'You should spend about 20 minutes on this task.',
                context_html: '<p>The chart below shows the population of New York.</p>',
                shared_audio: null,
                shared_media: {
                  url: 'https://example.com/ny-population.png',
                  type: 'image',
                },
                questions: [
                  {
                    question_id: 'q-w1',
                    question_number: 1,
                    type: 'ESSAY',
                    question_text: 'Summarise the information by selecting and reporting the main features.',
                    options: null,
                    media: null,
                  },
                ],
              },
            ],
          },
          {
            part_id: 12,
            id: 12,
            title: 'Writing Task 2',
            instruction: 'You should spend about 40 minutes on this task.',
            questionGroups: [
              {
                group_id: 'g-w2',
                instruction: 'You should spend about 40 minutes on this task.',
                context_html: '<p>Some people believe that university education should be free for all students.</p>',
                shared_audio: null,
                shared_media: null,
                questions: [
                  {
                    question_id: 'q-w2',
                    question_number: 2,
                    type: 'ESSAY',
                    question_text: 'Some people believe that university education should be free for all students.',
                    options: null,
                    media: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

function makeStore() {
  return configureStore({
    reducer: { answers: answerReducer },
    preloadedState: {
      answers: {
        ...initialState,
        attemptId: 57,
        version: 1,
        answers: {},
        isDirty: false,
        lastSavedAt: null,
        saveStatus: 'idle' as const,
        pendingVersion: 0,
        flags: {},
        highlights: {},
      },
    },
  });
}

function renderWorkspace(workspace: WorkspaceResponse = writingWorkspace) {
  vi.mocked(workspaceHookModule.default).mockReturnValue({
    workspace,
    loading: false,
    error: null,
    ready: true,
    retry: vi.fn(),
    refreshing: false,
    refreshError: null,
    refreshMetadata: vi.fn().mockResolvedValue(true),
  });

  const store = makeStore();
  const utils = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/57/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
  return { ...utils, store };
}

describe('WritingWorkspaceLayout (WW-02)', () => {
  it('TC_WW_01: Desktop renders WritingPromptContent in left pane, editor in right pane, and keeps sidebar', () => {
    const { container } = renderWorkspace();

    // 1. Left pane has desktop WritingPromptContent with part title and instruction
    const promptPane = screen.getByTestId('desktop-writing-prompt');
    expect(promptPane).toBeInTheDocument();
    expect(promptPane).toHaveTextContent('Writing Task 1');
    expect(promptPane).toHaveTextContent('You should spend about 20 minutes on this task.');
    expect(promptPane).toHaveTextContent('The chart below shows the population of New York.');

    // Mobile prompt is also prepared with lg:hidden
    const mobilePrompt = screen.getByTestId('mobile-writing-prompt');
    expect(mobilePrompt).toHaveClass('lg:hidden');

    // 2. Resizable divider exists with separator semantics and 35-65 bounds
    const divider = screen.getByTestId('pane-divider');
    expect(divider).toBeInTheDocument();
    expect(divider).toHaveAttribute('role', 'separator');
    expect(divider).toHaveAttribute('aria-valuenow', '50');
    expect(divider).toHaveAttribute('aria-valuemin', '35');
    expect(divider).toHaveAttribute('aria-valuemax', '65');

    // 3. Right pane has textarea at the top of question card
    const mainPane = screen.getByRole('main');
    expect(mainPane).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText(/Viết bài tự luận của bạn tại đây/i);
    expect(textarea).toBeInTheDocument();

    // 4. Word count bar is present below textarea
    const wordCount = screen.getByTestId('essay-word-count');
    expect(wordCount).toBeInTheDocument();

    // 5. Sidebar has part switcher and submit button
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside).toHaveTextContent('Chọn phần thi');
    expect(screen.getByRole('button', { name: /Nộp bài/i })).toBeInTheDocument();
  });

  it('TC_WW_02: Task 1 displays group shared_media image in left pane, not inside editor card', () => {
    const { container } = renderWorkspace();

    // Image is rendered in the left prompt pane
    const promptPane = screen.getByTestId('desktop-writing-prompt');
    const imagesInPrompt = promptPane.querySelectorAll('img');
    expect(imagesInPrompt.length).toBeGreaterThan(0);
    expect(imagesInPrompt[0].getAttribute('src')).toBe('https://example.com/ny-population.png');

    // Editor card does NOT duplicate the image
    const questionCard = container.querySelector('#q-q-w1');
    expect(questionCard).not.toBeNull();
    const imagesInCard = questionCard!.querySelectorAll('img');
    expect(imagesInCard.length).toBe(0);
  });

  it('TC_WW_03: Question prompt is not duplicated inside the question card above the textarea', () => {
    const { container } = renderWorkspace();

    const questionCard = container.querySelector('#q-q-w1');
    expect(questionCard).not.toBeNull();
    // Group context html shouldn't appear inside the card
    expect(questionCard!.textContent).not.toContain('The chart below shows the population of New York.');
    // And instructions shouldn't appear inside the card
    expect(questionCard!.textContent).not.toContain('You should spend about 20 minutes on this task.');
    // Textarea is immediately accessible inside card
    expect(questionCard!.querySelector('textarea')).not.toBeNull();
  });

  it('TC_WW_04: Divider supports keyboard resizing and clamps to 35-65', () => {
    renderWorkspace();

    const divider = screen.getByTestId('pane-divider');

    // ArrowLeft decreases ratio
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByRole('main').style.width).toBe('55%');

    // ArrowRight increases ratio
    fireEvent.keyDown(divider, { key: 'ArrowRight' });
    expect(divider).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('main').style.width).toBe('50%');

    // Home jumps to min (35)
    fireEvent.keyDown(divider, { key: 'Home' });
    expect(divider).toHaveAttribute('aria-valuenow', '35');
    expect(screen.getByRole('main').style.width).toBe('65%');

    // ArrowLeft at min stays at min
    fireEvent.keyDown(divider, { key: 'ArrowLeft' });
    expect(divider).toHaveAttribute('aria-valuenow', '35');

    // End jumps to max (65)
    fireEvent.keyDown(divider, { key: 'End' });
    expect(divider).toHaveAttribute('aria-valuenow', '65');
    expect(screen.getByRole('main').style.width).toBe('35%');

    // Double click resets to 50
    fireEvent.doubleClick(divider);
    expect(divider).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByRole('main').style.width).toBe('50%');
  });

  it('TC_WW_05: Typing in textarea updates Redux store and does not lose text', () => {
    const { store } = renderWorkspace();

    const textarea = screen.getByPlaceholderText(/Viết bài tự luận của bạn tại đây/i);
    fireEvent.change(textarea, { target: { value: 'In this essay, I will analyze the trend...' } });

    expect(textarea).toHaveValue('In this essay, I will analyze the trend...');
    expect(store.getState().answers.answers?.[11]?.['q-w1']).toBe('In this essay, I will analyze the trend...');
  });
});
