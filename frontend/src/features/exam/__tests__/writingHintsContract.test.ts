import { describe, it, expect } from 'vitest';
import {
  createWritingHintsRequestId,
  validateWritingHintsRequest,
  normalizeWritingHints,
  WritingHintsContractError,
  canonicalizeLanguageTag,
} from '../api/writingHintsContract';
import type { WritingHintsRequest } from '../types/api.types';
import {
  validWritingHintsEn,
  validWritingHintsVi,
  validWritingHintsFr,
  validWritingHintsRequest,
  VALID_REQUEST_ID,
  createWritingHintsEnvelope,
} from './fixtures/writingHints';

// Body checks still pass through the real public success-envelope gate.
function normalizeResponse(data: unknown, expected: Parameters<typeof normalizeWritingHints>[1]) {
  return normalizeWritingHints(createWritingHintsEnvelope(data), expected);
}

describe('review regressions for TV3-19-01', () => {
  const identity = { attemptId: 42, partId: 30, questionId: 'writing-task-1', requestId: VALID_REQUEST_ID };
  const explicit = { ...identity, learningLanguage: 'en', hintLanguage: 'vi' };

  it.each([['it', 'it'], ['pt-br', 'pt-BR']])('accepts backend-resolved %s without a frontend catalog label', (language, canonical) => {
    const response = { ...validWritingHintsEn, learningLanguage: language, hintLanguage: language };
    const result = normalizeResponse(response, identity);
    expect(result.learningLanguage).toBe(canonical);
    expect(result.hintLanguage).toBe(canonical);
  });

  it('still rejects configured backend languages that differ from explicit selections', () => {
    expect(() => normalizeResponse({ ...validWritingHintsEn, learningLanguage: 'it', hintLanguage: 'it' }, explicit))
      .toThrow(WritingHintsContractError);
    expect(() => normalizeResponse({ ...validWritingHintsEn, hintLanguage: 'pt-BR' }, explicit))
      .toThrow(WritingHintsContractError);
  });

  it.each([
    { ...identity, learningLanguage: 'en' },
    identity,
    { ...identity, learningLanguage: null, hintLanguage: null },
  ])('rejects mismatched implicit hint language for expected %j', expected => {
    expect(() => normalizeResponse(validWritingHintsVi, expected)).toThrow(WritingHintsContractError);
    expect(normalizeResponse(validWritingHintsEn, expected).hintLanguage).toBe('en');
  });

  it('preserves an explicit cross-language hint override', () => {
    expect(normalizeResponse(validWritingHintsVi, explicit).hintLanguage).toBe('vi');
  });

  it.each(['en-US-US', 'zh-Hant-Hans', 'en-US-Latn', 'en-123-456'])(
    'rejects malformed script/region sequence %s in requests', language => {
      for (const field of ['learningLanguage', 'hintLanguage']) {
        expect(() => validateWritingHintsRequest(42, { ...validWritingHintsRequest, [field]: language }))
          .toThrow(WritingHintsContractError);
      }
    }
  );

  it.each(['en-US-US', 'zh-Hant-Hans', 'en-US-Latn', 'en-123-456', 'it--IT'])(
    'rejects malformed response language %s', language => {
      expect(() => normalizeResponse({ ...validWritingHintsEn, learningLanguage: language, hintLanguage: language }, identity))
        .toThrow(WritingHintsContractError);
    }
  );

  it.each([
    ['fr-ca', 'fr-CA'], ['zh-hant', 'zh-Hant'], ['zh-hans-cn', 'zh-Hans-CN'], ['es-419', 'es-419'],
  ])('keeps canonical valid script/region %s as %s', (input, canonical) => {
    const request = validateWritingHintsRequest(42, { ...validWritingHintsRequest, learningLanguage: input, hintLanguage: input });
    expect(request.learningLanguage).toBe(canonical);
    expect(request.hintLanguage).toBe(canonical);
    const result = normalizeResponse({ ...validWritingHintsEn, learningLanguage: input, hintLanguage: input }, { ...request, attemptId: 42 });
    expect(result.learningLanguage).toBe(canonical);
    expect(result.hintLanguage).toBe(canonical);
    expect(canonicalizeLanguageTag(canonical)).toBe(canonical);
  });

  it.each([403, '200', '403', null, undefined])('rejects envelope code %j even with valid-looking data', code => {
    expect(() => normalizeWritingHints({ code, data: validWritingHintsVi }, explicit)).toThrow(WritingHintsContractError);
  });

  it.each([
    { data: validWritingHintsVi }, { code: 200 }, { code: 200, data: null }, { code: 200, data: [] },
    validWritingHintsVi,
  ])('rejects missing envelope/code or non-object data: %j', envelope => {
    expect(() => normalizeWritingHints(envelope, explicit)).toThrow(WritingHintsContractError);
  });

  it.each([
    '2026-02-30T00:00:00Z', '2025-02-29T00:00:00Z', '1900-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z', '2026-10-13T24:00:00Z', '2026-10-13T00:60:00Z',
    '2026-10-13T00:00:60Z', '2026-10-13T00:00:00+24:00', '2026-10-13T00:00:00+07:60',
  ])('rejects impossible calendar/time components: %s', generatedAt => {
    expect(() => normalizeResponse({ ...validWritingHintsVi, generatedAt }, explicit)).toThrow(WritingHintsContractError);
  });

  it.each([
    '2024-02-29T23:59:59Z', '2000-02-29T00:00:00Z', '2026-10-13T07:00:00.123456789+07:00',
    '2026-10-13T07:00:00.5-03:30',
  ])('preserves valid leap date, fractional seconds and timezone: %s', generatedAt => {
    expect(normalizeResponse({ ...validWritingHintsVi, generatedAt }, explicit).generatedAt).toBe(generatedAt);
  });

  it.each(['\u001c', '\u001d', '\u001e', '\u001f', '\u00a0', '\u2028', '\u202f'])(
    'rejects Java whitespace at either question ID edge: %j', whitespace => {
      for (const questionId of [whitespace + 'task', 'task' + whitespace]) {
        expect(() => validateWritingHintsRequest(42, { ...validWritingHintsRequest, questionId }))
          .toThrow(WritingHintsContractError);
      }
    }
  );

  it('keeps Unicode IDs verbatim and measures the 128 limit in UTF-16 code units', () => {
    for (const questionId of ['câu-hỏi-作文-📝', '📝'.repeat(64), 'task\u001cinside', '\ufefftask\ufeff']) {
      expect(validateWritingHintsRequest(42, { ...validWritingHintsRequest, questionId }).questionId).toBe(questionId);
    }
    expect(() => validateWritingHintsRequest(42, { ...validWritingHintsRequest, questionId: '📝'.repeat(65) }))
      .toThrow(WritingHintsContractError);
  });

  it('uses Vietnamese terms and examples aligned with the TV3-18 localized fixture', () => {
    const result = normalizeResponse(validWritingHintsVi, explicit);
    expect(result.vocabulary.map(item => [item.term, item.example])).toEqual([
      ['tăng trưởng', 'Sản lượng điện mặt trời có xu hướng tăng trưởng.'],
      ['ổn định', 'Sản lượng thủy điện duy trì ổn định.'],
      ['dao động', 'Sản lượng điện gió có thể dao động qua các năm.'],
      ['tỷ trọng', 'Cần đối chiếu tỷ trọng của các nguồn năng lượng.'],
      ['chênh lệch', 'Người học cần xác định chênh lệch trên biểu đồ.'],
    ]);
  });

  it.each([validWritingHintsEn, validWritingHintsVi, validWritingHintsFr])(
    'preserves every generated field in the localized $hintLanguage fixture', fixture => {
      const result = normalizeResponse(fixture, { ...identity, learningLanguage: fixture.learningLanguage, hintLanguage: fixture.hintLanguage });
      expect(result.outline).toEqual(fixture.outline);
      expect(result.vocabulary).toEqual(fixture.vocabulary);
      expect(result.limitations).toEqual(fixture.limitations);
    }
  );

  it('accepts ten unique vocabulary items at the upper bound', () => {
    const vocabulary = Array.from({ length: 10 }, (_, index) => ({
      term: `term-${index}`, definition: 'Definition', explanation: 'Explanation', example: 'Example',
    }));
    expect(normalizeResponse({ ...validWritingHintsVi, vocabulary }, explicit).vocabulary).toEqual(vocabulary);
  });
});

describe('writingHintsContract', () => {
  describe('createWritingHintsRequestId', () => {
    it('creates a standard lowercase RFC 4122 UUID v4', () => {
      const id = createWritingHintsRequestId();
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('generates unique IDs across calls', () => {
      const id1 = createWritingHintsRequestId();
      const id2 = createWritingHintsRequestId();
      expect(id1).not.toBe(id2);
    });

    it('throws WritingHintsContractError if Web Crypto is unavailable', () => {
      const originalCrypto = globalThis.crypto;
      try {
        // @ts-expect-error simulating missing crypto
        delete globalThis.crypto;
        expect(() => createWritingHintsRequestId()).toThrow(WritingHintsContractError);
      } finally {
        globalThis.crypto = originalCrypto;
      }
    });
  });

  describe('canonicalizeLanguageTag', () => {
    it('canonicalizes 8 base languages', () => {
      expect(canonicalizeLanguageTag('en')).toBe('en');
      expect(canonicalizeLanguageTag('vi')).toBe('vi');
      expect(canonicalizeLanguageTag('ko')).toBe('ko');
      expect(canonicalizeLanguageTag('zh')).toBe('zh');
      expect(canonicalizeLanguageTag('ja')).toBe('ja');
      expect(canonicalizeLanguageTag('fr')).toBe('fr');
      expect(canonicalizeLanguageTag('de')).toBe('de');
      expect(canonicalizeLanguageTag('es')).toBe('es');
    });

    it('maps ISO 639-3 aliases to canonical 2-letter tags', () => {
      expect(canonicalizeLanguageTag('eng')).toBe('en');
      expect(canonicalizeLanguageTag('vie')).toBe('vi');
      expect(canonicalizeLanguageTag('fra')).toBe('fr');
      expect(canonicalizeLanguageTag('fre')).toBeNull();
      expect(canonicalizeLanguageTag('deu')).toBe('de');
      expect(canonicalizeLanguageTag('ger')).toBeNull();
      expect(canonicalizeLanguageTag('spa')).toBe('es');
      expect(canonicalizeLanguageTag('kor')).toBe('ko');
      expect(canonicalizeLanguageTag('zho')).toBe('zh');
      expect(canonicalizeLanguageTag('chi')).toBeNull();
      expect(canonicalizeLanguageTag('jpn')).toBe('ja');
    });

    it('preserves valid region and script sub-tags', () => {
      expect(canonicalizeLanguageTag('fr-CA')).toBe('fr-CA');
      expect(canonicalizeLanguageTag('zh-Hant')).toBe('zh-Hant');
      expect(canonicalizeLanguageTag('en-US')).toBe('en-US');
      expect(canonicalizeLanguageTag('es-ES')).toBe('es-ES');
      expect(canonicalizeLanguageTag('zh-Hans-CN')).toBe('zh-Hans-CN');
    });

    it('rejects unsupported or malformed language tags', () => {
      expect(canonicalizeLanguageTag('ru')).toBeNull();
      expect(canonicalizeLanguageTag('ar')).toBeNull();
      expect(canonicalizeLanguageTag('')).toBeNull();
      expect(canonicalizeLanguageTag('   ')).toBeNull();
      expect(canonicalizeLanguageTag('en_US')).toBeNull();
      expect(canonicalizeLanguageTag('*')).toBeNull();
      expect(canonicalizeLanguageTag('und')).toBeNull();
      expect(canonicalizeLanguageTag('x-custom')).toBeNull();
      expect(canonicalizeLanguageTag('en--US')).toBeNull();
      expect(canonicalizeLanguageTag('-en')).toBeNull();
      expect(canonicalizeLanguageTag('en-')).toBeNull();
    });
  });

  describe('validateWritingHintsRequest', () => {
    const validAttemptId = 42;

    it('accepts and returns frozen valid request', () => {
      const validated = validateWritingHintsRequest(validAttemptId, validWritingHintsRequest);
      expect(validated).toEqual(validWritingHintsRequest);
      expect(Object.isFrozen(validated)).toBe(true);
    });

    it('normalizes uppercase UUID in requestId to lowercase', () => {
      const upperReq: WritingHintsRequest = {
        ...validWritingHintsRequest,
        requestId: VALID_REQUEST_ID.toUpperCase(),
      };
      const validated = validateWritingHintsRequest(validAttemptId, upperReq);
      expect(validated.requestId).toBe(VALID_REQUEST_ID.toLowerCase());
    });

    it('accepts null or undefined optional languages', () => {
      const minimalReq: WritingHintsRequest = {
        partId: 30,
        questionId: 'w-1',
        requestId: VALID_REQUEST_ID,
      };
      const validated = validateWritingHintsRequest(validAttemptId, minimalReq);
      expect(validated.learningLanguage).toBeUndefined();
      expect(validated.hintLanguage).toBeUndefined();

      const nullLangReq: WritingHintsRequest = {
        partId: 30,
        questionId: 'w-1',
        requestId: VALID_REQUEST_ID,
        learningLanguage: null,
        hintLanguage: null,
      };
      const validatedNull = validateWritingHintsRequest(validAttemptId, nullLangReq);
      expect(validatedNull.learningLanguage).toBeUndefined();
      expect(validatedNull.hintLanguage).toBeUndefined();
    });

    it('rejects invalid attemptId boundaries', () => {
      expect(() => validateWritingHintsRequest(0, validWritingHintsRequest)).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(-1, validWritingHintsRequest)).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(1.5, validWritingHintsRequest)).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(NaN, validWritingHintsRequest)).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(2147483648, validWritingHintsRequest)).toThrow(WritingHintsContractError);
      // @ts-expect-error invalid type
      expect(() => validateWritingHintsRequest('42', validWritingHintsRequest)).toThrow(WritingHintsContractError);
    });

    it('rejects invalid partId boundaries', () => {
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, partId: 0 })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, partId: -5 })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, partId: 2.7 })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, partId: 2147483648 })).toThrow(WritingHintsContractError);
    });

    it('rejects invalid questionId boundaries and whitespace', () => {
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: '' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: '   ' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: ' task-1' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: 'task-1 ' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: 'a'.repeat(129) })).toThrow(WritingHintsContractError);
      // Exactly 128 characters is valid
      const exact128 = 'a'.repeat(128);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, questionId: exact128 })).not.toThrow();
    });

    it('rejects invalid requestId UUID formats', () => {
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, requestId: '' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, requestId: 'not-a-uuid' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, requestId: '12345678-1234-1234-1234-12345678901' })).toThrow(WritingHintsContractError);
    });

    it('rejects invalid or blank optional languages', () => {
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, learningLanguage: '' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, learningLanguage: '   ' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, learningLanguage: 'unsupported-lang' })).toThrow(WritingHintsContractError);
      expect(() => validateWritingHintsRequest(validAttemptId, { ...validWritingHintsRequest, hintLanguage: 'xx' })).toThrow(WritingHintsContractError);
    });

    it('does not mutate the original request object', () => {
      const original: WritingHintsRequest = { ...validWritingHintsRequest };
      validateWritingHintsRequest(validAttemptId, original);
      expect(original).toEqual(validWritingHintsRequest);
    });
  });

  describe('normalizeWritingHints', () => {
    const expected = {
      attemptId: 42,
      partId: 30,
      questionId: 'writing-task-1',
      requestId: VALID_REQUEST_ID,
      learningLanguage: 'en',
      hintLanguage: 'vi',
    };

    it('normalizes a successful envelope and preserves public data', () => {
      const normalizedDirect = normalizeResponse(validWritingHintsVi, expected);
      expect(normalizedDirect).toMatchObject({
        attemptId: 42,
        partId: 30,
        questionId: 'writing-task-1',
        requestId: VALID_REQUEST_ID,
        learningLanguage: 'en',
        hintLanguage: 'vi',
      });
      expect(normalizedDirect.outline).toHaveLength(2);
      expect(normalizedDirect.vocabulary).toHaveLength(5);
      expect(normalizedDirect.limitations).toHaveLength(1);

      const envelope = createWritingHintsEnvelope(validWritingHintsVi);
      const normalizedEnvelope = normalizeWritingHints(envelope, expected);
      expect(normalizedEnvelope).toEqual(normalizedDirect);
    });

    it('normalizes English and French localized fixtures correctly', () => {
      const expectedEn = {
        ...expected,
        learningLanguage: 'en',
        hintLanguage: 'en',
      };
      const normalizedEn = normalizeResponse(validWritingHintsEn, expectedEn);
      expect(normalizedEn.hintLanguage).toBe('en');

      const expectedFr = {
        ...expected,
        learningLanguage: 'fr',
        hintLanguage: 'fr',
      };
      const normalizedFr = normalizeResponse(validWritingHintsFr, expectedFr);
      expect(normalizedFr.learningLanguage).toBe('fr');
      expect(normalizedFr.hintLanguage).toBe('fr');
    });

    it('handles canonicalization of alias tags in response', () => {
      const withAliases = {
        ...validWritingHintsVi,
        learningLanguage: 'eng',
        hintLanguage: 'vie',
      };
      const normalized = normalizeResponse(withAliases, expected);
      expect(normalized.learningLanguage).toBe('en');
      expect(normalized.hintLanguage).toBe('vi');
    });

    it('preserves region and script tags in response', () => {
      const withRegion = {
        ...validWritingHintsFr,
        learningLanguage: 'fr-CA',
        hintLanguage: 'fr-CA',
      };
      const expectedRegion = {
        ...expected,
        learningLanguage: 'fr-CA',
        hintLanguage: 'fr-CA',
      };
      const normalized = normalizeResponse(withRegion, expectedRegion);
      expect(normalized.learningLanguage).toBe('fr-CA');
      expect(normalized.hintLanguage).toBe('fr-CA');
    });

    it('defaults hintLanguage to learningLanguage if expected hintLanguage was omitted', () => {
      const expectedWithoutHintLang = {
        attemptId: 42,
        partId: 30,
        questionId: 'writing-task-1',
        requestId: VALID_REQUEST_ID,
        learningLanguage: 'en',
      };
      const response = {
        ...validWritingHintsEn,
        learningLanguage: 'en',
        hintLanguage: 'en',
      };
      const normalized = normalizeResponse(response, expectedWithoutHintLang);
      expect(normalized.hintLanguage).toBe('en');
    });

    it('rejects identity mismatches', () => {
      expect(() => normalizeResponse({ ...validWritingHintsVi, attemptId: 999 }, expected)).toThrow(WritingHintsContractError);
      expect(() => normalizeResponse({ ...validWritingHintsVi, partId: 999 }, expected)).toThrow(WritingHintsContractError);
      expect(() => normalizeResponse({ ...validWritingHintsVi, questionId: 'other-q' }, expected)).toThrow(WritingHintsContractError);
      expect(() => normalizeResponse({ ...validWritingHintsVi, requestId: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e' }, expected)).toThrow(WritingHintsContractError);
    });

    it('rejects language mismatches when expected languages are specified', () => {
      expect(() => normalizeResponse({ ...validWritingHintsVi, learningLanguage: 'fr' }, expected)).toThrow(WritingHintsContractError);
      expect(() => normalizeResponse({ ...validWritingHintsVi, hintLanguage: 'fr' }, expected)).toThrow(WritingHintsContractError);
    });

    it('rejects invalid ISO-8601 generatedAt', () => {
      expect(() => normalizeResponse({ ...validWritingHintsVi, generatedAt: 'invalid-date' }, expected)).toThrow(WritingHintsContractError);
      expect(() => normalizeResponse({ ...validWritingHintsVi, generatedAt: '2026-10-13 07:00:00' }, expected)).toThrow(WritingHintsContractError);
    });

    it('validates outline section count boundaries (2 to 8 sections)', () => {
      // 1 section is rejected (< 2)
      const oneSection = {
        ...validWritingHintsVi,
        outline: [validWritingHintsVi.outline[0]],
      };
      expect(() => normalizeResponse(oneSection, expected)).toThrow(WritingHintsContractError);

      // 9 sections is rejected (> 8)
      const nineSections = {
        ...validWritingHintsVi,
        outline: Array.from({ length: 9 }, (_, i) => ({
          title: `Section ${i + 1}`,
          points: ['Point 1'],
        })),
      };
      expect(() => normalizeResponse(nineSections, expected)).toThrow(WritingHintsContractError);
    });

    it('validates outline points count boundaries (1 to 6 points)', () => {
      // 0 points is rejected (< 1)
      const zeroPoints = {
        ...validWritingHintsVi,
        outline: [
          { title: 'Intro', points: [] },
          { title: 'Body', points: ['Point 1'] },
        ],
      };
      expect(() => normalizeResponse(zeroPoints, expected)).toThrow(WritingHintsContractError);

      // 7 points is rejected (> 6)
      const sevenPoints = {
        ...validWritingHintsVi,
        outline: [
          { title: 'Intro', points: Array.from({ length: 7 }, (_, i) => `Point ${i + 1}`) },
          { title: 'Body', points: ['Point 1'] },
        ],
      };
      expect(() => normalizeResponse(sevenPoints, expected)).toThrow(WritingHintsContractError);
    });

    it('validates outline text length boundaries (title <= 200, point <= 1000)', () => {
      const longTitle = {
        ...validWritingHintsVi,
        outline: [
          { title: 'x'.repeat(201), points: ['Valid point'] },
          { title: 'Body', points: ['Valid point'] },
        ],
      };
      expect(() => normalizeResponse(longTitle, expected)).toThrow(WritingHintsContractError);

      const longPoint = {
        ...validWritingHintsVi,
        outline: [
          { title: 'Intro', points: ['x'.repeat(1001)] },
          { title: 'Body', points: ['Valid point'] },
        ],
      };
      expect(() => normalizeResponse(longPoint, expected)).toThrow(WritingHintsContractError);
    });

    it('validates vocabulary item count boundaries (5 to 10 items; rejects 4 or 11)', () => {
      // 4 items is rejected (< 5)
      const fourItems = {
        ...validWritingHintsVi,
        vocabulary: validWritingHintsVi.vocabulary.slice(0, 4),
      };
      expect(() => normalizeResponse(fourItems, expected)).toThrow(WritingHintsContractError);

      // 11 items is rejected (> 10)
      const elevenItems = {
        ...validWritingHintsVi,
        vocabulary: Array.from({ length: 11 }, (_, i) => ({
          term: `term-${i + 1}`,
          definition: 'Definition',
          explanation: 'Explanation',
          example: 'Example',
        })),
      };
      expect(() => normalizeResponse(elevenItems, expected)).toThrow(WritingHintsContractError);
    });

    it('rejects duplicate vocabulary terms (case-insensitive and trimmed)', () => {
      const duplicateTerms = {
        ...validWritingHintsVi,
        vocabulary: [
          ...validWritingHintsVi.vocabulary.slice(0, 4),
          {
            term: ' TĂNG TRƯỞNG ', // duplicate after trim/case-fold
            definition: 'Another definition',
            explanation: 'Another explanation',
            example: 'Another example',
          },
        ],
      };
      expect(() => normalizeResponse(duplicateTerms, expected)).toThrow(WritingHintsContractError);
    });

    it('validates vocabulary text length boundaries (term <= 200, def/exp <= 1000, ex <= 2000)', () => {
      const longTerm = {
        ...validWritingHintsVi,
        vocabulary: [
          {
            term: 'x'.repeat(201),
            definition: 'def',
            explanation: 'exp',
            example: 'ex',
          },
          ...validWritingHintsVi.vocabulary.slice(1),
        ],
      };
      expect(() => normalizeResponse(longTerm, expected)).toThrow(WritingHintsContractError);

      const longExample = {
        ...validWritingHintsVi,
        vocabulary: [
          {
            term: 'term',
            definition: 'def',
            explanation: 'exp',
            example: 'x'.repeat(2001),
          },
          ...validWritingHintsVi.vocabulary.slice(1),
        ],
      };
      expect(() => normalizeResponse(longExample, expected)).toThrow(WritingHintsContractError);
    });

    it('validates limitations boundaries (0 to 5 items, each <= 1000 chars)', () => {
      const emptyLimitations = {
        ...validWritingHintsVi,
        limitations: [],
      };
      expect(() => normalizeResponse(emptyLimitations, expected)).not.toThrow();

      const sixLimitations = {
        ...validWritingHintsVi,
        limitations: Array.from({ length: 6 }, (_, i) => `Limitation ${i + 1}`),
      };
      expect(() => normalizeResponse(sixLimitations, expected)).toThrow(WritingHintsContractError);

      const longLimitation = {
        ...validWritingHintsVi,
        limitations: ['x'.repeat(1001)],
      };
      expect(() => normalizeResponse(longLimitation, expected)).toThrow(WritingHintsContractError);
    });

    it('projects only public fields and filters out unknown private fields', () => {
      const rawWithPrivates = {
        ...validWritingHintsVi,
        prompt: 'SECRET_PROMPT_SENTINEL',
        correctAnswer: 'SECRET_ANSWER_SENTINEL',
        rawModelOutput: 'GEMINI_RAW_DATA',
        gradingRubric: { ta: 9 },
        outline: [
          {
            title: 'Intro',
            points: ['Point 1'],
            internalScore: 10,
          },
          {
            title: 'Conclusion',
            points: ['Point 2'],
          },
        ],
        vocabulary: [
          ...validWritingHintsVi.vocabulary.slice(0, 4),
          {
            term: 'unique-term',
            definition: 'def',
            explanation: 'exp',
            example: 'ex',
            privateWeight: 0.95,
          },
        ],
      };

      const normalized = normalizeResponse(rawWithPrivates, expected);
      expect(normalized).not.toHaveProperty('prompt');
      expect(normalized).not.toHaveProperty('correctAnswer');
      expect(normalized).not.toHaveProperty('rawModelOutput');
      expect(normalized).not.toHaveProperty('gradingRubric');
      // Outline section should not have internalScore
      expect(normalized.outline[0]).not.toHaveProperty('internalScore');
      // Vocabulary item should not have privateWeight
      expect(normalized.vocabulary[4]).not.toHaveProperty('privateWeight');
    });

    it('deep-clones data so mutating input does not mutate normalized result', () => {
      const input = JSON.parse(JSON.stringify(validWritingHintsVi));
      const normalized = normalizeResponse(input, expected);

      input.outline[0].title = 'MUTATED TITLE';
      input.vocabulary[0].term = 'MUTATED TERM';
      input.limitations.push('MUTATED LIMITATION');

      expect(normalized.outline[0].title).toBe('Mở bài');
      expect(normalized.vocabulary[0].term).toBe('tăng trưởng');
      expect(normalized.limitations).toHaveLength(1);
    });

    it('preserves verbatim generated text without trimming or altering internal content', () => {
      const rawWithExactText = {
        ...validWritingHintsVi,
        outline: [
          { title: '  Exact Title  ', points: ['  Exact Point with spaces  '] },
          { title: 'Second Section', points: ['Point'] },
        ],
      };
      const normalized = normalizeResponse(rawWithExactText, expected);
      expect(normalized.outline[0].title).toBe('  Exact Title  ');
      expect(normalized.outline[0].points[0]).toBe('  Exact Point with spaces  ');
    });
  });
});
