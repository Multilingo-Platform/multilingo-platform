import type {
  WritingHintsOutlineSection,
  WritingHintsRequest,
  WritingHintsResponse,
  WritingHintsVocabularyItem,
} from '../types/api.types';
import {
  canonicalizeBcp47LanguageTag,
  canonicalizeLearningLanguage,
} from '../../../core/i18n/learningLanguages';

export const canonicalizeLanguageTag = canonicalizeLearningLanguage;

export class WritingHintsContractError extends Error {
  constructor(message: string = 'Dữ liệu gợi ý bài viết không hợp lệ. Vui lòng thử lại.') {
    super(message);
    this.name = 'WritingHintsContractError';
    Object.setPrototypeOf(this, WritingHintsContractError.prototype);
  }
}

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/;
const JAVA_SPACE_SEPARATOR = /^[\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]$/;

// Union of Java Character.isWhitespace / isSpaceChar used by the backend ID validator.
function isJavaEdgeWhitespace(character: string): boolean {
  const code = character.charCodeAt(0);
  return (code >= 0x09 && code <= 0x0d) || (code >= 0x1c && code <= 0x1f) || JAVA_SPACE_SEPARATOR.test(character);
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

function isValidIsoInstant(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const match = val.match(ISO_TIMESTAMP_PATTERN);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  if (match[7] !== undefined && (Number(match[7]) > 23 || Number(match[8]) > 59)) return false;
  const leapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day < 1 || day > daysInMonth) return false;
  return Number.isFinite(Date.parse(val));
}

/**
 * Tạo requestId UUID v4 chuẩn theo RFC 4122 bằng Web Crypto API.
 * Ném WritingHintsContractError nếu môi trường không hỗ trợ Web Crypto (zero Math.random fallback).
 */
export function createWritingHintsRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().toLowerCase();
  }
  throw new WritingHintsContractError('Không thể tạo định danh yêu cầu an toàn.');
}

/**
 * Xác thực và đóng băng WritingHintsRequest trước khi gửi qua transport.
 */
export function validateWritingHintsRequest(
  attemptId: number,
  req: WritingHintsRequest
): WritingHintsRequest {
  if (!isPositiveInt(attemptId)) {
    throw new WritingHintsContractError('ID phiên thi không hợp lệ');
  }
  if (!isRecord(req)) {
    throw new WritingHintsContractError('Yêu cầu gợi ý bài viết không hợp lệ');
  }
  if (!isPositiveInt(req.partId)) {
    throw new WritingHintsContractError('ID phần thi không hợp lệ');
  }

  if (typeof req.questionId !== 'string') {
    throw new WritingHintsContractError('Mã câu hỏi phải là chuỗi ký tự');
  }
  if (req.questionId.length === 0) {
    throw new WritingHintsContractError('Mã câu hỏi không được để trống');
  }
  if (isJavaEdgeWhitespace(req.questionId[0]) || isJavaEdgeWhitespace(req.questionId[req.questionId.length - 1])) {
    throw new WritingHintsContractError('Mã câu hỏi không được chứa khoảng trắng ở đầu hoặc cuối');
  }
  if (req.questionId.length > 128) {
    throw new WritingHintsContractError('Mã câu hỏi không được vượt quá 128 ký tự');
  }

  if (typeof req.requestId !== 'string' || !UUID_PATTERN.test(req.requestId.trim())) {
    throw new WritingHintsContractError('Mã định danh yêu cầu (requestId) phải là UUID hợp lệ');
  }
  const normalizedRequestId = req.requestId.trim().toLowerCase();

  let canonicalLearningLanguage: string | undefined;
  if (req.learningLanguage !== undefined && req.learningLanguage !== null) {
    const canonical = canonicalizeLanguageTag(req.learningLanguage);
    if (!canonical) {
      throw new WritingHintsContractError('Ngôn ngữ học tập không được hỗ trợ hoặc không hợp lệ');
    }
    canonicalLearningLanguage = canonical;
  }

  let canonicalHintLanguage: string | undefined;
  if (req.hintLanguage !== undefined && req.hintLanguage !== null) {
    const canonical = canonicalizeLanguageTag(req.hintLanguage);
    if (!canonical) {
      throw new WritingHintsContractError('Ngôn ngữ gợi ý không được hỗ trợ hoặc không hợp lệ');
    }
    canonicalHintLanguage = canonical;
  }

  const result: WritingHintsRequest = {
    partId: req.partId,
    questionId: req.questionId,
    requestId: normalizedRequestId,
  };

  if (canonicalLearningLanguage) {
    result.learningLanguage = canonicalLearningLanguage;
  }
  if (canonicalHintLanguage) {
    result.hintLanguage = canonicalHintLanguage;
  }

  return Object.freeze(result);
}

/**
 * Phân tích và chuẩn hóa phản hồi WritingHintsResponse từ máy chủ.
 * Thực thi kiểm tra envelope, identity matching, canonicalization ngôn ngữ,
 * biên giới hạn outline (2-8 sections, 1-6 points), vocabulary (5-10 items, term unique),
 * limitations (0-5 items), và chiếu (projection) deep-copy chỉ giữ các trường công khai.
 */
export function normalizeWritingHints(
  data: unknown,
  expected: WritingHintsRequest & { attemptId: number; defaultHintLanguage?: string | null }
): WritingHintsResponse {
  if (!isRecord(expected)) {
    throw new WritingHintsContractError('Thông số đối soát không hợp lệ');
  }

  if (!isRecord(data) || data.code !== 200 || !isRecord(data.data)) {
    throw new WritingHintsContractError('Phản hồi từ máy chủ không thành công');
  }
  const payload = data.data;

  // 1. Đối soát Identity (4 IDs)
  if (payload.attemptId !== expected.attemptId) {
    throw new WritingHintsContractError('attemptId trong phản hồi không khớp với phiên làm bài');
  }
  if (payload.partId !== expected.partId) {
    throw new WritingHintsContractError('partId trong phản hồi không khớp với phần làm bài');
  }
  if (payload.questionId !== expected.questionId) {
    throw new WritingHintsContractError('questionId trong phản hồi không khớp với câu hỏi');
  }
  if (
    typeof payload.requestId !== 'string' ||
    payload.requestId.trim().toLowerCase() !== expected.requestId.toLowerCase()
  ) {
    throw new WritingHintsContractError('requestId trong phản hồi không khớp với yêu cầu');
  }
  const requestId = payload.requestId.trim().toLowerCase();

  // 2. Ngôn ngữ (learningLanguage & hintLanguage)
  const canonicalLearningLang = canonicalizeBcp47LanguageTag(payload.learningLanguage);
  if (!canonicalLearningLang) {
    throw new WritingHintsContractError('learningLanguage trong phản hồi không hợp lệ');
  }
  if (expected.learningLanguage) {
    const expectedCanonical = canonicalizeBcp47LanguageTag(expected.learningLanguage);
    if (expectedCanonical && canonicalLearningLang !== expectedCanonical) {
      throw new WritingHintsContractError('learningLanguage trong phản hồi không khớp yêu cầu');
    }
  }

  const canonicalHintLang = canonicalizeBcp47LanguageTag(payload.hintLanguage);
  if (!canonicalHintLang) {
    throw new WritingHintsContractError('hintLanguage trong phản hồi không hợp lệ');
  }
  if (expected.hintLanguage) {
    const expectedCanonicalHint = canonicalizeBcp47LanguageTag(expected.hintLanguage);
    if (expectedCanonicalHint && canonicalHintLang !== expectedCanonicalHint) {
      throw new WritingHintsContractError('hintLanguage trong phản hồi không khớp yêu cầu');
    }
  } else {
    const expectedDefault = canonicalizeBcp47LanguageTag(expected.defaultHintLanguage) ?? canonicalLearningLang;
    if (canonicalHintLang !== expectedDefault) {
    throw new WritingHintsContractError('hintLanguage mặc định trong phản hồi không khớp ngôn ngữ học');
    }
  }

  // 3. generatedAt
  if (!isValidIsoInstant(payload.generatedAt)) {
    throw new WritingHintsContractError('Thời gian sinh gợi ý (generatedAt) không hợp lệ');
  }
  const generatedAt = payload.generatedAt;

  // 4. outline (2–8 sections, 1–6 points/section, title <= 200, point <= 1000)
  if (!Array.isArray(payload.outline)) {
    throw new WritingHintsContractError('Dàn ý (outline) phải là một danh sách');
  }
  if (payload.outline.length < 2 || payload.outline.length > 8) {
    throw new WritingHintsContractError('Dàn ý phải có từ 2 đến 8 phần');
  }

  const outlineList: WritingHintsOutlineSection[] = [];
  for (const rawSec of payload.outline) {
    if (!isRecord(rawSec)) {
      throw new WritingHintsContractError('Phần dàn ý không phải là đối tượng hợp lệ');
    }
    if (typeof rawSec.title !== 'string' || rawSec.title.trim().length === 0) {
      throw new WritingHintsContractError('Tiêu đề phần dàn ý không được để trống');
    }
    if (rawSec.title.length > 200) {
      throw new WritingHintsContractError('Tiêu đề phần dàn ý không được vượt quá 200 ký tự');
    }
    if (!Array.isArray(rawSec.points)) {
      throw new WritingHintsContractError('Các luận điểm (points) phải là một danh sách');
    }
    if (rawSec.points.length < 1 || rawSec.points.length > 6) {
      throw new WritingHintsContractError('Mỗi phần dàn ý phải có từ 1 đến 6 luận điểm');
    }

    const pointsList: string[] = [];
    for (const rawPoint of rawSec.points) {
      if (typeof rawPoint !== 'string' || rawPoint.trim().length === 0) {
        throw new WritingHintsContractError('Luận điểm không được để trống');
      }
      if (rawPoint.length > 1000) {
        throw new WritingHintsContractError('Luận điểm không được vượt quá 1000 ký tự');
      }
      pointsList.push(rawPoint);
    }

    outlineList.push({
      title: rawSec.title,
      points: pointsList,
    });
  }

  // 5. vocabulary (5–10 items, term unique, lengths: term<=200, def/exp<=1000, ex<=2000)
  if (!Array.isArray(payload.vocabulary)) {
    throw new WritingHintsContractError('Từ vựng (vocabulary) phải là một danh sách');
  }
  if (payload.vocabulary.length < 5 || payload.vocabulary.length > 10) {
    throw new WritingHintsContractError('Danh sách từ vựng phải có từ 5 đến 10 mục');
  }

  const vocabList: WritingHintsVocabularyItem[] = [];
  const seenTerms = new Set<string>();

  for (const rawItem of payload.vocabulary) {
    if (!isRecord(rawItem)) {
      throw new WritingHintsContractError('Mục từ vựng không phải là đối tượng hợp lệ');
    }
    if (typeof rawItem.term !== 'string' || rawItem.term.trim().length === 0) {
      throw new WritingHintsContractError('Từ vựng không được để trống');
    }
    if (rawItem.term.length > 200) {
      throw new WritingHintsContractError('Từ vựng không được vượt quá 200 ký tự');
    }

    const termKey = rawItem.term.trim().toLowerCase();
    if (seenTerms.has(termKey)) {
      throw new WritingHintsContractError('Danh sách từ vựng không được chứa từ trùng lặp');
    }
    seenTerms.add(termKey);

    if (typeof rawItem.definition !== 'string' || rawItem.definition.trim().length === 0) {
      throw new WritingHintsContractError('Định nghĩa từ vựng không được để trống');
    }
    if (rawItem.definition.length > 1000) {
      throw new WritingHintsContractError('Định nghĩa từ vựng không được vượt quá 1000 ký tự');
    }

    if (typeof rawItem.explanation !== 'string' || rawItem.explanation.trim().length === 0) {
      throw new WritingHintsContractError('Giải thích ngữ cảnh không được để trống');
    }
    if (rawItem.explanation.length > 1000) {
      throw new WritingHintsContractError('Giải thích ngữ cảnh không được vượt quá 1000 ký tự');
    }

    if (typeof rawItem.example !== 'string' || rawItem.example.trim().length === 0) {
      throw new WritingHintsContractError('Câu ví dụ không được để trống');
    }
    if (rawItem.example.length > 2000) {
      throw new WritingHintsContractError('Câu ví dụ không được vượt quá 2000 ký tự');
    }

    vocabList.push({
      term: rawItem.term,
      definition: rawItem.definition,
      explanation: rawItem.explanation,
      example: rawItem.example,
    });
  }

  // 6. limitations (0–5 items, <= 1000 chars)
  const limitationsList: string[] = [];
  if (payload.limitations !== undefined && payload.limitations !== null) {
    if (!Array.isArray(payload.limitations)) {
      throw new WritingHintsContractError('Giới hạn (limitations) phải là một danh sách');
    }
    if (payload.limitations.length > 5) {
      throw new WritingHintsContractError('Giới hạn không được vượt quá 5 mục');
    }
    for (const rawLim of payload.limitations) {
      if (typeof rawLim !== 'string' || rawLim.trim().length === 0) {
        throw new WritingHintsContractError('Nội dung giới hạn không được để trống');
      }
      if (rawLim.length > 1000) {
        throw new WritingHintsContractError('Nội dung giới hạn không được vượt quá 1000 ký tự');
      }
      limitationsList.push(rawLim);
    }
  }

  // Chiếu an toàn chỉ gồm các trường public, deep-copy toàn bộ
  return {
    attemptId: payload.attemptId as number,
    partId: payload.partId as number,
    questionId: payload.questionId as string,
    requestId,
    learningLanguage: canonicalLearningLang,
    hintLanguage: canonicalHintLang,
    generatedAt,
    outline: outlineList,
    vocabulary: vocabList,
    limitations: limitationsList,
  };
}
