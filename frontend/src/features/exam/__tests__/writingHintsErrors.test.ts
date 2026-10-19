import { describe, it, expect } from 'vitest';
import { AxiosHeaders } from 'axios';
import { classifyWritingHintsError } from '../utils/writingHintsErrors';
import { WritingHintsContractError } from '../api/writingHintsContract';

describe('writingHintsErrors - classifyWritingHintsError', () => {
  const nowMs = 1700000000000;

  describe('HTTP 409 variants', () => {
    it('classifies code 1604 as pending with Retry-After header', () => {
      const error = {
        response: {
          status: 409,
          data: { code: 1604, message: 'Yêu cầu đang xử lý' },
          headers: { 'retry-after': '25' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'pending',
        action: 'retry',
        retryAt: nowMs + 25000,
        message: expect.any(String),
      });
      expect(result.message).not.toContain('Yêu cầu đang xử lý');
    });

    it('classifies code 1604 as pending with default 10s backoff when Retry-After is missing or invalid', () => {
      const errorMissingHeader = {
        response: {
          status: 409,
          data: { code: 1604 },
        },
      };
      const result1 = classifyWritingHintsError(errorMissingHeader, nowMs);
      expect(result1.kind).toBe('pending');
      expect(result1.action).toBe('retry');
      expect(result1.retryAt).toBe(nowMs + 10000);

      const errorInvalidHeader = {
        response: {
          status: 409,
          data: { code: 1604 },
          headers: { 'retry-after': 'invalid' },
        },
      };
      const result2 = classifyWritingHintsError(errorInvalidHeader, nowMs);
      expect(result2.retryAt).toBe(nowMs + 10000);
    });

    it('classifies code 1605 as conflict requiring reload', () => {
      const error = {
        response: {
          status: 409,
          data: { code: 1605, message: 'Conflict payload' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'conflict',
        action: 'reload',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).not.toContain('Conflict payload');
    });

    it('classifies other 409 (e.g. submitted or expired attempt) as ended requiring reload', () => {
      const errorSubmitted = {
        response: {
          status: 409,
          data: { code: 409, message: 'Attempt submitted' },
        },
      };
      const result1 = classifyWritingHintsError(errorSubmitted, nowMs);
      expect(result1.kind).toBe('ended');
      expect(result1.action).toBe('reload');
      expect(result1.retryAt).toBeNull();

      const errorUnspecified = {
        response: {
          status: 409,
        },
      };
      const result2 = classifyWritingHintsError(errorUnspecified, nowMs);
      expect(result2.kind).toBe('ended');
      expect(result2.action).toBe('reload');
    });
  });

  describe('HTTP 429 variants', () => {
    it('classifies code 1606 as rate-limited with parsed Retry-After header', () => {
      const error = {
        response: {
          status: 429,
          data: { code: 1606 },
          headers: { 'retry-after': '8' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'rate-limited',
        action: 'none',
        retryAt: nowMs + 8000,
        message: expect.any(String),
      });
    });

    it('classifies code 1606 as rate-limited with 10s fallback when Retry-After is absent', () => {
      const error = {
        response: {
          status: 429,
          data: { code: 1606 },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result.kind).toBe('rate-limited');
      expect(result.action).toBe('none');
      expect(result.retryAt).toBe(nowMs + 10000);
    });

    it('classifies quota exceeded (code 429) as quota with no countdown and action none', () => {
      const errorQuota = {
        response: {
          status: 429,
          data: { code: 429, message: 'Hết quota' },
        },
      };
      const result = classifyWritingHintsError(errorQuota, nowMs);
      expect(result).toEqual({
        kind: 'quota',
        action: 'none',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).not.toContain('Hết quota');
    });

    it('classifies HTTP 429 without code 1606 as quota', () => {
      const errorPlain429 = {
        response: {
          status: 429,
        },
      };
      const result = classifyWritingHintsError(errorPlain429, nowMs);
      expect(result.kind).toBe('quota');
      expect(result.action).toBe('none');
      expect(result.retryAt).toBeNull();
    });
  });

  describe('HTTP 422 variants', () => {
    it('classifies code 1607 and 1608 as language error with change-language action', () => {
      const error1607 = {
        response: {
          status: 422,
          data: { code: 1607, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result1 = classifyWritingHintsError(error1607, nowMs);
      expect(result1).toEqual({
        kind: 'language',
        action: 'change-language',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result1.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');

      const error1608 = {
        response: {
          status: 422,
          data: { code: 1608, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result2 = classifyWritingHintsError(error1608, nowMs);
      expect(result2.kind).toBe('language');
      expect(result2.action).toBe('change-language');
      expect(result2.retryAt).toBeNull();
      expect(result2.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');
    });

    it('classifies code 1609 as context error requiring reload', () => {
      const error = {
        response: {
          status: 422,
          data: { code: 1609, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).toContain('tải lại');
      expect(result.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');
    });

    it('classifies other 422 validation errors as context error', () => {
      const error = {
        response: {
          status: 422,
          data: { code: 422, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result.kind).toBe('context');
      expect(result.action).toBe('reload');
      expect(result.retryAt).toBeNull();
      expect(result.message).toContain('tải lại');
      expect(result.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');
    });
  });

  describe('HTTP 404 and 413', () => {
    it('classifies 404 as context error with reload action', () => {
      const error = {
        response: {
          status: 404,
          data: { code: 404, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).toContain('tải lại');
      expect(result.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');
    });

    it('classifies 413 as context error requiring reload', () => {
      const error = {
        response: {
          status: 413,
          data: { code: 1611, message: 'BACKEND_SENTINEL_STACK_TOKEN' },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'context',
        action: 'reload',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).toContain('tải lại');
      expect(result.message).not.toContain('BACKEND_SENTINEL_STACK_TOKEN');
    });
  });

  describe('HTTP 401 and 403 access control', () => {
    it('classifies 401 and 403 as access error with action none', () => {
      const error401 = { response: { status: 401 } };
      const result1 = classifyWritingHintsError(error401, nowMs);
      expect(result1).toEqual({
        kind: 'access',
        action: 'none',
        retryAt: null,
        message: expect.any(String),
      });

      const error403 = { response: { status: 403 } };
      const result2 = classifyWritingHintsError(error403, nowMs);
      expect(result2.kind).toBe('access');
      expect(result2.action).toBe('none');
    });
  });

  describe('HTTP 502, 503, 504 and network errors', () => {
    it.each([502, 503, 504])('classifies status %s as request error with retry action', (status) => {
      const error = { response: { status } };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result).toEqual({
        kind: 'request',
        action: 'retry',
        retryAt: null,
        message: expect.any(String),
      });
    });

    it('classifies timeout and abort errors as request error', () => {
      const timeoutError = new Error('Yêu cầu quá thời gian. Vui lòng thử lại.');
      const result1 = classifyWritingHintsError(timeoutError, nowMs);
      expect(result1.kind).toBe('request');
      expect(result1.action).toBe('retry');

      const abortError = new Error('Yêu cầu đã bị hủy');
      const result2 = classifyWritingHintsError(abortError, nowMs);
      expect(result2.kind).toBe('request');
      expect(result2.action).toBe('retry');
    });

    it('classifies generic network errors as request error', () => {
      const networkError = new Error('Network Error');
      const result = classifyWritingHintsError(networkError, nowMs);
      expect(result.kind).toBe('request');
      expect(result.action).toBe('retry');
      expect(result.message).not.toContain('Network Error');
    });
  });

  describe('Frontend contract errors', () => {
    it('classifies WritingHintsContractError as contract error with retry action', () => {
      const contractError = new WritingHintsContractError('Corrupted data');
      const result = classifyWritingHintsError(contractError, nowMs);
      expect(result).toEqual({
        kind: 'contract',
        action: 'retry',
        retryAt: null,
        message: expect.any(String),
      });
      expect(result.message).not.toContain('Corrupted data');
    });
  });

  describe('Header parsing robustness', () => {
    it('parses a real AxiosHeaders object', () => {
      const error = {
        response: {
          status: 409,
          data: { code: 1604 },
          headers: new AxiosHeaders({ 'Retry-After': '15' }),
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result.retryAt).toBe(nowMs + 15000);
    });

    it('parses numeric Retry-After header', () => {
      const error = {
        response: {
          status: 429,
          data: { code: 1606 },
          headers: { 'retry-after': 20 },
        },
      };
      const result = classifyWritingHintsError(error, nowMs);
      expect(result.retryAt).toBe(nowMs + 20000);
    });

    describe.each([
      { name: 'plain string headers', headers: (seconds: number) => ({ 'Retry-After': String(seconds) }) },
      { name: 'plain numeric headers', headers: (seconds: number) => ({ 'retry-after': seconds }) },
      { name: 'AxiosHeaders', headers: (seconds: number) => new AxiosHeaders({ 'Retry-After': String(seconds) }) },
    ])('$name', ({ headers }) => {
      it.each([
        [3600, 1700003600000],
        [3601, 1700003601000],
        [7200, 1700007200000],
        [999999, 1700999999000],
        // Largest whole-second delay whose millisecond sum is safe for this nowMs.
        [9005499254740, 9007199254740000],
      ])('preserves server delay %s seconds for pending and cooldown', (seconds, retryAt) => {
        for (const [status, code, kind, action] of [
          [409, 1604, 'pending', 'retry'],
          [429, 1606, 'rate-limited', 'none'],
        ] as const) {
          const result = classifyWritingHintsError({
            response: { status, data: { code }, headers: headers(seconds) },
          }, nowMs);
          expect(result).toEqual({ kind, action, retryAt, message: expect.any(String) });
        }
      });
    });

    it.each([
      undefined, null, '-5', -5, 'invalid', '1.5', 1.5, '15seconds',
      Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_VALUE,
      '9007199254740992', Number.MAX_SAFE_INTEGER,
      // Safe seconds, but overflow when multiplying to milliseconds.
      '9007199254741', 9007199254741,
      // Safe seconds/milliseconds, but overflow after adding nowMs.
      '9005499254741', 9005499254741,
    ])('uses 10s fallback for missing/malformed/unsafe Retry-After %s', (value) => {
      for (const headers of [
        { 'Retry-After': value },
        new AxiosHeaders(value == null ? {} : { 'Retry-After': String(value) }),
      ]) {
        for (const [status, code] of [[409, 1604], [429, 1606]]) {
          const result = classifyWritingHintsError({
            response: { status, data: { code }, headers },
          }, nowMs);
          expect(result.retryAt).toBe(1700000010000);
        }
      }
    });
  });
});
