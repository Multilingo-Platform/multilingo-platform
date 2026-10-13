import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as axiosClientModule from '../../../core/api/axiosClient';
import {
  autosaveAnswers,
  submitAttempt,
  getWorkspace,
  createAttempt,
  WorkspaceContractError,
  getAttemptResult,
  getAttemptReview,
  checkPracticeAnswer,
  generateWritingHints,
  HINTS_TIMEOUT_MS,
  WritingHintsContractError,
} from '../api/attemptApi';
import { ReviewContractError } from '../api/reviewContract';
import { PracticeFeedbackContractError } from '../api/practiceFeedbackContract';
import { attemptResultFixture, resultEnvelope } from './fixtures/attemptResult';
import { attemptReviewFixture, reviewEnvelope } from './fixtures/attemptReview';
import { practiceFeedbackFixture, practiceFeedbackEnvelope } from './fixtures/practiceFeedback';
import {
  validWritingHintsEn,
  validWritingHintsVi,
  validWritingHintsRequest,
  VALID_REQUEST_ID,
  createWritingHintsEnvelope,
} from './fixtures/writingHints';

vi.mock('../../../core/api/axiosClient', () => ({
  default: { put: vi.fn(), post: vi.fn(), get: vi.fn() },
}));

const mockAxios = axiosClientModule.default as any;

describe('TV3-12 result GET', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('uses exact endpoint with bounded config and returns a validated projection', async () => {
    mockAxios.get.mockResolvedValueOnce(resultEnvelope());
    const result = await getAttemptResult(42);
    expect(mockAxios.get).toHaveBeenCalledWith('/v1/attempts/42/result', expect.objectContaining({
      timeout: 10000, signal: expect.any(AbortSignal),
    }));
    expect(result.resultSummary).not.toHaveProperty('partResults');
    expect(result.resultSummary?.objective.rawScore).toBe(5.5);
  });
  it.each([0, -1, 1.5, 2147483648, NaN])('invalid ID %s never reaches HTTP', async id => {
    await expect(getAttemptResult(id)).rejects.toThrow();
    expect(mockAxios.get).not.toHaveBeenCalled();
  });
  it.each([
    resultEnvelope({ ...attemptResultFixture(), attemptId: 43 }),
    resultEnvelope({ ...attemptResultFixture(), status: 'IN_PROGRESS' }),
    resultEnvelope(null), { success: false, message: 'sensitive server detail' },
    { success: 'true', data: attemptResultFixture() },
  ])('rejects malformed receipt with fixed error %j', async envelope => {
    mockAxios.get.mockResolvedValueOnce(envelope);
    await expect(getAttemptResult(42)).rejects.toThrow('Phản hồi kết quả không hợp lệ');
  });
  it.each([400, 401, 403, 409, 500])('preserves HTTP %s for hook classification', async status => {
    const error = { response: { status, data: { message: 'private detail' } } };
    mockAxios.get.mockRejectedValueOnce(error);
    await expect(getAttemptResult(42)).rejects.toBe(error);
  });
  it('settles at whole-request deadline even when interceptor/transport never settles', async () => {
    vi.useFakeTimers(); mockAxios.get.mockReturnValueOnce(new Promise(() => {}));
    const pending = getAttemptResult(42);
    const rejection = expect(pending).rejects.toThrow(/quá thời gian/i);
    await vi.advanceTimersByTimeAsync(9999);
    expect(mockAxios.get.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1); await rejection;
    expect(mockAxios.get.mock.calls[0][1].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts waiting, ignores late transport settlement and removes listener/timer', async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    mockAxios.get.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = getAttemptResult(42, { signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow(/hủy/i);
    controller.abort(); await rejection;
    resolve(resultEnvelope()); await Promise.resolve();
    expect(mockAxios.get.mock.calls[0][1].signal.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });
  it('already aborted signal does not dispatch transport', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(getAttemptResult(42, { signal: controller.signal })).rejects.toThrow(/hủy/i);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });
});

describe('autosaveAnswers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PUT /v1/attempts/:id/answers and returns unwrapped AutosaveResponse', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: 4 } });
    const result = await autosaveAnswers(42, { version: 3, answers: [] });
    expect(mockAxios.put).toHaveBeenCalledWith('/v1/attempts/42/answers', {
      version: 3,
      answers: [],
    }, expect.objectContaining({ timeout: 10000, signal: expect.any(AbortSignal) }));
    expect(result).toEqual({ version: 4 });
  });

  it('rejects when response data is missing or version is not an integer', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: true, data: null });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    mockAxios.put.mockResolvedValueOnce({ success: true, data: {} });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: 'invalid' } });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    // Out of range, negative, or zero
    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: 0 } });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: -1 } });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: 2147483648 } }); // > Java Integer.MAX_VALUE
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();

    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: Number.MAX_SAFE_INTEGER + 1 } });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow();
  });

  it('throws when API returns success=false', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: false, message: 'conflict' });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow('conflict');
  });
});

describe('submitAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /v1/attempts/:id/submit and returns normalized result', async () => {
    mockAxios.post.mockResolvedValueOnce({
      success: true,
      data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' },
    });
    const result = await submitAttempt(42, { reason: 'MANUAL', baseVersion: 5, finalAnswers: [] });
    expect(mockAxios.post).toHaveBeenCalledWith('/v1/attempts/42/submit', {
      reason: 'MANUAL', baseVersion: 5, finalAnswers: [],
    }, expect.objectContaining({ timeout: 10000, signal: expect.any(AbortSignal) }));
    expect(result).toEqual({
      attempt_id: 42,
      status: 'COMPLETED',
      redirect_url: '/attempts/42/result',
    });
  });

  it('throws when server returns error', async () => {
    mockAxios.post.mockResolvedValueOnce({ success: false, message: 'not found' });
    await expect(submitAttempt(99, { reason: 'MANUAL', baseVersion: 1, finalAnswers: [] })).rejects.toThrow('not found');
  });

  it.each([
    { attemptId: 43, status: 'COMPLETED', redirectUrl: '/attempts/42/result' },
    { attemptId: 42, status: 'IN_PROGRESS', redirectUrl: '/attempts/42/result' },
    { attemptId: 42, status: 'UNKNOWN', redirectUrl: '/attempts/42/result' },
    { attemptId: 42, status: 'COMPLETED', redirectUrl: 'https://evil.test' },
  ])('rejects malformed submit receipt %j', async data => {
    mockAxios.post.mockResolvedValueOnce({ success: true, data });
    await expect(submitAttempt(42, { reason: 'MANUAL', baseVersion: 7, finalAnswers: [] })).rejects.toThrow();
  });
  it.each([0, -1, 1.5, 2147483648])('does not write invalid ID/version %s', async invalid => {
    await expect(autosaveAnswers(invalid, { version: 1, answers: [] })).rejects.toThrow();
    await expect(submitAttempt(42, { reason: 'MANUAL', baseVersion: invalid, finalAnswers: [] })).rejects.toThrow();
    expect(mockAxios.put).not.toHaveBeenCalled();
    expect(mockAxios.post).not.toHaveBeenCalled();
  });
});

describe('attempt write lifetime', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());
  it.each([1, 2147483647])('accepts positive Java integer boundary %s', async value => {
    mockAxios.put.mockResolvedValueOnce({ success: true, data: { version: value } });
    await expect(autosaveAnswers(value, { version: value, answers: [] })).resolves.toEqual({ version: value });
    mockAxios.post.mockResolvedValueOnce({ success: true, data: { attemptId: value, status: 'COMPLETED', redirectUrl: `/attempts/${value}/result` } });
    await expect(submitAttempt(value, { reason: 'MANUAL', baseVersion: value, finalAnswers: [] })).resolves.toHaveProperty('attempt_id', value);
  });
  it('ignores late transport success after its deadline', async () => {
    let resolve!: (value: unknown) => void;
    mockAxios.post.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const request = submitAttempt(42, { reason: 'MANUAL', baseVersion: 7, finalAnswers: [] });
    const checked = expect(request).rejects.toThrow(/quá thời gian/i);
    await vi.advanceTimersByTimeAsync(10000); await checked;
    resolve({ success: true, data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' } });
    await expect(request).rejects.toThrow(/quá thời gian/i);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('settles at 10 seconds even if the transport/interceptor never settles', async () => {
    mockAxios.put.mockImplementationOnce(() => new Promise(() => {}));
    const request = autosaveAnswers(42, { version: 7, answers: [] });
    const checked = expect(request).rejects.toThrow(/quá thời gian/i);
    await vi.advanceTimersByTimeAsync(10000);
    await checked;
    expect(mockAxios.put.mock.calls[0][2].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('external abort settles without waiting for a transport that ignores cancellation', async () => {
    mockAxios.post.mockImplementationOnce(() => new Promise(() => {}));
    const controller = new AbortController();
    const request = submitAttempt(42, { reason: 'TIMEOUT_CLIENT', baseVersion: 7, finalAnswers: [] }, { signal: controller.signal });
    const checked = expect(request).rejects.toThrow(/hủy/i);
    controller.abort();
    await checked;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('getWorkspace and createAttempt contracts', () => {
  beforeEach(() => vi.restoreAllMocks());

  const validWorkspaceData = {
    attemptId: 42,
    status: 'IN_PROGRESS',
    testScope: 'FULL_EXAM',
    testMode: 'PRACTICE',
    startTime: new Date(0).toISOString(),
    serverTime: new Date(4000).toISOString(),
    gracePeriodSeconds: 15,
    version: 7,
    savedAnswers: [
      {
        part_id: 10,
        answers: [
          { question_id: 'q_str', answer: 'string_val' },
          { question_id: 'q_arr', answer: ['opt1', 'opt2'] },
          { question_id: 'q_map', answer: { key1: 'val1' } },
          { question_id: 'q_null', answer: null },
          { question_id: 'q_essay', answer: '  Bài làm tự luận tiếng Việt có dấu  ' },
        ],
      },
    ],
    lockedSections: [100],
    examSnapshot: { id: 1, title: 'IELTS Mock', sections: [] },
  };

  it('calculates midpoint offset with Date.now spy and returns normalized WorkspaceResponse', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3000);
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: validWorkspaceData,
    });

    const res = await getWorkspace(42);
    expect(res.attempt_id).toBe(42);
    expect(res.version).toBe(7);
    expect(res.status).toBe('IN_PROGRESS');
    expect(res.test_scope).toBe('FULL_EXAM');
    expect(res.test_mode).toBe('PRACTICE');
    expect(res.startTime).toBe(new Date(0).toISOString());
    expect(res.serverTime).toBe(new Date(4000).toISOString());
    expect(res.serverTimeOffset).toBe(2000); // 4000 - (1000 + 3000)/2
    expect(res.gracePeriodSeconds).toBe(15);
    expect(res.lockedSections).toEqual([100]);
    expect(res.saved_answers).toHaveLength(1);
    expect(res.saved_answers[0].part_id).toBe(10);
    expect(res.saved_answers[0].answers).toEqual([
      { question_id: 'q_str', answer: 'string_val' },
      { question_id: 'q_arr', answer: ['opt1', 'opt2'] },
      { question_id: 'q_map', answer: { key1: 'val1' } },
      { question_id: 'q_null', answer: null },
      { question_id: 'q_essay', answer: '  Bài làm tự luận tiếng Việt có dấu  ' },
    ]);
    expect(res.deadline).toBeNull();
  });

  it('accepts snake_case wire aliases and camelCase nested answers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(2000);
    const snakeData = {
      attempt_id: 42,
      status: 'IN_PROGRESS',
      test_scope: 'FULL_EXAM',
      test_mode: 'PRACTICE',
      start_time: new Date(0).toISOString(),
      server_time: new Date(2000).toISOString(),
      grace_period_seconds: 15,
      version: 7,
      saved_answers: [
        {
          partId: 10,
          answers: [{ questionId: 'q_1', answer: 'A' }],
        },
      ],
      locked_sections: [100],
      exam_snapshot: { id: 1, sections: [] },
    };
    mockAxios.get.mockResolvedValueOnce({ success: true, data: snakeData });

    const res = await getWorkspace(42);
    expect(res.attempt_id).toBe(42);
    expect(res.startTime).toBe(new Date(0).toISOString());
    expect(res.gracePeriodSeconds).toBe(15);
    expect(res.lockedSections).toEqual([100]);
    expect(res.saved_answers[0].part_id).toBe(10);
    expect(res.saved_answers[0].answers[0].question_id).toBe('q_1');
  });

  it('validates MOCK_TEST deadline must not be before startTime', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    // Invalid mock: deadline before startTime
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        testMode: 'MOCK_TEST',
        startTime: '2026-10-10T04:00:00Z',
        deadline: '2026-10-10T03:00:00Z',
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Invalid mock: missing deadline
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        testMode: 'MOCK_TEST',
        deadline: null,
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Valid mock
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        testMode: 'MOCK_TEST',
        startTime: '2026-10-10T03:00:00Z',
        deadline: '2026-10-10T04:00:00Z',
      },
    });
    const validRes = await getWorkspace(42);
    expect(validRes.deadline).toBe('2026-10-10T04:00:00Z');
  });

  it('rejects missing, non-integer, negative, zero or out of bounds version without defaulting to 0', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const testVersions = [undefined, null, 0, -1, '7', 1.5, NaN, 2147483648];
    for (const v of testVersions) {
      mockAxios.get.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, version: v },
      });
      await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);
    }

    // Boundary valid versions: 1 and 2147483647
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, version: 1 },
    });
    const res1 = await getWorkspace(42);
    expect(res1.version).toBe(1);

    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, version: 2147483647 },
    });
    const resMax = await getWorkspace(42);
    expect(resMax.version).toBe(2147483647);
  });

  it('rejects mismatched attempt ID', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, attemptId: 99 },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);
  });

  it('accepts empty saved answers array', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, savedAnswers: [] },
    });
    const res = await getWorkspace(42);
    expect(res.saved_answers).toEqual([]);
  });

  it('rejects malformed saved answers: non-array, duplicate partId, empty questionId, duplicate questionId, invalid answer type', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    // Non-array
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, savedAnswers: 'not an array' },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Duplicate partId
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          { part_id: 10, answers: [] },
          { part_id: 10, answers: [] },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Empty questionId
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: '', answer: 'A' }] },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Duplicate questionId
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          {
            part_id: 10,
            answers: [
              { question_id: 'q1', answer: 'A' },
              { question_id: 'q1', answer: 'B' },
            ],
          },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Invalid answer type (e.g. number)
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          { part_id: 10, answers: [{ question_id: 'q1', answer: 12345 }] },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);
  });

  it('rejects invalid status not in backend 7-status enum', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, status: 'INVALID_STATUS' },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);
  });

  it('rejects snapshot missing sections array', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, examSnapshot: { id: 1 } },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);
  });

  it('createAttempt sends payload and normalizes response with clock offset', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(3000);
    mockAxios.post.mockResolvedValueOnce({
      success: true,
      data: { ...validWorkspaceData, attemptId: 88 },
    });

    const res = await createAttempt({
      exam_id: 1,
      test_scope: 'FULL_EXAM',
      test_mode: 'PRACTICE',
      section_id: null,
      part_id: null,
    });

    expect(mockAxios.post).toHaveBeenCalledWith('/v1/attempts', {
      examId: 1,
      testScope: 'FULL_EXAM',
      testMode: 'PRACTICE',
      targetSectionId: null,
      targetPartId: null,
    });
    expect(res.attempt_id).toBe(88);
    expect(res.serverTimeOffset).toBe(2000);
  });

  it('rejects timestamps that are not strict ISO instants (year-only, date-only, locale, missing tz, invalid date) on GET and create POST', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const nonIsoTimestamps = [
      '2026',
      '2026-10-10',
      '10/10/2026',
      '2026-10-10T12:00:00',
      '2026-02-30T12:00:00Z',
      '2026-02-29T12:00:00Z', // non-leap year
      '2026-10-10T25:00:00Z',
      'not-a-date',
    ];

    for (const badTime of nonIsoTimestamps) {
      // bad startTime on getWorkspace
      mockAxios.get.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, startTime: badTime },
      });
      await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

      // bad serverTime on getWorkspace
      mockAxios.get.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, serverTime: badTime },
      });
      await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

      // bad deadline in MOCK_TEST on getWorkspace
      mockAxios.get.mockResolvedValueOnce({
        success: true,
        data: {
          ...validWorkspaceData,
          testMode: 'MOCK_TEST',
          startTime: '2026-10-10T03:00:00Z',
          deadline: badTime,
        },
      });
      await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

      // bad serverTime on createAttempt
      mockAxios.post.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, serverTime: badTime },
      });
      await expect(
        createAttempt({
          exam_id: 1,
          test_scope: 'FULL_EXAM',
          test_mode: 'PRACTICE',
          section_id: null,
          part_id: null,
        })
      ).rejects.toThrow(WorkspaceContractError);
    }

    // Valid ISO instant with timezone offset passes
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        startTime: '2026-10-10T10:00:00+07:00',
        serverTime: '2026-10-10T10:05:00+07:00',
      },
    });
    const validOffsetRes = await getWorkspace(42);
    expect(validOffsetRes.startTime).toBe('2026-10-10T10:00:00+07:00');
  });

  it('rejects non-primitive, array, number or null timestamps with WorkspaceContractError on GET and create POST (not TypeError)', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const nonPrimitiveTimestamps = [
      { toString: 'bad' },
      [2026, 10, 10],
      1791633600000,
      null,
      true,
    ];

    for (const badTime of nonPrimitiveTimestamps) {
      // serverTime as object/array/number on GET
      mockAxios.get.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, serverTime: badTime },
      });
      let getErr: unknown;
      try {
        await getWorkspace(42);
      } catch (e) {
        getErr = e;
      }
      expect(getErr).toBeInstanceOf(WorkspaceContractError);
      expect((getErr as Error).message).toBe('Dữ liệu phiên thi không hợp lệ. Vui lòng thử tải lại.');

      // serverTime as object/array/number on createAttempt
      mockAxios.post.mockResolvedValueOnce({
        success: true,
        data: { ...validWorkspaceData, serverTime: badTime },
      });
      let createErr: unknown;
      try {
        await createAttempt({
          exam_id: 1,
          test_scope: 'FULL_EXAM',
          test_mode: 'PRACTICE',
          section_id: null,
          part_id: null,
        });
      } catch (e) {
        createErr = e;
      }
      expect(createErr).toBeInstanceOf(WorkspaceContractError);
      expect((createErr as Error).message).toBe('Dữ liệu phiên thi không hợp lệ. Vui lòng thử tải lại.');
    }
  });

  it('preserves canonical field precedence over aliases on outer and nested fields', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    // 1. Canonical-invalid outer field with alias-valid MUST BE REJECTED (no fallback to alias)
    // startTime null + start_time valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        startTime: null,
        start_time: '2026-10-10T03:00:00Z',
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // serverTime invalid + server_time valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        serverTime: '2026',
        server_time: '2026-10-10T03:00:00Z',
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // attemptId null + attempt_id valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        attemptId: null,
        attempt_id: 42,
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // gracePeriodSeconds null + grace_period_seconds valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        gracePeriodSeconds: null,
        grace_period_seconds: 15,
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // lockedSections null + locked_sections valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        lockedSections: null,
        locked_sections: [100],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // examSnapshot null + exam_snapshot valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        examSnapshot: null,
        exam_snapshot: { id: 1, sections: [] },
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // savedAnswers null + saved_answers valid
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: null,
        saved_answers: [],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // 2. Canonical-valid with alias-conflicting uses canonical
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        startTime: '2026-10-10T03:00:00Z',
        start_time: '2026-10-10T09:00:00Z',
        gracePeriodSeconds: 15,
        grace_period_seconds: 99,
      },
    });
    const resConflicting = await getWorkspace(42);
    expect(resConflicting.startTime).toBe('2026-10-10T03:00:00Z');
    expect(resConflicting.gracePeriodSeconds).toBe(15);

    // 3. Nested fields: canonical is snake_case (part_id, question_id), alias is camelCase
    // part_id null + partId valid -> REJECT
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          {
            part_id: null,
            partId: 10,
            answers: [{ question_id: 'q1', answer: 'A' }],
          },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // question_id null + questionId valid -> REJECT
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          {
            part_id: 10,
            answers: [{ question_id: null, questionId: 'q1', answer: 'A' }],
          },
        ],
      },
    });
    await expect(getWorkspace(42)).rejects.toThrow(WorkspaceContractError);

    // Nested conflicting: uses canonical snake_case
    mockAxios.get.mockResolvedValueOnce({
      success: true,
      data: {
        ...validWorkspaceData,
        savedAnswers: [
          {
            part_id: 10,
            partId: 99,
            answers: [
              {
                question_id: 'q_canonical',
                questionId: 'q_alias',
                answer: 'A',
              },
            ],
          },
        ],
      },
    });
    const resNestedConflicting = await getWorkspace(42);
    expect(resNestedConflicting.saved_answers[0].part_id).toBe(10);
    expect(resNestedConflicting.saved_answers[0].answers[0].question_id).toBe('q_canonical');
  });
});

describe('TV3-14 review GET', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('uses exact endpoint with bounded config and returns normalized review', async () => {
    mockAxios.get.mockResolvedValueOnce(reviewEnvelope(attemptReviewFixture(42, 10)));
    const result = await getAttemptReview(42, 10);
    expect(mockAxios.get).toHaveBeenCalledWith('/v1/attempts/42/review/10', expect.objectContaining({
      timeout: 10000, signal: expect.any(AbortSignal),
    }));
    expect(result.attemptId).toBe(42);
    expect(result.partId).toBe(10);
    expect(result.partStats.totalQuestions).toBe(2);
  });

  it.each([0, -1, 1.5, 2147483648, NaN])('invalid attemptId %s never reaches HTTP', async id => {
    await expect(getAttemptReview(id, 10)).rejects.toThrow(ReviewContractError);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 2147483648, NaN])('invalid partId %s never reaches HTTP', async partId => {
    await expect(getAttemptReview(42, partId)).rejects.toThrow(ReviewContractError);
    expect(mockAxios.get).not.toHaveBeenCalled();
  });

  it.each([
    reviewEnvelope({ ...attemptReviewFixture(42, 10), attemptId: 43 }),
    reviewEnvelope({ ...attemptReviewFixture(42, 10), partId: 11 }),
    { success: false, code: 404, message: 'Not Found', data: null },
    { success: true, code: 1000, message: 'Success', data: null },
    null,
  ])('rejects invalid review envelope or mismatched data %j', async envelope => {
    mockAxios.get.mockResolvedValueOnce(envelope);
    await expect(getAttemptReview(42, 10)).rejects.toThrow(ReviewContractError);
  });

  it('passes external AbortSignal and abort cancels immediately', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(getAttemptReview(42, 10, { signal: controller.signal })).rejects.toThrow();
    expect(mockAxios.get).not.toHaveBeenCalled();
  });
});

describe('TV3-16-01 checkPracticeAnswer', () => {
  beforeEach(() => vi.resetAllMocks());
  afterEach(() => vi.useRealTimers());

  it('uses exact POST /v1/attempts/:id/practice-feedback with exact payload and bounded config', async () => {
    mockAxios.post.mockResolvedValueOnce(
      practiceFeedbackEnvelope(practiceFeedbackFixture({
        score: 1,
        userAnswer: 'A',
        correctAnswer: 'A',
      }))
    );

    const result = await checkPracticeAnswer(42, {
      partId: 10,
      questionId: 'q1',
      answer: 'A',
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      '/v1/attempts/42/practice-feedback',
      {
        partId: 10,
        questionId: 'q1',
        answer: 'A',
      },
      expect.objectContaining({
        timeout: 10000,
        signal: expect.any(AbortSignal),
      })
    );

    expect(result).toEqual({
      attemptId: 42,
      partId: 10,
      questionId: 'q1',
      type: 'SINGLE_CHOICE',
      userAnswer: 'A',
      verdict: 'CORRECT',
      score: 1,
      correctAnswer: 'A',
      explanation: 'Giải thích chi tiết cho câu q1.',
    });
  });

  it('sends null answer correctly without extraneous fields', async () => {
    mockAxios.post.mockResolvedValueOnce(
      practiceFeedbackEnvelope(practiceFeedbackFixture({
        userAnswer: null,
        verdict: 'BLANK',
        score: 0,
      }))
    );

    const result = await checkPracticeAnswer(42, {
      partId: 10,
      questionId: 'q1',
      answer: null,
    });

    expect(mockAxios.post).toHaveBeenCalledWith(
      '/v1/attempts/42/practice-feedback',
      {
        partId: 10,
        questionId: 'q1',
        answer: null,
      },
      expect.any(Object)
    );

    expect(result.userAnswer).toBeNull();
    expect(result.verdict).toBe('BLANK');
  });

  it.each([0, -1, 1.5, 2147483648, NaN])('invalid attemptId %s never reaches HTTP', async id => {
    await expect(
      checkPracticeAnswer(id, { partId: 10, questionId: 'q1', answer: 'A' })
    ).rejects.toThrow(PracticeFeedbackContractError);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 2147483648, NaN])('invalid partId %s never reaches HTTP', async partId => {
    await expect(
      checkPracticeAnswer(42, { partId, questionId: 'q1', answer: 'A' })
    ).rejects.toThrow(PracticeFeedbackContractError);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it.each(['', '   '])('invalid questionId %s never reaches HTTP', async questionId => {
    await expect(
      checkPracticeAnswer(42, { partId: 10, questionId, answer: 'A' })
    ).rejects.toThrow(PracticeFeedbackContractError);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it.each([
    practiceFeedbackEnvelope({ ...practiceFeedbackFixture(), attemptId: 99 }),
    practiceFeedbackEnvelope({ ...practiceFeedbackFixture(), partId: 99 }),
    practiceFeedbackEnvelope({ ...practiceFeedbackFixture(), questionId: 'other' }),
    { success: false, code: 422, message: 'Unprocessable', data: null },
    { success: true, code: 200, message: 'Success', data: null },
    null,
  ])('rejects invalid envelope or mismatched receipt with PracticeFeedbackContractError %j', async envelope => {
    mockAxios.post.mockResolvedValueOnce(envelope);
    await expect(
      checkPracticeAnswer(42, { partId: 10, questionId: 'q1', answer: 'A' })
    ).rejects.toThrow(PracticeFeedbackContractError);
  });

  it.each([
    { sent: 'A', echoed: 'B', desc: 'string value mismatch' },
    { sent: 'A', echoed: null, desc: 'sent string but echoed null' },
    { sent: null, echoed: 'A', desc: 'sent null but echoed string' },
    { sent: ['A', 'B'], echoed: ['B', 'A'], desc: 'array ordering mismatch' },
    { sent: ['A', 'B'], echoed: ['A'], desc: 'array length mismatch' },
    { sent: { '1': 'A' }, echoed: { '1': 'B' }, desc: 'map value mismatch' },
    { sent: { '1': 'A' }, echoed: { '2': 'A' }, desc: 'map key mismatch' },
    { sent: { '1': 'A' }, echoed: { '1': 'A', '2': 'B' }, desc: 'map extra key' },
  ])('rejects with PracticeFeedbackContractError when server echoes wrong answer ($desc)', async ({ sent, echoed }) => {
    mockAxios.post.mockResolvedValueOnce(
      practiceFeedbackEnvelope(
        practiceFeedbackFixture({
          userAnswer: echoed as any,
        })
      )
    );

    await expect(
      checkPracticeAnswer(42, {
        partId: 10,
        questionId: 'q1',
        answer: sent as any,
      })
    ).rejects.toThrow(PracticeFeedbackContractError);
  });

  it('accepts valid response when server echoes map with different key insertion order', async () => {
    mockAxios.post.mockResolvedValueOnce(
      practiceFeedbackEnvelope(
        practiceFeedbackFixture({
          userAnswer: { '2': 'B', '1': 'A' },
          correctAnswer: { '1': 'A', '2': 'B' },
        })
      )
    );

    const result = await checkPracticeAnswer(42, {
      partId: 10,
      questionId: 'q1',
      answer: { '1': 'A', '2': 'B' },
    });

    expect(result.userAnswer).toEqual({ '2': 'B', '1': 'A' });
  });

  it('accepts valid response when server echoes exact Unicode and whitespace string', async () => {
    const unicodeWhitespace = '  Tiếng Việt 🇻🇳 \n\t  ';
    mockAxios.post.mockResolvedValueOnce(
      practiceFeedbackEnvelope(
        practiceFeedbackFixture({
          userAnswer: unicodeWhitespace,
          correctAnswer: unicodeWhitespace,
        })
      )
    );

    const result = await checkPracticeAnswer(42, {
      partId: 10,
      questionId: 'q1',
      answer: unicodeWhitespace,
    });

    expect(result.userAnswer).toBe(unicodeWhitespace);
  });

  it('uses captured payload tuple for normalization even if req object is mutated during in-flight request', async () => {
    mockAxios.post.mockImplementationOnce(async () => {
      // simulate caller mutating req while network call is in flight
      mutableReq.partId = 999;
      mutableReq.questionId = 'mutated_q';
      mutableReq.answer = 'MUTATED';
      return practiceFeedbackEnvelope(
        practiceFeedbackFixture({
          partId: 10,
          questionId: 'q1',
          userAnswer: 'A',
        })
      );
    });

    const mutableReq = {
      partId: 10,
      questionId: 'q1',
      answer: 'A',
    };

    const result = await checkPracticeAnswer(42, mutableReq);
    expect(result.partId).toBe(10);
    expect(result.questionId).toBe('q1');
    expect(result.userAnswer).toBe('A');
  });

  it.each([400, 401, 403, 404, 409, 422, 500])('preserves HTTP %s for hook classification', async status => {
    const error = { response: { status, data: { message: 'fixed error message' } } };
    mockAxios.post.mockRejectedValueOnce(error);
    await expect(
      checkPracticeAnswer(42, { partId: 10, questionId: 'q1', answer: 'A' })
    ).rejects.toBe(error);
  });

  it('settles at whole-request deadline even when transport never settles', async () => {
    vi.useFakeTimers();
    mockAxios.post.mockReturnValueOnce(new Promise(() => {}));
    const pending = checkPracticeAnswer(42, { partId: 10, questionId: 'q1', answer: 'A' });
    const rejection = expect(pending).rejects.toThrow(/quá thời gian/i);
    await vi.advanceTimersByTimeAsync(9999);
    expect(mockAxios.post.mock.calls[0][2]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(mockAxios.post.mock.calls[0][2].signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts waiting, ignores late transport settlement and removes listener/timer', async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    mockAxios.post.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');
    const pending = checkPracticeAnswer(42, { partId: 10, questionId: 'q1', answer: 'A' }, { signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow(/hủy/i);
    controller.abort();
    await rejection;
    resolve(practiceFeedbackEnvelope());
    await Promise.resolve();
    expect(mockAxios.post.mock.calls[0][2].signal.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('already aborted signal does not dispatch transport', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      checkPracticeAnswer(42, { partId: 10, questionId: 'q1', answer: 'A' }, { signal: controller.signal })
    ).rejects.toThrow(/hủy/i);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });
});

describe('generateWritingHints', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it('calls exact endpoint with 150s timeout, AbortSignal and strict payload allowlist', async () => {
    mockAxios.post.mockResolvedValueOnce(createWritingHintsEnvelope(validWritingHintsEn));

    const req = {
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
      essay: 'Student essay text that must not be sent',
      answer: 'Draft text',
      extraField: 'should be stripped',
    } as any;

    const result = await generateWritingHints(42, req);

    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    const [url, postBody, postConfig] = mockAxios.post.mock.calls[0];
    expect(url).toBe('/v1/attempts/42/writing-hints');
    expect(postBody).toEqual({
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
    });
    expect(postBody).not.toHaveProperty('essay');
    expect(postBody).not.toHaveProperty('answer');
    expect(postBody).not.toHaveProperty('extraField');
    expect(postConfig.timeout).toBe(150_000);
    expect(postConfig.timeout).toBe(HINTS_TIMEOUT_MS);
    expect(postConfig.signal).toBeInstanceOf(AbortSignal);
    expect(result.attemptId).toBe(42);
    expect(result.partId).toBe(30);
    expect(result.questionId).toBe('writing-task-1');
    expect(result.outline).toHaveLength(4);
    expect(result.vocabulary).toHaveLength(5);
  });

  it('includes canonicalized optional language fields when provided', async () => {
    mockAxios.post.mockResolvedValueOnce(createWritingHintsEnvelope(validWritingHintsVi));

    const req = {
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
      learningLanguage: 'en',
      hintLanguage: 'vi',
    };

    const result = await generateWritingHints(42, req);

    const [, postBody] = mockAxios.post.mock.calls[0];
    expect(postBody).toEqual({
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
      learningLanguage: 'en',
      hintLanguage: 'vi',
    });
    expect(result.hintLanguage).toBe('vi');
  });

  it.each([
    { desc: 'attemptId <= 0', attemptId: 0, req: validWritingHintsRequest },
    { desc: 'attemptId is float', attemptId: 42.5, req: validWritingHintsRequest },
    { desc: 'attemptId is NaN', attemptId: NaN, req: validWritingHintsRequest },
    { desc: 'partId <= 0', attemptId: 42, req: { ...validWritingHintsRequest, partId: 0 } },
    { desc: 'partId is null', attemptId: 42, req: { ...validWritingHintsRequest, partId: null as any } },
    { desc: 'empty questionId', attemptId: 42, req: { ...validWritingHintsRequest, questionId: '' } },
    { desc: 'whitespace-padded questionId', attemptId: 42, req: { ...validWritingHintsRequest, questionId: ' task-1 ' } },
    { desc: 'invalid requestId not UUID', attemptId: 42, req: { ...validWritingHintsRequest, requestId: 'not-a-uuid' } },
    { desc: 'unsupported learningLanguage', attemptId: 42, req: { ...validWritingHintsRequest, learningLanguage: 'unsupported' } },
    { desc: 'unsupported hintLanguage', attemptId: 42, req: { ...validWritingHintsRequest, hintLanguage: 'xyz' } },
  ])('rejects invalid input ($desc) before dispatching HTTP request', async ({ attemptId, req }) => {
    await expect(generateWritingHints(attemptId, req)).rejects.toThrow(WritingHintsContractError);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('rejects malformed response envelope or mismatched identity with WritingHintsContractError', async () => {
    mockAxios.post.mockResolvedValueOnce({
      code: 200,
      data: {
        ...validWritingHintsEn,
        attemptId: 999,
      },
    });

    await expect(generateWritingHints(42, validWritingHintsRequest)).rejects.toThrow(WritingHintsContractError);
  });

  it('rejects when server returns error envelope code', async () => {
    mockAxios.post.mockResolvedValueOnce({
      code: 500,
      message: 'Internal Error',
      data: null,
    });

    await expect(generateWritingHints(42, validWritingHintsRequest)).rejects.toThrow(WritingHintsContractError);
  });

  it.each([400, 401, 403, 404, 409, 413, 422, 429, 500, 502, 503, 504])(
    'preserves HTTP %s rejection for downstream error classification',
    async status => {
      const error = {
        response: {
          status,
          headers: { 'retry-after': '15' },
          data: { code: 1604, message: 'backend detail' },
        },
      };
      mockAxios.post.mockRejectedValueOnce(error);

      await expect(generateWritingHints(42, validWritingHintsRequest)).rejects.toBe(error);
    }
  );

  it('settles at whole-request deadline (150s) even when transport never settles', async () => {
    vi.useFakeTimers();
    mockAxios.post.mockReturnValueOnce(new Promise(() => {}));

    const pending = generateWritingHints(42, validWritingHintsRequest);
    const rejection = expect(pending).rejects.toThrow(/quá thời gian/i);

    await vi.advanceTimersByTimeAsync(149_999);
    expect(mockAxios.post.mock.calls[0][2]?.signal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await rejection;
    expect(mockAxios.post.mock.calls[0][2]?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('aborts waiting, ignores late transport settlement and removes listener/timer', async () => {
    vi.useFakeTimers();
    let resolve!: (value: unknown) => void;
    mockAxios.post.mockReturnValueOnce(new Promise(r => { resolve = r; }));
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, 'removeEventListener');

    const pending = generateWritingHints(42, validWritingHintsRequest, { signal: controller.signal });
    const rejection = expect(pending).rejects.toThrow(/hủy/i);

    controller.abort();
    await rejection;

    resolve(createWritingHintsEnvelope(validWritingHintsEn));
    await Promise.resolve();

    expect(mockAxios.post.mock.calls[0][2].signal.aborted).toBe(true);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('already aborted signal does not dispatch transport', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateWritingHints(42, validWritingHintsRequest, { signal: controller.signal })
    ).rejects.toThrow(/hủy/i);
    expect(mockAxios.post).not.toHaveBeenCalled();
  });

  it('uses immutable captured payload even if caller mutates req during in-flight', async () => {
    mockAxios.post.mockImplementationOnce(async () => {
      mutableReq.partId = 999;
      mutableReq.questionId = 'mutated';
      return createWritingHintsEnvelope(validWritingHintsEn);
    });

    const mutableReq = {
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
    };

    const result = await generateWritingHints(42, mutableReq);
    expect(result.partId).toBe(30);
    expect(result.questionId).toBe('writing-task-1');
  });
});
