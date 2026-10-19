import type {
  PracticeFeedbackRequest,
  PracticeFeedbackResponse,
  PracticeObjectiveType,
  PracticeVerdict,
  ReviewScalar,
} from '../types/api.types';
import type { AnswerValue } from '../types/answer.types';

export class PracticeFeedbackContractError extends Error {
  constructor(message: string = 'Dữ liệu phản hồi luyện tập không hợp lệ. Vui lòng thử lại.') {
    super(message);
    this.name = 'PracticeFeedbackContractError';
    Object.setPrototypeOf(this, PracticeFeedbackContractError.prototype);
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isPositiveInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}

function isAnswerValue(val: unknown): val is AnswerValue {
  if (val === null || typeof val === 'string') return true;
  if (Array.isArray(val)) return val.every(item => typeof item === 'string');
  if (isRecord(val)) return Object.values(val).every(item => typeof item === 'string');
  return false;
}

export const VALID_PRACTICE_OBJECTIVE_TYPES: Set<PracticeObjectiveType> = new Set([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'FILL_IN_THE_BLANK',
  'TRUE_FALSE_NOT_GIVEN',
  'YES_NO_NOT_GIVEN',
  'MATCHING_FEATURES',
  'MATCHING_HEADINGS',
  'MATCHING_SENTENCE_ENDINGS',
  'MATCHING_INFORMATION',
  'MAP_LABELING',
  'DIAGRAM_LABELING',
  'MATCHING',
]);

export const VALID_PRACTICE_VERDICTS: Set<PracticeVerdict> = new Set([
  'CORRECT',
  'WRONG',
  'BLANK',
]);

function isReviewScalar(val: unknown): val is ReviewScalar {
  if (typeof val === 'string' || typeof val === 'boolean') return true;
  if (typeof val === 'number' && Number.isFinite(val)) return true;
  return false;
}

function deepCloneAnswer(val: AnswerValue): AnswerValue {
  if (val === null || typeof val === 'string') return val;
  if (Array.isArray(val)) return [...val];
  return { ...val };
}

function validateAndCloneCorrectAnswer(
  val: unknown
): ReviewScalar | ReviewScalar[] | Record<string, ReviewScalar> {
  if (val === null || val === undefined) {
    throw new PracticeFeedbackContractError();
  }
  if (isReviewScalar(val)) {
    return val;
  }
  if (Array.isArray(val)) {
    if (!val.every(isReviewScalar)) {
      throw new PracticeFeedbackContractError();
    }
    return [...val];
  }
  if (isRecord(val)) {
    const entries = Object.entries(val);
    for (const [, v] of entries) {
      if (!isReviewScalar(v)) {
        throw new PracticeFeedbackContractError();
      }
    }
    return { ...val } as Record<string, ReviewScalar>;
  }
  throw new PracticeFeedbackContractError();
}

/**
 * Validates request arguments before sending over HTTP.
 * Throws PracticeFeedbackContractError if any field fails invariant checks.
 */
export function validatePracticeFeedbackRequest(
  attemptId: number,
  req: PracticeFeedbackRequest
): void {
  if (!isPositiveInt(attemptId)) {
    throw new PracticeFeedbackContractError('ID phiên thi không hợp lệ');
  }
  if (!isRecord(req)) {
    throw new PracticeFeedbackContractError('Yêu cầu kiểm tra đáp án không hợp lệ');
  }
  if (!isPositiveInt(req.partId)) {
    throw new PracticeFeedbackContractError('ID phần thi không hợp lệ');
  }
  if (!isNonEmptyString(req.questionId)) {
    throw new PracticeFeedbackContractError('Mã câu hỏi không hợp lệ');
  }
  if (!isAnswerValue(req.answer)) {
    throw new PracticeFeedbackContractError('Dữ liệu đáp án kiểm tra không hợp lệ');
  }
}

/**
 * Compares two AnswerValue values for semantic equality.
 * - string/null: exact match (including Unicode and whitespace).
 * - array: exact length and strict item ordering.
 * - map: identical key/value entries regardless of key insertion order.
 */
export function areAnswerValuesEqual(a: AnswerValue, b: AnswerValue): boolean {
  if (a === null || b === null) {
    return a === b;
  }
  if (typeof a === 'string' || typeof b === 'string') {
    return a === b;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  if (isRecord(a) && isRecord(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key) || a[key] !== b[key]) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Normalizes raw response data from backend into typed PracticeFeedbackResponse.
 * Enforces tuple matching, strict type/verdict allowlist, answer-echo verification,
 * and strips extraneous fields.
 */
export function normalizePracticeFeedback(
  raw: unknown,
  expectedAttemptId: number,
  expectedPartId: number,
  expectedQuestionId: string,
  expectedUserAnswer?: AnswerValue
): PracticeFeedbackResponse {
  if (!isRecord(raw)) {
    throw new PracticeFeedbackContractError();
  }

  const attemptId = raw.attemptId;
  if (!isPositiveInt(attemptId) || attemptId !== expectedAttemptId) {
    throw new PracticeFeedbackContractError();
  }

  const partId = raw.partId;
  if (!isPositiveInt(partId) || partId !== expectedPartId) {
    throw new PracticeFeedbackContractError();
  }

  const questionId = raw.questionId;
  if (typeof questionId !== 'string' || questionId !== expectedQuestionId || questionId.length === 0) {
    throw new PracticeFeedbackContractError();
  }

  const type = raw.type as PracticeObjectiveType;
  if (!VALID_PRACTICE_OBJECTIVE_TYPES.has(type)) {
    throw new PracticeFeedbackContractError();
  }

  if (!isAnswerValue(raw.userAnswer)) {
    throw new PracticeFeedbackContractError();
  }
  if (expectedUserAnswer !== undefined && !areAnswerValuesEqual(raw.userAnswer, expectedUserAnswer)) {
    throw new PracticeFeedbackContractError();
  }
  const userAnswer = deepCloneAnswer(raw.userAnswer);

  const verdict = raw.verdict as PracticeVerdict;
  if (!VALID_PRACTICE_VERDICTS.has(verdict)) {
    throw new PracticeFeedbackContractError();
  }

  const score = raw.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) {
    throw new PracticeFeedbackContractError();
  }

  const correctAnswer = validateAndCloneCorrectAnswer(raw.correctAnswer);

  let explanation: string | null = null;
  if (raw.explanation === undefined || raw.explanation === null) {
    explanation = null;
  } else if (typeof raw.explanation === 'string') {
    explanation = raw.explanation;
  } else {
    throw new PracticeFeedbackContractError();
  }

  return {
    attemptId,
    partId,
    questionId,
    type,
    userAnswer,
    verdict,
    score,
    correctAnswer,
    explanation,
  };
}
