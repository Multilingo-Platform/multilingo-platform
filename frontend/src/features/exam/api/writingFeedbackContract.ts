import type { AttemptStatus } from '../types/answer.types';
import type {
  WritingCriterion,
  WritingCriterionCode,
  WritingCorrection,
  WritingDiffSegment,
  WritingDiffType,
  WritingFeedbackResponse,
  WritingFeedbackTask,
  WritingFeedbackTaskStatus,
} from '../types/api.types';

export class WritingFeedbackContractError extends Error {
  constructor(message: string = 'Phản hồi chấm điểm bài viết không hợp lệ.') {
    super(message);
    this.name = 'WritingFeedbackContractError';
    Object.setPrototypeOf(this, WritingFeedbackContractError.prototype);
  }
}

function requireValue(condition: boolean, message?: string): asserts condition {
  if (!condition) {
    throw new WritingFeedbackContractError(message);
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function isPositiveJavaInt(val: unknown): val is number {
  return typeof val === 'number' && Number.isSafeInteger(val) && val >= 1 && val <= 2147483647;
}

function isValidScore(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val) && val >= 0 && val <= 9 && (val * 2) % 1 === 0;
}

const VALID_POST_SUBMIT_ATTEMPT_STATUSES: ReadonlySet<string> = new Set([
  'SUBMITTED',
  'GRADING_FAILED',
  'AI_GRADING',
  'AI_GRADING_QUEUED',
  'COMPLETED',
  'EXPIRED',
]);

const VALID_TASK_STATUSES: ReadonlySet<WritingFeedbackTaskStatus> = new Set([
  'PENDING',
  'QUEUED',
  'DONE',
  'FAILED',
  'UNAVAILABLE',
]);

const CANONICAL_CRITERION_CODES: readonly WritingCriterionCode[] = ['TR', 'CC', 'LR', 'GRA'];
const MAX_CORRECTIONS_COUNT = 100;
const MAX_REPLACEMENT_CODE_POINTS = 2000;
const MAX_EXPLANATION_CODE_POINTS = 500;

const VALID_DIFF_TYPES: ReadonlySet<WritingDiffType> = new Set(['EQUAL', 'DELETE', 'INSERT']);

function splitsSurrogate(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) {
    return false;
  }
  const prevCode = text.charCodeAt(index - 1);
  const currCode = text.charCodeAt(index);
  return prevCode >= 0xd800 && prevCode <= 0xdbff && currCode >= 0xdc00 && currCode <= 0xdfff;
}

function computeExpectedPartStatus(tasks: WritingFeedbackTask[]): WritingFeedbackTaskStatus {
  if (tasks.every((t) => t.status === 'DONE')) {
    return 'DONE';
  }
  if (tasks.some((t) => t.status === 'PENDING')) {
    return 'PENDING';
  }
  if (tasks.some((t) => t.status === 'QUEUED')) {
    return 'QUEUED';
  }
  if (tasks.some((t) => t.status === 'FAILED')) {
    return 'FAILED';
  }
  return 'UNAVAILABLE';
}

export function normalizeWritingFeedback(
  data: unknown,
  expectedAttemptId: number,
  expectedPartId: number
): WritingFeedbackResponse {
  requireValue(isRecord(data), 'Response data must be a non-null object');

  // 1. Identity validation
  requireValue(isPositiveJavaInt(expectedAttemptId), 'Expected attemptId must be a positive Java integer');
  requireValue(isPositiveJavaInt(expectedPartId), 'Expected partId must be a positive Java integer');

  requireValue(
    isPositiveJavaInt(data.attemptId) && data.attemptId === expectedAttemptId,
    `Response attemptId (${data.attemptId}) does not match expected (${expectedAttemptId})`
  );
  requireValue(
    isPositiveJavaInt(data.partId) && data.partId === expectedPartId,
    `Response partId (${data.partId}) does not match expected (${expectedPartId})`
  );

  // 2. AttemptStatus validation
  requireValue(
    typeof data.attemptStatus === 'string' && VALID_POST_SUBMIT_ATTEMPT_STATUSES.has(data.attemptStatus),
    `Invalid post-submit attemptStatus: ${data.attemptStatus}`
  );
  const attemptStatus = data.attemptStatus as Exclude<AttemptStatus, 'IN_PROGRESS'>;

  // 3. Tasks array validation
  requireValue(Array.isArray(data.tasks), 'Response tasks must be an array');
  requireValue(data.tasks.length >= 1, 'Response tasks array must not be empty');

  const seenQuestionIds = new Set<string>();
  const validatedTasks: WritingFeedbackTask[] = [];

  for (const rawTask of data.tasks) {
    requireValue(isRecord(rawTask), 'Each task in tasks must be an object');

    // questionId
    requireValue(typeof rawTask.questionId === 'string', 'Task questionId must be a string');
    const questionId = rawTask.questionId.trim();
    requireValue(questionId.length > 0, 'Task questionId must not be empty or whitespace');
    requireValue(!seenQuestionIds.has(questionId), `Duplicate questionId: ${questionId}`);
    seenQuestionIds.add(questionId);

    // label
    requireValue(typeof rawTask.label === 'string' && rawTask.label.trim().length > 0, 'Task label must not be empty');
    const label = rawTask.label;

    // status
    requireValue(
      typeof rawTask.status === 'string' && VALID_TASK_STATUSES.has(rawTask.status as WritingFeedbackTaskStatus),
      `Invalid task status: ${rawTask.status}`
    );
    const status = rawTask.status as WritingFeedbackTaskStatus;

    // wordCount
    requireValue(
      typeof rawTask.wordCount === 'number' && Number.isSafeInteger(rawTask.wordCount) && rawTask.wordCount >= 0,
      `Task wordCount must be a non-negative integer: ${rawTask.wordCount}`
    );
    const wordCount = rawTask.wordCount;

    // language
    if (rawTask.language !== null && rawTask.language !== undefined) {
      requireValue(
        typeof rawTask.language === 'string' && rawTask.language.trim().length > 0,
        `Task language must be a non-empty string or null/omitted: ${rawTask.language}`
      );
    }
    const language = typeof rawTask.language === 'string' && rawTask.language.trim().length > 0 ? rawTask.language : null;

    // source
    requireValue(
      rawTask.source === 'AI' || rawTask.source === 'SYSTEM',
      `Task source must be 'AI' or 'SYSTEM': ${rawTask.source}`
    );
    const source = rawTask.source;

    // scoreUnit
    requireValue(rawTask.scoreUnit === 'BAND_0_9', `Task scoreUnit must be 'BAND_0_9': ${rawTask.scoreUnit}`);
    const scoreUnit = 'BAND_0_9';

    // hasVisualContext
    requireValue(typeof rawTask.hasVisualContext === 'boolean', 'Task hasVisualContext must be a boolean');
    const hasVisualContext = rawTask.hasVisualContext;

    // displayMessage
    requireValue(
      typeof rawTask.displayMessage === 'string' && rawTask.displayMessage.trim().length > 0,
      'Task displayMessage must be a non-empty string'
    );
    const displayMessage = rawTask.displayMessage;

    // reasonCode
    if (rawTask.reasonCode !== null && rawTask.reasonCode !== undefined) {
      requireValue(
        typeof rawTask.reasonCode === 'string' && rawTask.reasonCode.trim().length > 0,
        `Task reasonCode must be a non-empty string or null/omitted: ${rawTask.reasonCode}`
      );
    }
    const reasonCode =
      typeof rawTask.reasonCode === 'string' && rawTask.reasonCode.trim().length > 0 ? rawTask.reasonCode : null;

    if (status === 'DONE') {
      // overall
      requireValue(isValidScore(rawTask.overall), `Task overall score must be valid half-step 0..9: ${rawTask.overall}`);
      const overall = rawTask.overall;

      // maxScore
      requireValue(
        typeof rawTask.maxScore === 'number' && rawTask.maxScore === 9,
        `Task maxScore must be exactly 9.0: ${rawTask.maxScore}`
      );
      const maxScore = 9.0;

      // originalText
      requireValue(typeof rawTask.originalText === 'string', 'DONE task must have string originalText');
      const originalText = rawTask.originalText;

      // overallFeedback
      requireValue(typeof rawTask.overallFeedback === 'string', 'DONE task must have string overallFeedback');
      if (source === 'AI') {
        requireValue(rawTask.overallFeedback.trim().length > 0, 'AI DONE overallFeedback must not be empty');
      }
      const overallFeedback = rawTask.overallFeedback;

      // correctedEssay
      requireValue(typeof rawTask.correctedEssay === 'string', 'DONE task must have string correctedEssay');
      const correctedEssay = rawTask.correctedEssay;

      // criteria
      requireValue(Array.isArray(rawTask.criteria) && rawTask.criteria.length === 4, 'DONE task must have exactly 4 criteria');
      const criteriaMap = new Map<string, WritingCriterion>();

      for (const rawCrit of rawTask.criteria) {
        requireValue(isRecord(rawCrit), 'Each criterion must be an object');
        requireValue(
          typeof rawCrit.code === 'string' && CANONICAL_CRITERION_CODES.includes(rawCrit.code as WritingCriterionCode),
          `Invalid criterion code: ${rawCrit.code}`
        );
        const code = rawCrit.code as WritingCriterionCode;
        requireValue(!criteriaMap.has(code), `Duplicate criterion code: ${code}`);

        requireValue(isValidScore(rawCrit.score), `Criterion ${code} score must be valid half-step 0..9: ${rawCrit.score}`);
        requireValue(typeof rawCrit.feedback === 'string', `Criterion ${code} feedback must be string`);
        if (source === 'AI') {
          requireValue(rawCrit.feedback.trim().length > 0, `AI criterion ${code} feedback must not be empty`);
        }

        criteriaMap.set(code, {
          code,
          score: rawCrit.score,
          feedback: rawCrit.feedback,
        });
      }

      // Canonical ordering TR, CC, LR, GRA
      const criteria = CANONICAL_CRITERION_CODES.map((code) => {
        const c = criteriaMap.get(code);
        requireValue(c !== undefined, `Missing canonical criterion code: ${code}`);
        return c;
      });

      // diff
      requireValue(Array.isArray(rawTask.diff), 'DONE task must have diff array');
      const diff: WritingDiffSegment[] = [];
      let reconstructedOrigFromDiff = '';
      let reconstructedCorrFromDiff = '';

      for (const seg of rawTask.diff) {
        requireValue(isRecord(seg), 'Diff segment must be an object');
        requireValue(
          typeof seg.type === 'string' && VALID_DIFF_TYPES.has(seg.type as WritingDiffType),
          `Invalid diff segment type: ${seg.type}`
        );
        requireValue(typeof seg.text === 'string', 'Diff segment text must be a string');

        const type = seg.type as WritingDiffType;
        const text = seg.text;
        diff.push({ type, text });

        if (type === 'EQUAL' || type === 'DELETE') {
          reconstructedOrigFromDiff += text;
        }
        if (type === 'EQUAL' || type === 'INSERT') {
          reconstructedCorrFromDiff += text;
        }
      }

      requireValue(
        reconstructedOrigFromDiff === originalText,
        'Diff EQUAL+DELETE segments do not reconstruct originalText'
      );
      requireValue(
        reconstructedCorrFromDiff === correctedEssay,
        'Diff EQUAL+INSERT segments do not reconstruct correctedEssay'
      );

      // corrections
      requireValue(Array.isArray(rawTask.corrections), 'DONE task must have corrections array');
      requireValue(rawTask.corrections.length <= MAX_CORRECTIONS_COUNT, 'Corrections exceeds maximum count of 100');
      const corrections: WritingCorrection[] = [];

      if (source === 'SYSTEM') {
        requireValue(reasonCode === 'TOO_SHORT', 'SYSTEM DONE task must have reasonCode TOO_SHORT');
        requireValue(overall === 0.0, 'SYSTEM DONE task must have overall 0.0');
        requireValue(rawTask.corrections.length === 0, 'SYSTEM DONE task must have empty corrections');
        requireValue(correctedEssay === originalText, 'SYSTEM DONE correctedEssay must equal originalText');
      } else {
        // AI DONE: Validate corrections offsets, bounds, ordering, surrogate pair splitting, and reconstruction
        let lastEnd = 0;
        let reconstructedCorrFromCorrections = '';

        for (const rawCorr of rawTask.corrections) {
          requireValue(isRecord(rawCorr), 'Correction must be an object');
          requireValue(
            typeof rawCorr.start === 'number' && Number.isSafeInteger(rawCorr.start),
            'Correction start must be safe integer'
          );
          requireValue(
            typeof rawCorr.end === 'number' && Number.isSafeInteger(rawCorr.end),
            'Correction end must be safe integer'
          );
          requireValue(typeof rawCorr.replacement === 'string', 'Correction replacement must be string');
          requireValue(typeof rawCorr.explanation === 'string', 'Correction explanation must be string');
          requireValue(
            Array.from(rawCorr.replacement).length <= MAX_REPLACEMENT_CODE_POINTS,
            'Correction replacement exceeds maximum of 2000 code points'
          );
          requireValue(
            Array.from(rawCorr.explanation).length <= MAX_EXPLANATION_CODE_POINTS,
            'Correction explanation exceeds maximum of 500 code points'
          );

          const start = rawCorr.start;
          const end = rawCorr.end;
          const replacement = rawCorr.replacement;
          const explanation = rawCorr.explanation;

          requireValue(
            start >= 0 && end >= start && end <= originalText.length,
            `Correction bounds out of range: [${start}, ${end}] for original length ${originalText.length}`
          );
          requireValue(start >= lastEnd, `Overlapping or out-of-order correction at start ${start} < prevEnd ${lastEnd}`);
          requireValue(!splitsSurrogate(originalText, start), `Correction start ${start} splits UTF-16 surrogate pair`);
          requireValue(!splitsSurrogate(originalText, end), `Correction end ${end} splits UTF-16 surrogate pair`);

          reconstructedCorrFromCorrections += originalText.slice(lastEnd, start) + replacement;
          lastEnd = end;

          corrections.push({ start, end, replacement, explanation });
        }

        reconstructedCorrFromCorrections += originalText.slice(lastEnd);
        requireValue(
          reconstructedCorrFromCorrections === correctedEssay,
          'Applying corrections to originalText does not reconstruct correctedEssay'
        );
      }

      // visualObservations
      let visualObservations: string | null = null;
      if (source === 'AI' && hasVisualContext) {
        requireValue(
          typeof rawTask.visualObservations === 'string' && rawTask.visualObservations.trim().length > 0,
          'AI DONE visual task must have non-empty visualObservations'
        );
        const codePointsCount = Array.from(rawTask.visualObservations).length;
        requireValue(
          codePointsCount <= 1000,
          `visualObservations exceeds maximum limit of 1000 code points: ${codePointsCount}`
        );
        visualObservations = rawTask.visualObservations;
      } else {
        requireValue(
          rawTask.visualObservations === null || rawTask.visualObservations === undefined,
          'Text-only or non-AI task must not have visualObservations'
        );
        visualObservations = null;
      }

      validatedTasks.push({
        questionId,
        label,
        status,
        wordCount,
        language,
        source,
        scoreUnit,
        overall,
        maxScore,
        criteria,
        originalText,
        overallFeedback,
        correctedEssay,
        corrections,
        diff,
        reasonCode,
        displayMessage,
        hasVisualContext,
        visualObservations,
      });
    } else {
      // Non-DONE status (PENDING, QUEUED, FAILED, UNAVAILABLE)
      // Must not leak or fabricate scores, criteria, diff, corrections, or visual observations
      requireValue(
        rawTask.overall === null || rawTask.overall === undefined,
        `Non-DONE task must not contain overall score: ${rawTask.overall}`
      );
      requireValue(
        rawTask.maxScore === null || rawTask.maxScore === undefined,
        `Non-DONE task must not contain maxScore: ${rawTask.maxScore}`
      );
      requireValue(
        rawTask.criteria === null ||
          rawTask.criteria === undefined ||
          (Array.isArray(rawTask.criteria) && rawTask.criteria.length === 0),
        'Non-DONE task must have empty criteria'
      );
      requireValue(
        rawTask.correctedEssay === null || rawTask.correctedEssay === undefined,
        'Non-DONE task must not have correctedEssay'
      );
      requireValue(
        rawTask.overallFeedback === null || rawTask.overallFeedback === undefined,
        'Non-DONE task must not have overallFeedback'
      );
      requireValue(
        rawTask.corrections === null ||
          rawTask.corrections === undefined ||
          (Array.isArray(rawTask.corrections) && rawTask.corrections.length === 0),
        'Non-DONE task must have empty corrections'
      );
      requireValue(
        rawTask.diff === null ||
          rawTask.diff === undefined ||
          (Array.isArray(rawTask.diff) && rawTask.diff.length === 0),
        'Non-DONE task must have empty diff'
      );
      requireValue(
        rawTask.visualObservations === null || rawTask.visualObservations === undefined,
        'Non-DONE task must not have visualObservations'
      );

      if (rawTask.originalText !== null && rawTask.originalText !== undefined) {
        requireValue(
          typeof rawTask.originalText === 'string',
          `Non-DONE task originalText must be a string or null/omitted: ${rawTask.originalText}`
        );
      }
      const originalText = typeof rawTask.originalText === 'string' ? rawTask.originalText : null;

      validatedTasks.push({
        questionId,
        label,
        status,
        wordCount,
        language,
        source,
        scoreUnit,
        overall: null,
        maxScore: null,
        criteria: [],
        originalText,
        overallFeedback: null,
        correctedEssay: null,
        corrections: [],
        diff: [],
        reasonCode,
        displayMessage,
        hasVisualContext,
        visualObservations: null,
      });
    }
  }

  // 4. partStatus consistency validation
  const calculatedPartStatus = computeExpectedPartStatus(validatedTasks);
  requireValue(
    data.partStatus === calculatedPartStatus,
    `Response partStatus (${data.partStatus}) does not match aggregated task statuses (${calculatedPartStatus})`
  );

  return {
    attemptId: expectedAttemptId,
    partId: expectedPartId,
    attemptStatus,
    partStatus: calculatedPartStatus,
    tasks: validatedTasks,
  };
}
