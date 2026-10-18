/**
 * TOEIC workspace view model.
 *
 * Projects a workspace exam snapshot into Part/group/question structures that preserve the
 * server Part and group order and give every question a stable whole-exam number (1..200).
 *
 * Numbering rules (mirrored from the backend `ToeicWorkspaceProjection`):
 * - an explicit `question_number` / `questionNumber` is used only when it is a canonical number
 *   for the question's Part;
 * - otherwise the canonical `q_###` id prefix is parsed;
 * - otherwise the question has no number at all.
 *
 * The array index, the section/Part ordinal and the DB `id` are never used as a question number.
 */

export type ToeicWorkspaceIssueCode =
  | 'invalid_snapshot'
  | 'missing_part_id'
  | 'invalid_part_number'
  | 'missing_question_id'
  | 'duplicate_question_id'
  | 'missing_question_number';

export interface ToeicWorkspaceIssue {
  code: ToeicWorkspaceIssueCode;
  partId: number | null;
  questionId: string | null;
  detail: string;
}

export interface ToeicWorkspaceQuestion {
  questionId: string;
  /** Whole-exam number 1..200, or null when no canonical number could be resolved. */
  questionNumber: number | null;
  numberSource: 'explicit' | 'canonical_id' | null;
  partId: number;
  partNumber: number | null;
  groupId: string | null;
}

export interface ToeicWorkspaceGroup {
  groupId: string | null;
  partId: number;
  questions: ToeicWorkspaceQuestion[];
}

export interface ToeicWorkspacePart {
  partId: number;
  partNumber: number | null;
  sectionId: number | null;
  title: string;
  groups: ToeicWorkspaceGroup[];
  /** Questions of the Part in server group order. */
  questions: ToeicWorkspaceQuestion[];
}

export interface ToeicWorkspaceModel {
  parts: ToeicWorkspacePart[];
  /** Every question in server order across Parts and groups, keyed uniquely by question id. */
  questions: ToeicWorkspaceQuestion[];
  valid: boolean;
  issues: ToeicWorkspaceIssue[];
}

/** Canonical TOEIC question ranges per Part. */
export const TOEIC_PART_QUESTION_RANGES: Readonly<Record<number, { min: number; max: number }>> = {
  1: { min: 1, max: 6 },
  2: { min: 7, max: 31 },
  3: { min: 32, max: 70 },
  4: { min: 71, max: 100 },
  5: { min: 101, max: 130 },
  6: { min: 131, max: 146 },
  7: { min: 147, max: 200 },
};

const CANONICAL_QUESTION_ID = /^q_0*([1-9][0-9]*)$/;
const PART_TITLE_NUMBER = /part\s*([1-7])/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asPositiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * Detects a TOEIC snapshot from its explicit exam code/type only (never from the title).
 */
export function isToeicExamSnapshot(snapshot: unknown): boolean {
  if (!isRecord(snapshot)) return false;
  const code = snapshot.code ?? snapshot.exam_code ?? snapshot.examCode;
  if (typeof code === 'string' && code.toUpperCase().includes('TOEIC')) return true;
  const type = snapshot.type ?? snapshot.exam_type ?? snapshot.examType;
  if (typeof type === 'string' && type.toUpperCase().includes('TOEIC')) return true;
  return false;
}

/**
 * Parses the canonical question number from a `q_###` id. Validates the 1..200 whole-exam range
 * and, when the Part number is known, the Part range.
 */
export function parseCanonicalQuestionNumber(
  questionId: unknown,
  partNumber?: number | null
): number | null {
  const id = asNonEmptyString(questionId);
  if (id === null) return null;
  const match = CANONICAL_QUESTION_ID.exec(id);
  if (!match) return null;
  const number = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(number) || number < 1 || number > 200) return null;
  if (partNumber != null) {
    const range = TOEIC_PART_QUESTION_RANGES[partNumber];
    if (range && (number < range.min || number > range.max)) return null;
  }
  return number;
}

function parseExplicitNumber(raw: unknown, partNumber?: number | null): number | null {
  let value: number | null = null;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string' && /^[+-]?\d+$/.test(raw.trim())) {
    value = Number.parseInt(raw.trim(), 10);
  }
  if (value === null || !Number.isSafeInteger(value)) return null;
  // Reuse the canonical rule so explicit numbers cannot escape the 1..200/Part range.
  return parseCanonicalQuestionNumber(`q_${value}`, partNumber ?? null);
}

export interface ResolvedQuestionNumber {
  number: number | null;
  source: 'explicit' | 'canonical_id' | null;
}

/**
 * Resolves the stable whole-exam number for a question without ever using the array index,
 * the Part ordinal or the DB `id`.
 */
export function resolveQuestionNumber(
  question: unknown,
  partNumber?: number | null
): ResolvedQuestionNumber {
  if (!isRecord(question)) return { number: null, source: null };

  const explicit = parseExplicitNumber(question.question_number ?? question.questionNumber, partNumber);
  if (explicit !== null) return { number: explicit, source: 'explicit' };

  const fromId = parseCanonicalQuestionNumber(
    question.question_id ?? question.questionId,
    partNumber ?? null
  );
  if (fromId !== null) return { number: fromId, source: 'canonical_id' };

  return { number: null, source: null };
}

/** Question identity from canonical aliases only; the DB `id` is intentionally ignored. */
export function readQuestionId(question: unknown): string | null {
  if (!isRecord(question)) return null;
  return asNonEmptyString(question.question_id) ?? asNonEmptyString(question.questionId);
}

function readPartId(part: Record<string, unknown>): number | null {
  return asPositiveInt(part.part_id) ?? asPositiveInt(part.partId) ?? asPositiveInt(part.id);
}

function readDeclaredPartNumber(part: Record<string, unknown>): { value: number | null; invalid: boolean } {
  const raw = part.part_number ?? part.partNumber;
  if (raw === undefined || raw === null) return { value: null, invalid: false };

  let number: number | null = null;
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) {
    number = raw;
  } else if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    number = Number.parseInt(raw.trim(), 10);
  }
  if (number === null || number < 1 || number > 7) return { value: null, invalid: true };
  return { value: number, invalid: false };
}

function readPartNumberFromTitle(part: Record<string, unknown>): number | null {
  const title = asNonEmptyString(part.title) ?? asNonEmptyString(part.part_title);
  if (title === null) return null;
  const match = PART_TITLE_NUMBER.exec(title);
  return match ? Number.parseInt(match[1], 10) : null;
}

interface RawGroup {
  groupId: string | null;
  questions: unknown[];
}

function readGroups(part: Record<string, unknown>): RawGroup[] {
  const content = isRecord(part.content) ? part.content : null;
  const groupsRaw =
    part.question_groups ??
    part.questionGroups ??
    content?.question_groups ??
    content?.questionGroups;

  if (Array.isArray(groupsRaw)) {
    const groups: RawGroup[] = [];
    for (const groupRaw of groupsRaw) {
      if (!isRecord(groupRaw)) continue;
      const questionsRaw = groupRaw.questions;
      groups.push({
        groupId: asNonEmptyString(groupRaw.group_id) ?? asNonEmptyString(groupRaw.groupId),
        questions: Array.isArray(questionsRaw) ? questionsRaw : [],
      });
    }
    return groups;
  }

  const flatQuestions = part.questions;
  if (Array.isArray(flatQuestions)) return [{ groupId: null, questions: flatQuestions }];
  return [];
}

/**
 * Builds the TOEIC view model from a workspace exam snapshot. Never mutates the input.
 */
export function buildToeicWorkspaceModel(snapshot: unknown): ToeicWorkspaceModel {
  const parts: ToeicWorkspacePart[] = [];
  const questions: ToeicWorkspaceQuestion[] = [];
  const issues: ToeicWorkspaceIssue[] = [];
  const seenQuestionIds = new Set<string>();

  if (!isRecord(snapshot) || !Array.isArray(snapshot.sections)) {
    issues.push({
      code: 'invalid_snapshot',
      partId: null,
      questionId: null,
      detail: 'Snapshot has no sections array',
    });
    return { parts, questions, valid: false, issues };
  }

  let globalPartOrdinal = 0;

  for (const sectionRaw of snapshot.sections) {
    if (!isRecord(sectionRaw)) continue;
    const sectionId =
      asPositiveInt(sectionRaw.section_id) ?? asPositiveInt(sectionRaw.sectionId) ?? asPositiveInt(sectionRaw.id);
    const sectionParts = sectionRaw.parts;
    if (!Array.isArray(sectionParts)) continue;

    for (const partRaw of sectionParts) {
      globalPartOrdinal += 1;
      if (!isRecord(partRaw)) continue;

      const partId = readPartId(partRaw);
      if (partId === null) {
        issues.push({
          code: 'missing_part_id',
          partId: null,
          questionId: null,
          detail: `Part at exam position ${globalPartOrdinal} has no numeric identity`,
        });
        continue;
      }

      const declared = readDeclaredPartNumber(partRaw);
      if (declared.invalid) {
        issues.push({
          code: 'invalid_part_number',
          partId,
          questionId: null,
          detail: `Part ${partId} declares an invalid part number`,
        });
      }
      const partNumber =
        declared.value ??
        readPartNumberFromTitle(partRaw) ??
        (globalPartOrdinal >= 1 && globalPartOrdinal <= 7 ? globalPartOrdinal : null);

      const modelPart: ToeicWorkspacePart = {
        partId,
        partNumber,
        sectionId,
        title:
          asNonEmptyString(partRaw.title) ??
          asNonEmptyString(partRaw.part_title) ??
          (partNumber !== null ? `Part ${partNumber}` : 'Part'),
        groups: [],
        questions: [],
      };

      for (const group of readGroups(partRaw)) {
        const modelGroup: ToeicWorkspaceGroup = { groupId: group.groupId, partId, questions: [] };

        for (const questionRaw of group.questions) {
          const questionId = readQuestionId(questionRaw);
          if (questionId === null) {
            issues.push({
              code: 'missing_question_id',
              partId,
              questionId: null,
              detail: `Question in Part ${partId} has no usable identity`,
            });
            continue;
          }
          if (seenQuestionIds.has(questionId)) {
            issues.push({
              code: 'duplicate_question_id',
              partId,
              questionId,
              detail: `Duplicate question id ${questionId}`,
            });
            continue;
          }
          seenQuestionIds.add(questionId);

          const resolved = resolveQuestionNumber(questionRaw, partNumber);
          if (resolved.number === null) {
            issues.push({
              code: 'missing_question_number',
              partId,
              questionId,
              detail: `Question ${questionId} has no canonical number`,
            });
          }

          const modelQuestion: ToeicWorkspaceQuestion = {
            questionId,
            questionNumber: resolved.number,
            numberSource: resolved.source,
            partId,
            partNumber,
            groupId: modelGroup.groupId,
          };
          modelGroup.questions.push(modelQuestion);
          modelPart.questions.push(modelQuestion);
          questions.push(modelQuestion);
        }

        modelPart.groups.push(modelGroup);
      }

      parts.push(modelPart);
    }
  }

  return { parts, questions, valid: issues.length === 0, issues };
}
