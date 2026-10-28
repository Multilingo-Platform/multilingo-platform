import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import answerReducer, { initialState } from '../store/answerSlice';
import WorkspacePage, { shouldShowAiLookup } from '../pages/WorkspacePage';
import HtmlContent from '../components/content/HtmlContent';
import ReferencePane from '../components/workspace/ReferencePane';
import { readReferenceDocs } from '../components/workspace/ReadingPartContent';
import { buildHighlightNamespace } from '../utils/highlightUtils';
import { resolveHighlightScope, resolveHighlightScopeElement } from '../hooks/useTextSelection';
import * as workspaceHookModule from '../hooks/useWorkspace';
import { useAutosave } from '../hooks/useAutosave';
import type { SelectionState } from '../hooks/useTextSelection';
import type { WorkspaceResponse } from '../types/api.types';

vi.mock('../hooks/useWorkspace');
vi.mock('../api/attemptApi');
vi.mock('../hooks/useAutosave', () => ({ useAutosave: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  delete (window as unknown as Record<string, unknown>).__xss;
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
  vi.mocked(useAutosave).mockReturnValue({
    pauseAndWait: vi.fn().mockResolvedValue({ status: 'ready' }),
    resume: vi.fn(),
    draftWarning: null,
  } as never);
});

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).__xss;
});

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const LETTERS = ['A', 'B', 'C', 'D'];

function question(id: string, text: string, optionText?: string[]) {
  return {
    question_id: id,
    type: 'SINGLE_CHOICE',
    question_text: text,
    options: (optionText ?? ['alpha', 'beta', 'gamma', 'delta']).map((t, i) => ({ id: LETTERS[i], text: t })),
    media: null,
  };
}

const PART_5 = {
  id: 105,
  part_number: 5,
  title: 'Part 5',
  instruction: 'Chọn đáp án đúng nhất để hoàn thành câu.',
  questionGroups: [
    {
      group_id: 'p5-g1',
      instruction: null,
      questions: [
        question('q_101', 'The report ___ ready by Friday.'),
        question('q_102', 'She ___ to the office every day.'),
      ],
    },
  ],
};

const PART_6 = {
  id: 106,
  part_number: 6,
  title: 'Part 6',
  instruction: 'Đọc đoạn văn và chọn từ phù hợp cho mỗi chỗ trống.',
  questionGroups: [
    {
      group_id: 'p6-g1',
      instruction: 'Questions 131-132 refer to the following letter.',
      content_html: '<p>Dear Mr. Lee,</p><p>Thank you for [131] the meeting on [132].</p>',
      questions: [
        question('q_131', 'Chọn từ đúng cho chỗ trống 1.'),
        question('q_132', 'Chọn từ đúng cho chỗ trống 2.'),
      ],
    },
    {
      group_id: 'p6-g2',
      instruction: null,
      content_html: '<p>Best regards,</p><p>[134]</p>',
      questions: [question('q_134', 'Chọn từ đúng cho chỗ trống 3.')],
    },
  ],
};

const PART_7 = {
  id: 107,
  part_number: 7,
  title: 'Part 7',
  instruction: 'Đọc các tài liệu và trả lời câu hỏi.',
  questionGroups: [
    {
      group_id: 'p7-g1',
      instruction: 'Questions 176-180 refer to the following documents.',
      content_html:
        '<h3>Email</h3><p>Please review the proposal.</p>' +
        '<hr/><h3>Schedule</h3><p>The meeting starts at 9 a.m.</p>' +
        '<hr/><h3>Memo</h3><p>All staff must attend.</p>',
      questions: [
        question('q_176', 'What is the purpose of the email?'),
        question('q_177', 'When does the meeting start?'),
        question('q_178', 'Who must attend?'),
        question('q_179', 'What is included with the memo?'),
        question('q_180', 'What is suggested about the proposal?'),
      ],
    },
  ],
};

function toeicReadingSnapshot(part: unknown, code = 'TOEIC-LR-TEST') {
  return {
    exam_id: 1,
    code,
    title: 'TOEIC Reading',
    type: 'TOEIC',
    sections: [
      { id: 9001, skill_type: 'READING', title: 'Reading', duration_minutes: 75, parts: [part] },
    ],
  };
}

function ieltsReadingSnapshot() {
  return {
    exam_id: 2,
    code: 'IELTS-AC',
    title: 'IELTS Academic',
    type: 'IELTS',
    sections: [
      {
        id: 1,
        skill_type: 'READING',
        title: 'Reading',
        duration_minutes: 60,
        parts: [
          {
            id: 1,
            title: 'Reading Passage 1',
            instruction: 'Read the passage.',
            content_html: '<p>The passage body.</p>',
            questionGroups: [
              {
                group_id: 'g1',
                questions: [question('q1', 'Prompt', ['Option A', 'Option B'])],
              },
            ],
          },
        ],
      },
    ],
  };
}

function workspaceResponse(snapshot: unknown, testMode: 'MOCK_TEST' | 'PRACTICE' = 'MOCK_TEST'): WorkspaceResponse {
  return {
    attempt_id: 99,
    status: 'IN_PROGRESS',
    test_scope: 'SINGLE_PART',
    test_mode: testMode,
    startTime: '2026-10-18T00:00:00Z',
    deadline: null,
    serverTime: '2026-10-18T00:00:00Z',
    gracePeriodSeconds: 15,
    lockedSections: [],
    exam_snapshot: snapshot as WorkspaceResponse['exam_snapshot'],
    version: 1,
    saved_answers: [],
    serverTimeOffset: 0,
  } as unknown as WorkspaceResponse;
}

function renderWorkspacePage(workspace: WorkspaceResponse) {
  const store = configureStore({
    reducer: { answers: answerReducer, auth: () => ({ user: { id: 21 } }) },
    preloadedState: { answers: { ...initialState, attemptId: 99, version: 1 } },
  });
  vi.mocked(workspaceHookModule.default).mockReturnValue({
    workspace,
    loading: false,
    error: null,
    ready: true,
    retry: vi.fn(),
    refreshing: false,
    refreshError: null,
    refreshMetadata: vi.fn().mockResolvedValue(true),
  } as never);

  const result = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/99/workspace']}>
        <Routes>
          <Route path="/attempts/:attemptId/workspace" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>,
  );
  return { ...result, store };
}

/* ------------------------------------------------------------------ */
/* Step 4 - highlight namespace, selection scope, sanitizer helpers    */
/* ------------------------------------------------------------------ */

describe('TW-08 reading helpers', () => {
  it('TC_TW_RD_00a: highlight namespace separates attempt, part, group and content hash', () => {
    const base = { attemptId: 99, partId: 106, groupId: 'g1', contentHash: 'h1' };
    const key = buildHighlightNamespace(base);

    expect(buildHighlightNamespace({ ...base })).toBe(key);
    expect(buildHighlightNamespace({ ...base, attemptId: 100 })).not.toBe(key);
    expect(buildHighlightNamespace({ ...base, partId: 107 })).not.toBe(key);
    expect(buildHighlightNamespace({ ...base, groupId: 'g2' })).not.toBe(key);
    expect(buildHighlightNamespace({ ...base, contentHash: 'h2' })).not.toBe(key);
    expect(buildHighlightNamespace({ ...base, groupId: null })).toBe(
      buildHighlightNamespace({ ...base, groupId: undefined }),
    );
  });

  it('TC_TW_RD_00b: selection scope resolves to the nearest data-highlight-scope element', () => {
    const host = document.createElement('div');
    host.innerHTML = '<section data-highlight-scope="g1"><p>Hello world</p></section><p>Unscoped</p>';
    document.body.appendChild(host);
    const scopedText = host.querySelector('p')!.firstChild!;

    const range = document.createRange();
    range.setStart(scopedText, 0);
    range.setEnd(scopedText, 5);

    expect(resolveHighlightScope(range, host)).toBe('g1');
    expect(resolveHighlightScopeElement(range, host)?.getAttribute('data-highlight-scope')).toBe('g1');
    // A container that does not hold the range must not claim the scope.
    expect(resolveHighlightScope(range, document.createElement('div'))).toBeNull();

    const outer = document.createRange();
    outer.setStart(host, 0);
    outer.setEnd(host, 2);
    expect(resolveHighlightScope(outer, host)).toBeNull();

    document.body.removeChild(host);
  });

  it('TC_TW_RD_00c: HtmlContent stripMedia removes embedded media but keeps text and images', () => {
    const { container } = render(
      <HtmlContent
        stripMedia
        html={
          '<p>safe</p><audio controls src="/a.mp3"></audio><video src="/v.mp4"></video>' +
          '<iframe src="/evil"></iframe><img src="/ok.png" alt="ok" />'
        }
      />,
    );

    expect(container.querySelector('audio')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img[src="/ok.png"]')).not.toBeNull();
    expect(container.textContent).toContain('safe');
  });

  it('TC_TW_RD_00d: default HtmlContent still allows the existing embedded-media handling', () => {
    const { container } = render(<HtmlContent html='<audio controls src="/a.mp3"></audio>' />);
    expect(container.querySelector('audio')).not.toBeNull();
  });

  it('TC_TW_RD_00e: readReferenceDocs keeps a whole-group document and never splits on <hr>', () => {
    const docs = readReferenceDocs({}, [
      {
        group_id: 'g1',
        instruction: 'Read the documents.',
        content_html: '<p>Email</p><hr/><p>Schedule</p><hr/><p>Memo</p>',
        shared_media: { url: 'https://cdn.example.test/g1.png' },
      },
      { group_id: 'g2' },
    ]);

    expect(docs).toHaveLength(1);
    expect(docs[0].groupId).toBe('g1');
    expect(docs[0].instruction).toBe('Read the documents.');
    expect(docs[0].mediaUrls).toEqual(['https://cdn.example.test/g1.png']);
    expect(docs[0].html).toContain('<hr/>');
  });

  it('TC_TW_RD_00f: readReferenceDocs prefers a whole-part HTML document', () => {
    const docs = readReferenceDocs(
      { content_html: '<p>Whole part reference</p>', instruction: 'Part instruction' },
      [{ group_id: 'g1', content_html: '<p>group html</p>' }],
    );

    expect(docs).toHaveLength(1);
    expect(docs[0].groupId).toBe('part');
    expect(docs[0].html).toContain('Whole part reference');
  });

  it('TC_TW_RD_00g: ReferencePane sanitizes documents and marks each one with its highlight scope', () => {
    const { container } = render(
      <ReferencePane
        docs={[
          {
            groupId: 'g1',
            instruction: null,
            html: '<p>Doc one</p><script>window.__xss=1</script><audio src="/a.mp3"></audio>',
            mediaUrls: [],
          },
          { groupId: 'g2', instruction: null, html: '<p>Doc two</p>', mediaUrls: [] },
        ]}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('audio')).toBeNull();
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
    expect(container.querySelector('[data-highlight-scope="g1"]')).not.toBeNull();
    expect(container.querySelector('[data-highlight-scope="g2"]')).not.toBeNull();
  });

  it('TC_TW_RD_00h: AI lookup is only offered inside Practice', () => {
    const selection: SelectionState = {
      rect: { width: 10, height: 10 } as DOMRect, text: 'vocabulary', start: 0, end: 10,
      documentId: 'g1', contentHash: 'h1', contextRevision: 0, contextKey: 'attempt-1:part-1',
    };

    expect(shouldShowAiLookup(selection, true)).toBe(true);
    expect(shouldShowAiLookup(selection, true, 'vi')).toBe(true);
    expect(shouldShowAiLookup(selection, true, null)).toBe(false);
    expect(shouldShowAiLookup(selection, true, 'en-US')).toBe(true);
    expect(shouldShowAiLookup({ ...selection, text: '水' }, true, 'ja')).toBe(true);
    expect(shouldShowAiLookup({ ...selection, text: 'a' }, true, 'en')).toBe(true);
    expect(shouldShowAiLookup(selection, false)).toBe(false);
    expect(shouldShowAiLookup(null, true)).toBe(false);
    expect(shouldShowAiLookup({ ...selection, text: 'x'.repeat(81) }, true)).toBe(false);
    expect(shouldShowAiLookup({ ...selection, text: "l’arbre" }, true)).toBe(true);
  });

  it('TC_TW_RD_00i: readReferenceDocs retains part-level media without part HTML while gathering all group HTML documents', () => {
    const docs = readReferenceDocs(
      {
        instruction: 'Part diagram instruction',
        shared_media: [{ url: 'https://cdn.example.test/part-diagram.png' }],
      },
      [
        {
          group_id: 'g1',
          instruction: 'Group 1 instruction',
          content_html: '<p>Group 1 reading passage</p>',
        },
        {
          group_id: 'g2',
          instruction: null,
          content_html: '<p>Group 2 reading passage</p>',
        },
      ],
    );

    expect(docs).toHaveLength(3);
    expect(docs[0].groupId).toBe('part');
    expect(docs[0].html).toBeNull();
    expect(docs[0].mediaUrls).toEqual(['https://cdn.example.test/part-diagram.png']);
    expect(docs[0].instruction).toBe('Part diagram instruction');

    expect(docs[1].groupId).toBe('g1');
    expect(docs[1].html).toContain('Group 1 reading passage');
    expect(docs[1].instruction).toBe('Group 1 instruction');

    expect(docs[2].groupId).toBe('g2');
    expect(docs[2].html).toContain('Group 2 reading passage');
  });

  it('TC_TW_RD_00j: selection scope rejects cross-group and unscoped instruction ranges', () => {
    const host = document.createElement('div');
    host.innerHTML =
      '<div class="instruction"><p>Part instruction text</p></div>' +
      '<section data-highlight-scope="g1"><p>Group 1 text</p></section>' +
      '<section data-highlight-scope="g2"><p>Group 2 text</p></section>';
    document.body.appendChild(host);

    const instrText = host.querySelector('.instruction p')!.firstChild!;
    const g1Text = host.querySelector('[data-highlight-scope="g1"] p')!.firstChild!;
    const g2Text = host.querySelector('[data-highlight-scope="g2"] p')!.firstChild!;

    // 1. Cross-group range (start in g1, end in g2) must be rejected
    const crossRange = document.createRange();
    crossRange.setStart(g1Text, 0);
    crossRange.setEnd(g2Text, 4);
    expect(resolveHighlightScopeElement(crossRange, host)).toBeNull();
    expect(resolveHighlightScope(crossRange, host)).toBeNull();

    // 2. Unscoped instruction range must be rejected
    const instrRange = document.createRange();
    instrRange.setStart(instrText, 0);
    instrRange.setEnd(instrText, 4);
    expect(resolveHighlightScopeElement(instrRange, host)).toBeNull();
    expect(resolveHighlightScope(instrRange, host)).toBeNull();

    // 3. Valid in-group range must resolve to its enclosing group scope
    const validRange = document.createRange();
    validRange.setStart(g1Text, 0);
    validRange.setEnd(g1Text, 5);
    expect(resolveHighlightScopeElement(validRange, host)?.getAttribute('data-highlight-scope')).toBe('g1');
    expect(resolveHighlightScope(validRange, host)).toBe('g1');

    document.body.removeChild(host);
  });
});

/* ------------------------------------------------------------------ */
/* Steps 1-3, 5-10 - layout, panes, resize, blanks, sanitizer          */
/* ------------------------------------------------------------------ */

describe('WorkspacePage TOEIC reading branch', () => {
  it('TC_TW_RD_01: Part 5 renders one centered column with no reference pane, divider or audio', async () => {
    const { container } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_5)));

    const column = await screen.findByTestId('toeic-reading-single-column');
    expect(column.className).toContain('max-w-[840px]');
    expect(column.className).toContain('mx-auto');

    expect(screen.queryByTestId('toeic-reference-pane')).toBeNull();
    expect(screen.queryByTestId('toeic-reading-divider')).toBeNull();
    expect(screen.getByRole('main').style.width).toBe('');

    expect(container.querySelectorAll('audio')).toHaveLength(0);
    expect(container.querySelectorAll('[data-question-id]')).toHaveLength(2);
    // Canonical whole-exam numbers, never the array index.
    expect(container.textContent).toContain('101');
    expect(container.textContent).toContain('102');
    // The Part instruction stays visible above the independent questions.
    expect(container.textContent).toContain('Chọn đáp án đúng nhất để hoàn thành câu.');
  });

  it('TC_TW_RD_02: Part 6 splits the reference text and its questions across two panes', async () => {
    renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_6)));

    const reference = await screen.findByTestId('toeic-reference-pane');
    expect(screen.getByTestId('toeic-reference-group-p6-g1')).toBeDefined();
    expect(screen.getByTestId('toeic-reference-group-p6-g2')).toBeDefined();
    expect(screen.getByTestId('toeic-reading-divider')).toBeDefined();
    expect(screen.getByRole('main').style.width).toBe('50%');

    // Questions live in the right pane only, never duplicated inside the reference pane.
    expect(reference.querySelectorAll('[data-question-id]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-question-id]')).toHaveLength(3);
  });

  it('TC_TW_RD_03: Part 7 keeps the whole-group HTML as one document and lists its questions', async () => {
    const { container } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7)));

    const reference = await screen.findByTestId('toeic-reference-pane');
    // RD-05 annotates the instruction separately; the whole passage still has one scope.
    expect(reference.querySelectorAll('[data-source-kind="GROUP_CONTENT"]')).toHaveLength(1);
    expect(reference.querySelector('[data-highlight-scope="p7-g1"]')).not.toBeNull();
    expect(screen.getByTestId('toeic-reference-group-p7-g1')).toBeDefined();

    // The three source documents stay inside the single group HTML.
    expect(reference.textContent).toContain('Email');
    expect(reference.textContent).toContain('Schedule');
    expect(reference.textContent).toContain('Memo');
    // No invented passage tabs or sub-passage splitting.
    expect(screen.queryByRole('tab')).toBeNull();

    expect(container.querySelectorAll('[data-question-id]')).toHaveLength(5);
  });

  it('TC_TW_RD_04: the reference pane and the question pane scroll independently', async () => {
    renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7)));
    await screen.findByTestId('toeic-reference-pane');

    const referenceScroll = screen.getByTestId('toeic-reference-pane').closest('.overflow-y-auto');
    const questionScroll = screen.getByRole('main').querySelector('.overflow-y-auto');

    expect(referenceScroll).not.toBeNull();
    expect(questionScroll).not.toBeNull();
    expect(referenceScroll).not.toBe(questionScroll);
  });

  it('TC_TW_RD_05: Part 6 blanks stay static without invented inputs or anchors', async () => {
    const { container } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_6)));
    const reference = await screen.findByTestId('toeic-reference-pane');

    expect(reference.textContent).toContain('[131]');
    expect(reference.textContent).toContain('[134]');
    expect(reference.querySelectorAll('input, textarea, button, a, [contenteditable="true"]')).toHaveLength(0);
    expect(screen.queryByRole('textbox')).toBeNull();
    // Only the answer radios of the question pane exist; no invented blank input anywhere.
    expect(container.querySelectorAll('input:not([type="radio"]), textarea')).toHaveLength(0);
  });

  it('TC_TW_RD_06: reference HTML is sanitized and embedded media is suppressed', async () => {
    const part = {
      id: 108,
      part_number: 7,
      title: 'Part 7',
      instruction: 'Read.',
      questionGroups: [
        {
          group_id: 'p7-xss',
          content_html:
            '<p>legit text</p><script>window.__xss=1</script>' +
            '<img src="/legit.png" alt="ok" /><img src="x" onerror="window.__xss=2" />' +
            '<audio controls src="/a.mp3"></audio><video src="/v.mp4"></video><iframe src="/evil"></iframe>',
          questions: [question('q_176', 'What is the purpose?')],
        },
      ],
    };

    const { container } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(part)));
    const reference = await screen.findByTestId('toeic-reference-pane');

    expect(reference.textContent).toContain('legit text');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('audio')).toBeNull();
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('img[src="/legit.png"]')).not.toBeNull();
    expect((window as unknown as Record<string, unknown>).__xss).toBeUndefined();
  });

  it('TC_TW_RD_07: the divider exposes separator semantics and clamps 30-70 with buttons and reset', async () => {
    renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7)));

    const separator = await screen.findByTestId('toeic-reading-divider');
    expect(separator.getAttribute('role')).toBe('separator');
    expect(separator.getAttribute('aria-orientation')).toBe('vertical');
    expect(separator.getAttribute('aria-valuenow')).toBe('50');
    expect(separator.getAttribute('aria-valuemin')).toBe('30');
    expect(separator.getAttribute('aria-valuemax')).toBe('70');
    expect(separator.getAttribute('tabindex')).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    expect(screen.getByRole('main').style.width).toBe('55%');

    for (let i = 0; i < 10; i += 1) {
      fireEvent.click(screen.getByRole('button', { name: /mở rộng khung đọc/i }));
    }
    expect(separator.getAttribute('aria-valuenow')).toBe('70');
    expect(screen.getByRole('main').style.width).toBe('30%');

    fireEvent.click(screen.getByRole('button', { name: /đặt lại tỉ lệ 50\/50/i }));
    expect(screen.getByRole('main').style.width).toBe('50%');

    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    fireEvent.click(screen.getByRole('button', { name: /thu hẹp khung đọc/i }));
    expect(separator.getAttribute('aria-valuenow')).toBe('30');
    expect(screen.getByRole('main').style.width).toBe('70%');
  });

  it('TC_TW_RD_08: keyboard arrows resize within 30-70 and the separator is focusable', async () => {
    renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7)));

    const separator = await screen.findByTestId('toeic-reading-divider');
    separator.focus();
    expect(document.activeElement).toBe(separator);

    fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(separator.getAttribute('aria-valuenow')).toBe('45');
    expect(screen.getByRole('main').style.width).toBe('55%');

    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator.getAttribute('aria-valuenow')).toBe('50');

    for (let i = 0; i < 10; i += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowRight' });
    }
    expect(separator.getAttribute('aria-valuenow')).toBe('70');

    for (let i = 0; i < 20; i += 1) {
      fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    }
    expect(separator.getAttribute('aria-valuenow')).toBe('30');
  });

  it('TC_TW_RD_09: mouse dragging clamps the split ratio to 30-70', async () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 800, width: 1000, height: 800,
      toJSON: () => ({}),
    } as DOMRect);

    try {
      renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7)));
      const separator = await screen.findByTestId('toeic-reading-divider');

      fireEvent.mouseDown(separator);
      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 }));
      });
      expect(screen.getByRole('main').style.width).toBe('30%');

      act(() => {
        window.dispatchEvent(new MouseEvent('mousemove', { clientX: 100 }));
      });
      expect(screen.getByRole('main').style.width).toBe('70%');

      act(() => {
        window.dispatchEvent(new MouseEvent('mouseup'));
      });
    } finally {
      rectSpy.mockRestore();
    }
  });

  it('TC_TW_RD_10: Practice keeps highlight/selection while Mock hides the AI lookup affordance', async () => {
    const practice = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7), 'PRACTICE'));
    await screen.findByTestId('toeic-reference-pane');
    expect(document.body.textContent).toMatch(/tra AI/i);
    expect(document.querySelector('[data-highlight-scope="p7-g1"]')).not.toBeNull();
    practice.unmount();

    renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_7), 'MOCK_TEST'));
    await screen.findByTestId('toeic-reference-pane');
    expect(document.body.textContent).not.toMatch(/tra từ ai|tra từ điển ai/i);
    expect(document.querySelector('[data-highlight-scope="p7-g1"]')).not.toBeNull();
  });

  it('TC_TW_RD_11: the generic (non-TOEIC) reading layout is unchanged', async () => {
    const { container } = renderWorkspacePage(workspaceResponse(ieltsReadingSnapshot()));

    expect(await screen.findByTestId('pane-divider')).toBeDefined();
    expect(screen.getByRole('main').style.width).toBe('50%');
    expect(screen.getByTestId('question-group-g1')).toBeDefined();
    expect(screen.queryByTestId('toeic-reading-single-column')).toBeNull();
    expect(screen.queryByTestId('toeic-reference-pane')).toBeNull();
    expect(screen.queryByTestId('toeic-reading-divider')).toBeNull();

    // The generic flag label is intentionally untouched by the TOEIC workspace.
    expect(screen.getByTestId('flag-btn-q1').textContent).toMatch(/Xem lại/);
    expect(container.textContent).toContain('The passage body.');
  });

  it('TC_TW_RD_12: Part-level media and multiple group HTML passages both render in reference pane', async () => {
    const partWithMediaAndGroups = {
      id: 109,
      part_number: 7,
      title: 'Part 7',
      instruction: 'Đọc tài liệu và sơ đồ.',
      shared_media: [{ url: 'https://cdn.example.test/part-diagram.png' }],
      questionGroups: [
        {
          group_id: 'p7-multi-g1',
          instruction: 'Group 1 details',
          content_html: '<p>Passage for Group 1</p>',
          questions: [question('q_181', 'Question 181 prompt')],
        },
        {
          group_id: 'p7-multi-g2',
          instruction: 'Group 2 details',
          content_html: '<p>Passage for Group 2</p>',
          questions: [question('q_182', 'Question 182 prompt')],
        },
      ],
    };

    const { container } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(partWithMediaAndGroups)));
    const reference = await screen.findByTestId('toeic-reference-pane');

    // Part-level media image must be rendered
    expect(reference.querySelector('img[src="https://cdn.example.test/part-diagram.png"]')).not.toBeNull();

    // Both group passages must be rendered with their respective highlight scopes
    expect(reference.textContent).toContain('Passage for Group 1');
    expect(reference.textContent).toContain('Passage for Group 2');
    expect(reference.querySelector('[data-highlight-scope="p7-multi-g1"]')).not.toBeNull();
    expect(reference.querySelector('[data-highlight-scope="p7-multi-g2"]')).not.toBeNull();

    // Both questions must be present in the question column
    expect(container.querySelectorAll('[data-question-id]')).toHaveLength(2);
  });

  it('TC_TW_RD_13: TOEIC reading rejects highlights that cross group boundaries or fall outside highlight scopes', async () => {
    const origBcr = Range.prototype.getBoundingClientRect;
    Range.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
      top: 100, bottom: 120, left: 100, right: 200, width: 100, height: 20,
    } as DOMRect);

    const sel = window.getSelection()!;
    const origToString = sel.toString;
    sel.toString = () => 'Dear Mr. Lee';

    try {
      const { container, store } = renderWorkspacePage(workspaceResponse(toeicReadingSnapshot(PART_6)));
      await screen.findByTestId('toeic-reference-pane');

      const g1TextNode = container.querySelector('[data-highlight-scope="p6-g1"] p')!.firstChild!;
      const g2TextNode = container.querySelector('[data-highlight-scope="p6-g2"] p')!.firstChild!;

      // 1. Cross-group selection: start in p6-g1, end in p6-g2
      const crossRange = document.createRange();
      crossRange.setStart(g1TextNode, 0);
      crossRange.setEnd(g2TextNode, 4);

      sel.removeAllRanges();
      sel.addRange(crossRange);
      Object.defineProperty(sel, 'isCollapsed', { value: false, configurable: true });

      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });

      await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); });
      expect(screen.queryByRole('button', { name: 'Highlight' })).toBeNull();

      // Highlights must remain empty because cross-group highlight was rejected
      expect(Object.keys(store.getState().answers.highlights)).toHaveLength(0);

      // 2. Valid within-group selection: strictly within p6-g1
      const freshG1Node = container.querySelector('[data-highlight-scope="p6-g1"] p')!.firstChild!;
      const validRange = document.createRange();
      validRange.setStart(freshG1Node, 0);
      validRange.setEnd(freshG1Node, 4);

      sel.removeAllRanges();
      sel.addRange(validRange);
      Object.defineProperty(sel, 'isCollapsed', { value: false, configurable: true });

      act(() => {
        document.dispatchEvent(new Event('selectionchange'));
      });

      await act(async () => { await new Promise(resolve => setTimeout(resolve, 120)); });
      expect(screen.getByRole('button', { name: 'Highlight' })).toBeDefined();

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Highlight' }));
      });

      // Highlights must now contain the group-scoped highlight
      const highlights = store.getState().answers.highlights;
      const keys = Object.keys(highlights);
      expect(keys.length).toBeGreaterThan(0);
      expect(keys[0]).toContain('p6-g1');
      expect(keys[0]).not.toContain('passage-106');
    } finally {
      sel.toString = origToString;
      if (origBcr) {
        Range.prototype.getBoundingClientRect = origBcr;
      } else {
        delete (Range.prototype as any).getBoundingClientRect;
      }
    }
  });
});
