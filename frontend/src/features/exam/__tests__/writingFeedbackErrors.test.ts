import { describe, it, expect } from 'vitest';
import {
  classifyWritingFeedbackError,
  mapReasonCodeToMessage,
  ALLOWED_REASON_CODES,
  DEFAULT_SAFE_FEEDBACK_MESSAGE,
  REFRESH_WARNING_MESSAGE,
} from '../utils/writingFeedbackErrors';
import { WritingFeedbackContractError } from '../api/writingFeedbackContract';

describe('writingFeedbackErrors', () => {
  describe('mapReasonCodeToMessage', () => {
    it('maps all allowed reason codes to safe Vietnamese messages', () => {
      expect(ALLOWED_REASON_CODES.size).toBe(15);
      for (const code of ALLOWED_REASON_CODES) {
        const msg = mapReasonCodeToMessage(code);
        expect(typeof msg).toBe('string');
        expect(msg.length).toBeGreaterThan(0);
        expect(msg).not.toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
        // Ensure no raw English code leak
        expect(msg).not.toContain(code);
      }
    });

    it('maps unknown, null, or undefined reason codes to safe default message', () => {
      expect(mapReasonCodeToMessage(null)).toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
      expect(mapReasonCodeToMessage(undefined)).toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
      expect(mapReasonCodeToMessage('')).toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
      expect(mapReasonCodeToMessage('INVENTED_CODE')).toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
      expect(mapReasonCodeToMessage('http://evil.com/leak')).toBe(DEFAULT_SAFE_FEEDBACK_MESSAGE);
    });
  });

  describe('classifyWritingFeedbackError', () => {
    it('classifies WritingFeedbackContractError as non-transient contract error', () => {
      const err = new WritingFeedbackContractError('Malformed data');
      const classified = classifyWritingFeedbackError(err);
      expect(classified.kind).toBe('contract');
      expect(classified.isTransient).toBe(false);
      expect(classified.message).not.toContain('Malformed data');
      expect(classified.message).toMatch(/cấu trúc/i);
    });

    it.each([
      [401, 'unauthorized', false, /đăng nhập/i],
      [403, 'forbidden', false, /quyền/i],
      [404, 'not_found', false, /không tìm thấy/i],
      [400, 'invalid_request', false, /không hợp lệ/i],
      [422, 'invalid_request', false, /không hợp lệ/i],
      [500, 'server', true, /sự cố/i],
      [502, 'server', true, /sự cố/i],
      [503, 'server', true, /sự cố/i],
    ] as const)('classifies HTTP %i as kind %s (transient: %s)', (status, kind, isTransient, messageRegex) => {
      const axiosError = {
        isAxiosError: true,
        response: {
          status,
          data: { message: 'SECRET_INTERNAL_DB_ERROR', stackTrace: 'leak' },
        },
      };
      const classified = classifyWritingFeedbackError(axiosError);
      expect(classified.kind).toBe(kind);
      expect(classified.status).toBe(status);
      expect(classified.isTransient).toBe(isTransient);
      expect(classified.message).toMatch(messageRegex);
      expect(classified.message).not.toContain('SECRET_INTERNAL_DB_ERROR');
      expect(classified.message).not.toContain('leak');
    });

    it('classifies timeout errors as transient timeout', () => {
      const timeoutErr = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };
      const classified = classifyWritingFeedbackError(timeoutErr);
      expect(classified.kind).toBe('timeout');
      expect(classified.isTransient).toBe(true);
      expect(classified.message).toMatch(/quá thời gian/i);
    });

    it('classifies network failure without response as transient network error', () => {
      const networkErr = {
        isAxiosError: true,
        message: 'Network Error',
      };
      const classified = classifyWritingFeedbackError(networkErr);
      expect(classified.kind).toBe('network');
      expect(classified.isTransient).toBe(true);
      expect(classified.message).toMatch(/kết nối mạng/i);
    });

    it('classifies canceled/aborted errors', () => {
      const abortErr = { code: 'ERR_CANCELED' };
      const classified = classifyWritingFeedbackError(abortErr);
      expect(classified.isTransient).toBe(true);
      expect(classified.message).toMatch(/đã bị hủy/i);
    });

    it('classifies generic unknown errors safely without leaking message', () => {
      const secretErr = new Error('SQLSTATE[HY000]: General error: database leak');
      const classified = classifyWritingFeedbackError(secretErr);
      expect(classified.kind).toBe('unknown');
      expect(classified.isTransient).toBe(true);
      expect(classified.message).not.toContain('SQLSTATE');
      expect(classified.message).not.toContain('database leak');
    });
  });

  it('provides a static refresh warning message', () => {
    expect(REFRESH_WARNING_MESSAGE).toMatch(/Chưa thể cập nhật/i);
  });

  it.each(['timeout', 'Yêu cầu quá thời gian', 'Network Error', 'aborted', 'canceled', 'Yêu cầu đã bị hủy'])(
    'R3: raw message %s cannot determine classification', (message) => {
      expect(classifyWritingFeedbackError(new Error(message)))
        .toEqual(classifyWritingFeedbackError(new Error('Unrecognized failure')));
    }
  );

  it.each([
    ['ECONNABORTED', 'timeout'], ['ETIMEDOUT', 'timeout'],
    ['ERR_NETWORK', 'network'], ['ERR_CANCELED', 'unknown'],
  ])('R3: uses code %s without reading message', (code, kind) => {
    const error = {
      code,
      get message(): never { throw new Error('Raw message must not be read'); },
    };
    expect(classifyWritingFeedbackError(error).kind).toBe(kind);
  });

});
