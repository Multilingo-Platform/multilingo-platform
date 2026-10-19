import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axiosClient from '../../../core/api/axiosClient';
import { createTestStore } from '../../../test-utils/renderWithStore';
import { useWritingHints, type UseWritingHintsOptions, type WritingHintsLanguageSelection } from '../hooks/useWritingHints';
import { initialState, setAnswer, setAttemptContext, lockAnswers, unlockAnswers } from '../store/answerSlice';
import type { WorkspaceResponse, WritingHintsRequest } from '../types/api.types';
import type { Question } from '../types/exam.types';
import { createWritingHintsEnvelope, validWritingHintsEn } from './fixtures/writingHints';

// Keep the controller, API, normalizer, classifier and Redux reducer real.
vi.mock('../../../core/api/axiosClient', () => ({ default: { post: vi.fn() } }));
const http = vi.mocked(axiosClient.post);
const defaults: WritingHintsLanguageSelection = { learningLanguage: null, hintLanguage: null };
const essay: Question = {
  question_id: 'writing-task-1', question_number: 1, type: 'ESSAY',
  question_text: 'Write about public transport.', options: null, media: null,
};
const essays = [essay, { ...essay, question_id: 'writing-task-2', question_number: 2 }];

function workspace(attemptId = 42): WorkspaceResponse {
  return {
    attempt_id: attemptId, status: 'IN_PROGRESS', test_scope: 'FULL_EXAM', test_mode: 'PRACTICE',
    startTime: '2026-10-13T07:00:00Z', serverTime: '2026-10-13T07:00:00Z', deadline: null,
    gracePeriodSeconds: 15, lockedSections: [], version: 7, saved_answers: [], serverTimeOffset: 0,
    exam_snapshot: {
      exam_id: 1, code: 'TEST', title: 'Test', type: 'IELTS', sections: [{
        id: 3, skill_type: 'WRITING', title: 'Writing', duration_minutes: 60,
        parts: [{ id: 30, questions: essays }, { id: 31, questions: [essay] }],
      }],
    },
  };
}

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function responseFor(body: WritingHintsRequest, attemptId = 42) {
  const learningLanguage = body.learningLanguage ?? 'en';
  return createWritingHintsEnvelope({
    ...structuredClone(validWritingHintsEn), ...body, attemptId,
    learningLanguage, hintLanguage: body.hintLanguage ?? learningLanguage,
  });
}

function requestBody(index = 0): WritingHintsRequest {
  expect(http.mock.calls[index], 'expected an explicit hints HTTP request').toBeDefined();
  return http.mock.calls[index][1] as WritingHintsRequest;
}

function setup(overrides: Partial<UseWritingHintsOptions> = {}, strict = false) {
  const props: UseWritingHintsOptions = {
    workspace: workspace(), partId: 30, questions: essays, isLocked: () => false, ...overrides,
  };
  const store = createTestStore({ answers: { ...initialState, attemptId: 42, contextRevision: 1, version: 7 } });
  const hook = renderHook((options: UseWritingHintsOptions) => useWritingHints(options), {
    initialProps: props,
    wrapper: ({ children }) => <Provider store={store}>
      {strict ? <React.StrictMode>{children}</React.StrictMode> : children}
    </Provider>,
  });
  return { ...hook, store, props };
}

async function generate(hook: ReturnType<typeof setup>, questionId = essay.question_id, selection: WritingHintsLanguageSelection = defaults) {
  await act(async () => { await hook.result.current.generate(questionId, selection); });
}

describe('TV3-19-03 scoped Writing hints controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    http.mockImplementation(async (_path, body) => responseFor(body as WritingHintsRequest) as never);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('mount and StrictMode never POST; explicit generation publishes normalized hints', async () => {
    const hook = setup({}, true);
    expect(http).not.toHaveBeenCalled();
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('idle');
    await generate(hook);
    expect(hook.result.current.getHints(essay.question_id)).toMatchObject({
      phase: 'ready', data: { attemptId: 42, partId: 30, learningLanguage: 'en', hintLanguage: 'en' },
      error: null, lastSelection: defaults,
    });
    expect(hook.result.current.busy).toBe(false);
  });

  it.each(['MOCK_TEST', 'SUBMITTED', 'EXPIRED', 'READING', 'LISTENING', 'locked-section', 'missing-section',
    'missing-part', 'duplicate-part', 'duplicate-section', 'objective-snapshot', 'objective-selection',
    'missing-snapshot-question', 'duplicate-snapshot-question', 'duplicate-selected-question',
    'missing-selected-question', 'null-workspace', 'null-part', 'zero-part', 'fraction-part', 'overflow-part',
    'invalid-attempt', 'store-attempt-mismatch', 'submission-lock', 'store-lock'])('%s fails closed before UUID or HTTP', async scenario => {
    const ws = workspace();
    const props: Partial<UseWritingHintsOptions> = { workspace: ws };
    const section = ws.exam_snapshot.sections[0];
    if (scenario === 'MOCK_TEST') ws.test_mode = 'MOCK_TEST';
    if (scenario === 'SUBMITTED' || scenario === 'EXPIRED') ws.status = scenario;
    if (scenario === 'READING' || scenario === 'LISTENING') section.skill_type = scenario;
    if (scenario === 'locked-section') ws.lockedSections = [3];
    if (scenario === 'missing-section') section.id = 0;
    if (scenario === 'missing-part') section.parts = [];
    if (scenario === 'duplicate-part') section.parts.push({ id: 30, questions: [essay] });
    if (scenario === 'duplicate-section') ws.exam_snapshot.sections.push({ ...section, parts: [] });
    if (scenario === 'objective-snapshot') section.parts[0].questions = [{ ...essay, type: 'SINGLE_CHOICE' }];
    if (scenario === 'objective-selection') props.questions = [{ ...essay, type: 'SINGLE_CHOICE' }];
    if (scenario === 'missing-snapshot-question') section.parts[0].questions = [];
    if (scenario === 'duplicate-snapshot-question') section.parts[0].questions = [essay, essay];
    if (scenario === 'duplicate-selected-question') props.questions = [essay, essay];
    if (scenario === 'missing-selected-question') props.questions = [];
    if (scenario === 'null-workspace') props.workspace = null;
    if (scenario === 'null-part') props.partId = null;
    if (scenario === 'zero-part') props.partId = 0;
    if (scenario === 'fraction-part') props.partId = 30.5;
    if (scenario === 'overflow-part') props.partId = 2147483648;
    if (scenario === 'invalid-attempt') ws.attempt_id = 2147483648;
    if (scenario === 'submission-lock') props.isLocked = () => true;
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID');
    const hook = setup(props);
    if (scenario === 'store-attempt-mismatch') act(() => { hook.store.dispatch(setAttemptContext({ attemptId: 43, version: 1, savedAnswers: [] })); });
    if (scenario === 'store-lock') act(() => { hook.store.dispatch(lockAnswers({ attemptId: 42, contextRevision: 1 })); });
    await generate(hook);
    expect(http).not.toHaveBeenCalled();
    expect(uuid).not.toHaveBeenCalled();
    expect(hook.result.current.busy).toBe(false);
  });

  it('accepts grouped snapshot identity and rejects duplicate IDs within canonical groups', async () => {
    const ws = workspace();
    ws.exam_snapshot.sections[0].parts[0].content = {
      part_title: 'Task 1', instruction: '', content_html: null, shared_audio: null, shared_media: null,
      question_groups: [{ group_id: 'g1', instruction: null, context_html: null, shared_audio: null, shared_media: null, questions: [essay] }],
    };
    const hook = setup({ workspace: ws });
    await generate(hook);
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
    ws.exam_snapshot.sections[0].parts[0].content.question_groups[0].questions.push(essay);
    await generate(hook);
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('sets a synchronous mutex before UUID: double click and two essays share one flight', async () => {
    const wait = deferred();
    http.mockReturnValueOnce(wait.promise as never);
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID');
    const hook = setup();
    let flight!: Promise<void>;
    act(() => {
      flight = hook.result.current.generate(essay.question_id, defaults);
      void hook.result.current.generate(essay.question_id, defaults);
      void hook.result.current.generate(essays[1].question_id, defaults);
    });
    expect(http).toHaveBeenCalledTimes(1);
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(hook.result.current.busy).toBe(true);
    await act(async () => { wait.resolve(responseFor(requestBody())); await flight; });
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.getHints(essays[1].question_id).phase).toBe('idle');
  });

  it('client deadline ends waiting; retry reuses immutable defaults and UUID, generate uses a new UUID', async () => {
    vi.useFakeTimers();
    http.mockReturnValueOnce(new Promise(() => {}) as never);
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID');
    const selection: WritingHintsLanguageSelection = { ...defaults };
    const hook = setup();
    let flight!: Promise<void>;
    act(() => { flight = hook.result.current.generate(essay.question_id, selection); });
    const first = structuredClone(requestBody());
    selection.learningLanguage = 'fr';
    await act(async () => { await vi.advanceTimersByTimeAsync(150_000); await flight; });
    expect(hook.result.current.getHints(essay.question_id)).toMatchObject({ phase: 'error', error: { action: 'retry' } });
    expect(hook.result.current.busy).toBe(false);
    expect(http).toHaveBeenCalledTimes(1);
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(requestBody(1)).toEqual(first);
    expect(first).toEqual({ partId: 30, questionId: 'writing-task-1', requestId: expect.any(String) });
    expect(hook.result.current.getHints(essay.question_id).lastSelection).toEqual(defaults);
    expect(uuid).toHaveBeenCalledTimes(1);
    await generate(hook, essay.question_id, { learningLanguage: 'fr', hintLanguage: 'vi' });
    expect(requestBody(2).requestId).not.toBe(first.requestId);
    expect(requestBody(2)).toMatchObject({ learningLanguage: 'fr', hintLanguage: 'vi' });
  });

  it.each(['en', 'vi', 'fr', 'ko', 'zh', 'ja', 'de', 'es'])('preserves explicit %s selection and response languages', async language => {
    const hook = setup();
    await generate(hook, essay.question_id, { learningLanguage: language, hintLanguage: 'vi' });
    expect(requestBody()).toMatchObject({ learningLanguage: language, hintLanguage: 'vi' });
    expect(hook.result.current.getHints(essay.question_id).data).toMatchObject({ learningLanguage: language, hintLanguage: 'vi' });
  });

  it('invalid language creates no HTTP and no English fallback', async () => {
    const hook = setup();
    await generate(hook, essay.question_id, { learningLanguage: 'invalid_tag', hintLanguage: null });
    expect(http).not.toHaveBeenCalled();
    expect(hook.result.current.getHints(essay.question_id).error?.action).toBe('change-language');
  });

  it('new generation failure preserves prior hints and their resolved labels with an error', async () => {
    const hook = setup();
    await generate(hook);
    const data = hook.result.current.getHints(essay.question_id).data;
    http.mockRejectedValueOnce(new Error('SECRET raw request'));
    await generate(hook, essay.question_id, { learningLanguage: 'fr', hintLanguage: 'vi' });
    expect(hook.result.current.getHints(essay.question_id)).toMatchObject({ phase: 'error', data, error: { action: 'retry' } });
    expect(hook.result.current.getHints(essay.question_id).error?.message).not.toContain('SECRET');
    expect(hook.result.current.getHints(essay.question_id).data?.learningLanguage).toBe('en');
  });

  it.each([[409, 1604, 'pending'], [429, 1606, 'rate-limited']] as const)('%s/%s backoff applies across questions, expires without HTTP, permits manual retry', async (status, code, kind) => {
    vi.useFakeTimers();
    http.mockRejectedValueOnce({ response: { status, data: { code }, headers: { 'Retry-After': '3' } } });
    const hook = setup();
    await generate(hook);
    expect(hook.result.current.retryAfterSeconds).toBe(3);
    expect(hook.result.current.getHints(essay.question_id).error?.kind).toBe(kind);
    await generate(hook, essays[1].question_id);
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(http).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(hook.result.current.retryAfterSeconds).toBe(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(hook.result.current.retryAfterSeconds).toBeNull();
    expect(http).toHaveBeenCalledTimes(1);
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(requestBody(1)).toEqual(requestBody());
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
  });

  it.each([[401, 401, 'access'], [403, 403, 'access'], [409, 1605, 'conflict'], [409, 409, 'ended'],
    [429, 429, 'quota'], [404, 404, 'context'], [422, 1609, 'context'], [413, 1611, 'context']] as const)(
    '%s/%s blocks further hints until fresh hydration', async (status, code, kind) => {
      const hook = setup();
      await generate(hook);
      http.mockRejectedValueOnce({ response: { status, data: { code, message: 'SECRET' } } });
      await generate(hook, essays[1].question_id);
      expect(hook.result.current.blockedError?.kind).toBe(kind);
      expect(hook.result.current.retryAfterSeconds).toBeNull();
      if (['access', 'conflict', 'ended'].includes(kind)) expect(hook.result.current.getHints(essay.question_id).data).toBeNull();
      expect(hook.result.current.blockedError?.message).not.toContain('SECRET');
      await generate(hook);
      await act(async () => { await hook.result.current.retry(essays[1].question_id); });
      expect(http).toHaveBeenCalledTimes(2);
      act(() => { hook.store.dispatch(setAttemptContext({ attemptId: 42, version: 8, savedAnswers: [] })); });
      expect(hook.result.current.blockedError).toBeNull();
      await generate(hook);
      expect(http).toHaveBeenCalledTimes(3);
    },
  );

  it.each([1607, 1608])('language code %s refuses replay but accepts a manually changed operation', async code => {
    http.mockRejectedValueOnce({ response: { status: 422, data: { code } } });
    const hook = setup();
    await generate(hook);
    expect(hook.result.current.getHints(essay.question_id).error?.action).toBe('change-language');
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(http).toHaveBeenCalledTimes(1);
    await generate(hook, essay.question_id, { learningLanguage: 'vi', hintLanguage: null });
    expect(requestBody(1).requestId).not.toBe(requestBody().requestId);
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
  });

  it('malformed response is never published; manual retry uses the same request', async () => {
    http.mockResolvedValueOnce(createWritingHintsEnvelope({ ...validWritingHintsEn, requestId: 'wrong' }) as never);
    const hook = setup();
    await generate(hook);
    expect(hook.result.current.getHints(essay.question_id)).toMatchObject({ phase: 'error', data: null, error: { kind: 'contract', action: 'retry' } });
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(requestBody(1)).toEqual(requestBody());
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
  });

  it('part A → B → A cancels immediately, keeps operation, and ignores late finally during new flight', async () => {
    const old = deferred();
    const next = deferred();
    http.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(next.promise as never);
    const hook = setup();
    let first!: Promise<void>;
    act(() => { first = hook.result.current.generate(essay.question_id, defaults); });
    const body = structuredClone(requestBody());
    hook.rerender({ ...hook.props, partId: 31, questions: [essay] });
    expect(http.mock.calls[0][2]?.signal?.aborted).toBe(true);
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.getHints(essay.question_id).data).toBeNull();
    hook.rerender(hook.props);
    let second!: Promise<void>;
    act(() => { second = hook.result.current.retry(essay.question_id); });
    expect(requestBody(1)).toEqual(body);
    await act(async () => { await first; old.resolve(responseFor(body)); });
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('loading');
    await act(async () => { next.resolve(responseFor(requestBody(1))); await second; });
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
    expect(hook.result.current.busy).toBe(false);
  });

  it('same question ID in two parts has independent hints and immutable retry operations', async () => {
    const hook = setup();
    await generate(hook);
    const first = hook.result.current.getHints(essay.question_id).data;
    hook.rerender({ ...hook.props, partId: 31, questions: [essay] });
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('idle');
    await generate(hook);
    expect(hook.result.current.getHints(essay.question_id).data?.partId).toBe(31);
    hook.rerender(hook.props);
    expect(hook.result.current.getHints(essay.question_id).data).toEqual(first);
  });

  it.each(['same-ID hydration', 'attempt A-B-A'])('%s clears old operations and rejects stale completions', async scenario => {
    const old = deferred();
    const next = deferred();
    http.mockReturnValueOnce(old.promise as never).mockReturnValueOnce(next.promise as never);
    const hook = setup();
    let first!: Promise<void>;
    act(() => { first = hook.result.current.generate(essay.question_id, defaults); });
    if (scenario === 'attempt A-B-A') {
      act(() => { hook.store.dispatch(setAttemptContext({ attemptId: 43, version: 1, savedAnswers: [] })); });
      hook.rerender({ ...hook.props, workspace: workspace(43) });
    }
    act(() => { hook.store.dispatch(setAttemptContext({ attemptId: 42, version: 8, savedAnswers: [] })); });
    hook.rerender(hook.props);
    await act(async () => { await first; });
    expect(hook.result.current.busy).toBe(false);
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('idle');
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(http).toHaveBeenCalledTimes(1);
    let second!: Promise<void>;
    act(() => { second = hook.result.current.generate(essay.question_id, defaults); });
    await act(async () => { old.resolve(responseFor(requestBody())); });
    expect(hook.result.current.busy).toBe(true);
    expect(hook.result.current.getHints(essay.question_id).data).toBeNull();
    await act(async () => { next.resolve(responseFor(requestBody(1))); await second; });
    expect(requestBody(1).requestId).not.toBe(requestBody().requestId);
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
  });

  it('workspace route changes clear data even before Redux hydration', async () => {
    const hook = setup();
    await generate(hook);
    hook.rerender({ ...hook.props, workspace: workspace(43) });
    expect(hook.result.current.getHints(essay.question_id).data).toBeNull();
    hook.rerender(hook.props);
    await act(async () => { await hook.result.current.retry(essay.question_id); });
    expect(http).toHaveBeenCalledTimes(1);
  });

  it('metadata refresh and essay A-B-A edits do not clear hints or mutate Redux/draft/storage', async () => {
    const wait = deferred();
    http.mockReturnValueOnce(wait.promise as never);
    localStorage.setItem('exam_draft_42', 'original draft');
    sessionStorage.setItem('other-session', 'original');
    const localWrite = vi.spyOn(Storage.prototype, 'setItem');
    const storageRead = vi.spyOn(Storage.prototype, 'getItem');
    const storageRemove = vi.spyOn(Storage.prototype, 'removeItem');
    const hook = setup();
    let flight!: Promise<void>;
    act(() => { flight = hook.result.current.generate(essay.question_id, defaults); });
    act(() => {
      hook.store.dispatch(setAnswer({ partId: 30, questionId: essay.question_id, value: 'A' }));
      hook.store.dispatch(setAnswer({ partId: 30, questionId: essay.question_id, value: 'B' }));
      hook.store.dispatch(setAnswer({ partId: 30, questionId: essay.question_id, value: 'A' }));
    });
    const before = structuredClone(hook.store.getState());
    hook.rerender({ ...hook.props, workspace: { ...workspace(), version: 8, serverTimeOffset: 99 } });
    await act(async () => { wait.resolve(responseFor(requestBody())); await flight; });
    expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
    expect(hook.store.getState()).toEqual(before);
    expect(localWrite).not.toHaveBeenCalled();
    expect(storageRead).not.toHaveBeenCalled();
    expect(storageRemove).not.toHaveBeenCalled();
    expect(localStorage.getItem('exam_draft_42')).toBe('original draft');
    expect(sessionStorage.getItem('other-session')).toBe('original');
  });

  it.each(['suspend', 'store-lock', 'live-submission-lock', 'section-lock', 'terminal-status'])('%s immediately invalidates flight; failed submit can manually retry', async scenario => {
    const wait = deferred();
    http.mockReturnValueOnce(wait.promise as never);
    let locked = false;
    const hook = setup({ isLocked: () => locked });
    let flight!: Promise<void>;
    act(() => { flight = hook.result.current.generate(essay.question_id, defaults); });
    if (scenario === 'suspend') act(() => { hook.result.current.suspend(); });
    if (scenario === 'store-lock') act(() => { hook.store.dispatch(lockAnswers({ attemptId: 42, contextRevision: 1 })); });
    if (scenario === 'live-submission-lock') { locked = true; hook.rerender(hook.props); }
    if (scenario === 'section-lock') hook.rerender({ ...hook.props, workspace: { ...workspace(), lockedSections: [3] } });
    if (scenario === 'terminal-status') hook.rerender({ ...hook.props, workspace: { ...workspace(), status: 'SUBMITTED' } });
    await act(async () => { await flight; });
    expect(hook.result.current.busy).toBe(false);
    expect(http.mock.calls[0][2]?.signal?.aborted).toBe(true);
    if (scenario === 'terminal-status') expect(hook.result.current.getHints(essay.question_id).data).toBeNull();
    locked = false;
    act(() => { hook.store.dispatch(unlockAnswers({ attemptId: 42, contextRevision: 1 })); });
    hook.rerender(hook.props);
    if (scenario !== 'terminal-status') {
      await act(async () => { await hook.result.current.retry(essay.question_id); });
      expect(requestBody(1)).toEqual(requestBody());
      expect(hook.result.current.getHints(essay.question_id).phase).toBe('ready');
    }
    await act(async () => { wait.reject(new Error('late rejection')); });
    expect(hook.result.current.busy).toBe(false);
  });

  it('unmount aborts pending transport and disables captured callbacks; no timer/HTTP survives cleanup', async () => {
    vi.useFakeTimers();
    const wait = deferred();
    http.mockReturnValueOnce(wait.promise as never);
    const hook = setup({}, true);
    const controller = hook.result.current;
    let flight!: Promise<void>;
    act(() => { flight = controller.generate(essay.question_id, defaults); });
    hook.unmount();
    await flight;
    expect(http.mock.calls[0][2]?.signal?.aborted).toBe(true);
    await controller.generate(essay.question_id, defaults);
    await controller.retry(essay.question_id);
    await vi.advanceTimersByTimeAsync(200_000);
    expect(http).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    wait.reject(new Error('late rejection after unmount'));
    await Promise.resolve();
  });
});
