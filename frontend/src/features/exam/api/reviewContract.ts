import type {
  ExamReviewResponse,
  ReviewOptionDto,
  ReviewPartStatsDto,
  ReviewQuestionDto,
  ReviewQuestionGroupDto,
  ReviewVerdict,
} from '../types/api.types';

export class ReviewContractError extends Error {
  constructor(message: string = 'Dữ liệu ôn tập không hợp lệ. Vui lòng thử lại.') {
    super(message);
    this.name = 'ReviewContractError';
    Object.setPrototypeOf(this, ReviewContractError.prototype);
  }
}

function requireValue(condition: boolean): asserts condition {
  if (!condition) throw new ReviewContractError();
}

function record(value: unknown): Record<string, unknown> {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value));
  return value as Record<string, unknown>;
}

function positiveId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1 && value <= 2147483647;
}

function nonnegative(value: unknown): number {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0);
  return value;
}

function count(value: unknown): number {
  const number = nonnegative(value);
  requireValue(Number.isSafeInteger(number));
  return number;
}

function text(value: unknown): string {
  requireValue(typeof value === 'string');
  return value;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  requireValue(typeof value === 'string');
  return value;
}

function items<T>(value: unknown, normalize: (item: unknown) => T): T[] {
  requireValue(Array.isArray(value));
  return value.map(normalize);
}

const VALID_VERDICTS: Set<ReviewVerdict> = new Set(['CORRECT', 'WRONG', 'BLANK', 'PENDING']);

function normalizeVerdict(value: unknown): ReviewVerdict {
  requireValue(typeof value === 'string' && VALID_VERDICTS.has(value as ReviewVerdict));
  return value as ReviewVerdict;
}

function normalizePartStats(value: unknown): ReviewPartStatsDto {
  const source = record(value);
  const score = nonnegative(source.score);
  const correctCount = count(source.correctCount);
  const incorrectCount = count(source.incorrectCount);
  const unansweredCount = count(source.unansweredCount);
  const totalQuestions = count(source.totalQuestions);
  const accuracy = nonnegative(source.accuracy);

  requireValue(accuracy <= 100);
  requireValue(correctCount + incorrectCount + unansweredCount === totalQuestions);

  let isCorrectFlags: Record<string, boolean> | null = null;
  if (source.isCorrectFlags != null) {
    const flagsRecord = record(source.isCorrectFlags);
    isCorrectFlags = {};
    for (const [k, v] of Object.entries(flagsRecord)) {
      requireValue(typeof v === 'boolean');
      isCorrectFlags[k] = v;
    }
  }

  return {
    score,
    correctCount,
    incorrectCount,
    unansweredCount,
    totalQuestions,
    accuracy,
    isCorrectFlags,
  };
}

function normalizeOption(value: unknown): ReviewOptionDto {
  const source = record(value);
  const id = text(source.id ?? source.key);
  const content = optionalText(source.content ?? source.text ?? source.label);
  const isCorrect = source.isCorrect === undefined || source.isCorrect === null ? null : Boolean(source.isCorrect);

  return {
    id,
    text: content ?? undefined,
    content: content ?? undefined,
    isCorrect,
  };
}

function normalizeQuestion(value: unknown, expectedPartId: number): ReviewQuestionDto {
  const source = record(value);

  if (source.partId !== undefined && source.partId !== null) {
    requireValue(source.partId === expectedPartId);
  }

  const questionId = text(source.questionId ?? source.id);
  requireValue(questionId.length > 0);

  const verdict = normalizeVerdict(source.verdict);
  const type = optionalText(source.type) ?? undefined;
  const questionText = optionalText(source.questionText ?? source.content ?? source.text);
  const prompt = optionalText(source.prompt);
  const label = optionalText(source.label);
  const explanation = optionalText(source.explanation);

  let score: number | null = null;
  if (source.score !== undefined && source.score !== null) {
    requireValue(typeof source.score === 'number' && Number.isFinite(source.score));
    score = source.score;
  }

  let options: ReviewOptionDto[] | null = null;
  if (source.options != null) {
    options = items(source.options, normalizeOption);
  }

  let media: Record<string, unknown> | null = null;
  if (source.media != null) {
    media = record(source.media);
  }

  const isCorrect =
    verdict === 'CORRECT' ? true : verdict === 'WRONG' ? false : null;

  return {
    questionId,
    type,
    questionText,
    prompt,
    label,
    explanation,
    correctAnswer: source.correctAnswer !== undefined ? source.correctAnswer : null,
    userAnswer: source.userAnswer !== undefined ? source.userAnswer : null,
    verdict,
    score,
    options,
    media,
    id: questionId,
    content: questionText ?? prompt ?? undefined,
    isCorrect,
  };
}

function normalizeGroup(value: unknown, expectedPartId: number): ReviewQuestionGroupDto {
  const source = record(value);
  const groupId = optionalText(source.groupId ?? source.id);
  const instruction = optionalText(source.instruction);
  const contentHtml = optionalText(source.contentHtml ?? source.content_html ?? source.passageHtml ?? source.passage_html);

  let sharedAudio: Record<string, unknown> | null = null;
  if (source.sharedAudio != null || source.shared_audio != null || source.audioUrl != null || source.audio_url != null) {
    const rawAudio = source.sharedAudio ?? source.shared_audio ?? source.audioUrl ?? source.audio_url;
    if (typeof rawAudio === 'string' && rawAudio.trim().length > 0) {
      sharedAudio = { url: rawAudio.trim() };
    } else if (typeof rawAudio === 'object' && !Array.isArray(rawAudio)) {
      sharedAudio = rawAudio as Record<string, unknown>;
    }
  }

  let sharedMedia: Record<string, unknown> | null = null;
  if (source.sharedMedia != null || source.shared_media != null || source.media != null) {
    const rawMedia = source.sharedMedia ?? source.shared_media ?? source.media;
    if (typeof rawMedia === 'string' && rawMedia.trim().length > 0) {
      sharedMedia = { url: rawMedia.trim() };
    } else if (typeof rawMedia === 'object' && !Array.isArray(rawMedia)) {
      sharedMedia = rawMedia as Record<string, unknown>;
    }
  }

  let questions: ReviewQuestionDto[] | null = null;
  if (source.questions != null) {
    questions = items(source.questions, q => normalizeQuestion(q, expectedPartId));
  }

  return {
    groupId,
    instruction,
    contentHtml,
    sharedAudio,
    sharedMedia,
    questions,
  };
}

export function normalizeAttemptReview(
  data: unknown,
  expectedAttemptId: number,
  expectedPartId: number
): ExamReviewResponse {
  requireValue(positiveId(expectedAttemptId));
  requireValue(positiveId(expectedPartId));

  const source = record(data);
  requireValue(source.attemptId === expectedAttemptId);
  requireValue(source.partId === expectedPartId);

  const partStats = normalizePartStats(source.partStats);

  const seenQuestionIds = new Set<string>();
  const questions = items(source.questions, item => {
    const q = normalizeQuestion(item, expectedPartId);
    requireValue(!seenQuestionIds.has(q.questionId));
    seenQuestionIds.add(q.questionId);
    return q;
  });

  let questionGroups: ReviewQuestionGroupDto[] | null = null;
  if (source.questionGroups != null) {
    const groupedQuestionIds = new Set<string>();
    questionGroups = items(source.questionGroups, item => {
      const g = normalizeGroup(item, expectedPartId);
      if (g.questions) {
        for (const gq of g.questions) {
          requireValue(!groupedQuestionIds.has(gq.questionId));
          groupedQuestionIds.add(gq.questionId);
          requireValue(seenQuestionIds.has(gq.questionId));
        }
      }
      return g;
    });
  }

  let userAnswers: Record<string, any> | null = null;
  if (source.userAnswers != null) {
    userAnswers = record(source.userAnswers);
  }

  let examData: Record<string, any> | null = null;
  if (source.examData != null) {
    examData = record(source.examData);
  }

  let partResult: Record<string, any> | null = null;
  if (source.partResult != null) {
    partResult = record(source.partResult);
  }

  return {
    attemptId: expectedAttemptId,
    partId: expectedPartId,
    partTitle: optionalText(source.partTitle) ?? undefined,
    skill: optionalText(source.skill) ?? undefined,
    partStats,
    userAnswers,
    questions,
    questionGroups,
    examData,
    partResult,
    isCorrectFlags: partStats.isCorrectFlags,
  };
}
