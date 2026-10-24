import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import WorkspacePage from '../pages/WorkspacePage';
import useWorkspace from '../hooks/useWorkspace';
import { useAutosave } from '../hooks/useAutosave';
import { useAttemptSubmission } from '../hooks/useAttemptSubmission';
import { useExamTimer } from '../hooks/useExamTimer';
import { useWritingHints } from '../hooks/useWritingHints';
import type { QuestionWritingHints, WritingHintsController } from '../hooks/useWritingHints';
import type { WorkspaceResponse, WritingHintsFailure } from '../types/api.types';
import answerReducer, { initialState, lockAnswers, setAttemptContext } from '../store/answerSlice';
import { validWritingHintsVi } from './fixtures/writingHints';

vi.mock('../hooks/useWorkspace');
vi.mock('../hooks/useAutosave');
vi.mock('../hooks/useAttemptSubmission');
vi.mock('../hooks/useExamTimer');
vi.mock('../hooks/useWritingHints');
vi.mock('../api/attemptApi');

const idle: QuestionWritingHints = { phase: 'idle', data: null, error: null, lastSelection: null };
let hints: WritingHintsController;
let submission: ReturnType<typeof useAttemptSubmission>;
let workspace: WorkspaceResponse;
let retryWorkspace: () => void;
let events: string[];

function essay(id: string, number: number) {
  return { question_id: id, question_number: number, type: 'ESSAY', question_text: `Essay ${number}` };
}

function setup() {
  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState: { answers: { ...initialState, attemptId: 42, contextRevision: 1, version: 1 } },
  });
  submission.isLocked = vi.fn(() => store.getState().answers.isLocked);
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/42/workspace']}>
        <Routes><Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} /></Routes>
      </MemoryRouter>
    </Provider>,
  );
  return { store, ...view };
}

function open(number = 1) {
  fireEvent.click(screen.getByRole('button', { name: `Gợi ý Writing — Task ${number}` }));
}

beforeEach(() => {
  vi.resetAllMocks();
  events = [];
  workspace = {
    attempt_id: 42, status: 'IN_PROGRESS', test_mode: 'PRACTICE', test_scope: 'FULL_EXAM',
    startTime: new Date().toISOString(), deadline: null, serverTime: new Date().toISOString(),
    gracePeriodSeconds: 15, serverTimeOffset: 0, lockedSections: [], version: 1, saved_answers: [],
    languageContext: { policyVersion: 'TV3_LANG_V1', examLanguage: 'en', defaultExplanationLanguage: 'vi', supportedExplanationLanguages: ['en', 'vi', 'fr'] },
    exam_snapshot: {
      exam_id: 1, code: 'WRITING', title: 'Writing test', type: 'IELTS',
      sections: [{ id: 3, title: 'Writing', skill_type: 'WRITING', parts: [{
        id: 30, title: 'Task part', content: { question_groups: [{
          group_id: 'essays', questions: [essay('writing-task-1', 1), essay('writing-task-2', 2)],
        }] },
      }] }],
    } as WorkspaceResponse['exam_snapshot'],
  };
  retryWorkspace = vi.fn();
  vi.mocked(useWorkspace).mockImplementation(() => ({
    workspace, loading: false, error: null, ready: true, retry: retryWorkspace,
    refreshing: false, refreshError: null, refreshMetadata: vi.fn().mockResolvedValue(true),
  }));
  vi.mocked(useAutosave).mockReturnValue({ pauseAndWait: vi.fn().mockResolvedValue({ status: 'ready' }), resume: vi.fn(), draftWarning: null });
  submission = {
    phase: 'idle', error: null, result: null, draftWarning: null, isLocked: vi.fn(() => false),
    submit: vi.fn(async () => { events.push('submit'); }), retry: vi.fn(async () => { events.push('retry'); }),
  };
  vi.mocked(useAttemptSubmission).mockImplementation(() => submission);
  vi.mocked(useExamTimer).mockReturnValue({ timeLeftMs: 0, remainingSeconds: 0, displayTime: 'Practice', isExpired: false, isPractice: true });
  hints = {
    busy: false, retryAfterSeconds: null, blockedError: null, getHints: vi.fn(() => idle),
    generate: vi.fn().mockResolvedValue(undefined), retry: vi.fn().mockResolvedValue(undefined),
    suspend: vi.fn(() => { events.push('suspend'); }),
  };
  vi.mocked(useWritingHints).mockImplementation(() => hints);
});

describe('TV3-19-05 Workspace Writing hints wiring', () => {
  it('places one panel below each ESSAY editor, outside its fieldset, with no old Writing notice', () => {
    setup();
    const editors = screen.getAllByRole('textbox');
    editors.forEach((editor, index) => {
      const button = screen.getByRole('button', { name: `Gợi ý Writing — Task ${index + 1}` });
      expect(button.closest('fieldset')).toBeNull();
      expect(editor.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.queryByText(/chưa hỗ trợ kiểm tra tức thì/i)).toBeNull();
    expect(hints.generate).not.toHaveBeenCalled();
    open(2);
    fireEvent.click(screen.getByRole('button', { name: 'Tạo gợi ý' }));
    expect(hints.generate).toHaveBeenCalledWith('writing-task-2', { learningLanguage: 'en', hintLanguage: null });
  });

  it('passes actual part and the synchronous submission lock function before early returns', () => {
    vi.mocked(useWorkspace).mockReturnValue({ workspace: null, loading: true, error: null, ready: false, retry: retryWorkspace, refreshing: false, refreshError: null, refreshMetadata: vi.fn() });
    setup();
    expect(useWritingHints).toHaveBeenCalledWith(expect.objectContaining({ workspace: null, partId: null, isLocked: submission.isLocked }));
  });

  it.each(['MOCK_TEST', 'READING', 'LISTENING', 'objective', 'missing-part', 'missing-section', 'duplicate-part', 'missing-question', 'duplicate-question', 'terminal'])(
    'does not expose hints controls for %s', (mode) => {
      const section = workspace.exam_snapshot.sections[0];
      if (mode === 'MOCK_TEST') workspace.test_mode = 'MOCK_TEST';
      else if (mode === 'READING' || mode === 'LISTENING') section.skill_type = mode;
      else if (mode === 'objective') (section.parts[0].content!.question_groups![0].questions as unknown[]) = [{ ...essay('q1', 1), type: 'SINGLE_CHOICE', options: [{ id: 'A', text: 'Answer' }] }];
      else if (mode === 'missing-part') delete (section.parts[0] as Partial<typeof section.parts[0]>).id;
      else if (mode === 'missing-section') delete (section as Partial<typeof section>).id;
      else if (mode === 'duplicate-part') section.parts.push({ ...section.parts[0] });
      else if (mode === 'missing-question') section.parts[0].content!.question_groups![0].questions = [
        { question_number: 1, type: 'ESSAY', question_text: 'No recorded identity' } as never,
      ];
      else if (mode === 'duplicate-question') section.parts[0].content!.question_groups![0].questions = [
        essay('same', 1) as never, essay('same', 2) as never,
      ];
      else workspace.status = 'SUBMITTED';
      setup();
      expect(screen.queryAllByRole('button', { name: /Gợi ý Writing/ })).toHaveLength(0);
      expect(hints.generate).not.toHaveBeenCalled();
      expect(hints.retry).not.toHaveBeenCalled();
    },
  );

  it('retains the existing ESSAY notice outside Writing and objective checks in Writing', () => {
    workspace.exam_snapshot.sections[0].skill_type = 'READING';
    const view = setup();
    expect(screen.getAllByText(/chưa hỗ trợ kiểm tra tức thì/i)).toHaveLength(2);
    workspace.exam_snapshot.sections[0].skill_type = 'WRITING';
    workspace.exam_snapshot.sections[0].parts[0].content!.question_groups![0].questions.push({ ...essay('objective', 3), type: 'SINGLE_CHOICE', options: [{ id: 'A', text: 'Answer' }] } as never);
    workspace = { ...workspace, exam_snapshot: structuredClone(workspace.exam_snapshot) };
    view.rerender(
      <Provider store={view.store}><MemoryRouter initialEntries={['/attempts/42/workspace']}><Routes><Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} /></Routes></MemoryRouter></Provider>,
    );
    expect(screen.getByRole('button', { name: /Kiểm tra đáp án/ })).toBeEnabled();
  });

  it('keeps editing, dirty answers and autosave active while hints load', () => {
    hints.busy = true;
    hints.getHints = vi.fn((): QuestionWritingHints => ({ ...idle, phase: 'loading' }));
    const { store } = setup();
    open();
    const editor = screen.getAllByRole('textbox')[0];
    expect(editor).toBeEnabled();
    fireEvent.change(editor, { target: { value: 'My independent essay' } });
    expect(store.getState().answers.answers[30]['writing-task-1']).toBe('My independent essay');
    expect(store.getState().answers.isDirty).toBe(true);
    expect(store.getState().answers.version).toBe(1);
    expect(vi.mocked(useAutosave).mock.results[0].value.pauseAndWait).not.toHaveBeenCalled();
  });

  it.each(['section', 'submission'])('disables hints with a %s lock in Practice', (lock) => {
    if (lock === 'section') workspace.lockedSections = [3];
    const { store } = setup();
    if (lock === 'submission') act(() => { store.dispatch(lockAnswers({ attemptId: 42, contextRevision: 1 })); });
    open();
    expect(screen.getByRole('button', { name: 'Tạo gợi ý' })).toBeDisabled();
    const options = vi.mocked(useWritingHints).mock.calls.at(-1)![0];
    expect(options.partId).toBe(30);
    expect(options.isLocked()).toBe(lock === 'submission');
    expect(hints.generate).not.toHaveBeenCalled();
  });

  it.each(['quota', 'conflict'])('shows one global %s error and only its appropriate action', (kind) => {
    const failure: WritingHintsFailure = { kind: kind as 'quota' | 'conflict', action: kind === 'quota' ? 'none' : 'reload', retryAt: null, message: 'Safe hints blocked reason' };
    hints.blockedError = failure;
    hints.getHints = vi.fn((): QuestionWritingHints => ({ ...idle, phase: 'error', error: failure, data: validWritingHintsVi }));
    setup();
    open(); open(2);
    expect(screen.getAllByText(failure.message)).toHaveLength(1);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Tạo gợi ý mới' }).every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    if (kind === 'conflict') {
      fireEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: /Tải lại/ }));
      expect(retryWorkspace).toHaveBeenCalledOnce();
    } else expect(screen.queryByRole('button', { name: /Tải lại/ })).toBeNull();
  });

  it('remounts local panel state on authoritative context hydration', () => {
    const { store } = setup();
    open();
    act(() => { store.dispatch(setAttemptContext({ attemptId: 42, version: 2, savedAnswers: [] })); });
    expect(screen.getByRole('button', { name: 'Gợi ý Writing — Task 1' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the global hints block visible when switching to a part without questions', () => {
    workspace.exam_snapshot.sections[0].parts.push({ id: 40, title: 'Empty part', questions: [] });
    hints.blockedError = { kind: 'quota', action: 'none', retryAt: null, message: 'Global quota reason' };
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Empty part/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Global quota reason');
  });

  it('remounts the same question panel on a part switch and passes its new actual part', () => {
    workspace.exam_snapshot.sections[0].parts.push({ ...structuredClone(workspace.exam_snapshot.sections[0].parts[0]), id: 40, title: 'Second part' });
    setup();
    open();
    fireEvent.change(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' }), { target: { value: 'fr' } });
    fireEvent.click(screen.getByRole('button', { name: /Second part/ }));
    expect(screen.getByRole('button', { name: 'Gợi ý Writing — Task 1' })).toHaveAttribute('aria-expanded', 'false');
    expect(vi.mocked(useWritingHints).mock.calls.at(-1)![0].partId).toBe(40);
    open();
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ học' })).toHaveValue('en');
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ giải thích' })).toHaveValue('');
  });

  it('routes a manual panel retry only to its question without changed language payload', () => {
    hints.getHints = vi.fn((): QuestionWritingHints => ({ ...idle, phase: 'error', lastSelection: { learningLanguage: 'en', hintLanguage: 'vi' },
      error: { kind: 'request', action: 'retry', retryAt: null, message: 'Retry manually' } }));
    setup();
    open(2);
    expect(screen.getByRole('combobox', { name: 'Ngôn ngữ học' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(hints.retry).toHaveBeenCalledWith('writing-task-2');
    expect(hints.generate).not.toHaveBeenCalled();
  });

  it('suspends before manual submit and before the SubmitOverlay retry', () => {
    submission.phase = 'error'; submission.error = 'Submit failed';
    setup();
    screen.getAllByRole('textbox').forEach(editor => fireEvent.change(editor, { target: { value: 'Completed essay' } }));
    fireEvent.click(screen.getByRole('button', { name: /Nộp bài$/ }));
    fireEvent.click(screen.getByRole('button', { name: /Nộp bài ngay/ }));
    expect(events).toEqual(['suspend', 'submit']);
    expect(submission.submit).toHaveBeenCalledWith('MANUAL');
    events.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /Thử nộp lại/ }));
    expect(events).toEqual(['suspend', 'retry']);
  });

  it('suspends before timeout submit and before the TimeUpModal retry', () => {
    workspace.deadline = new Date(Date.now() - 1000).toISOString();
    submission.phase = 'error'; submission.error = 'Submit failed';
    vi.mocked(useExamTimer).mockReturnValue({ timeLeftMs: 0, remainingSeconds: 0, displayTime: '00:00', isExpired: true, isPractice: false });
    setup();
    expect(events).toEqual(['suspend', 'submit']);
    expect(submission.submit).toHaveBeenCalledWith('TIMEOUT_CLIENT');
    events.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại ngay' }));
    expect(events).toEqual(['suspend', 'retry']);
  });

  it('renders WritingHintsPanel when section has name="WRITING" without skill_type (real DB snapshot compatibility)', () => {
    delete (workspace.exam_snapshot.sections[0] as any).skill_type;
    (workspace.exam_snapshot.sections[0] as any).name = 'WRITING';
    setup();
    expect(screen.getByRole('button', { name: 'Gợi ý Writing — Task 1' })).toBeInTheDocument();
  });
});
