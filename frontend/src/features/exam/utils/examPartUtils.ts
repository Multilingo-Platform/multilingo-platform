export interface PartHeaderInfo {
  unitLabel: string;
  currentNumber: number;
  totalCount: number;
  displayText: string;
}

/**
 * Safely extracts all questions from a part, supporting grouped canonical questions
 * (e.g. `question_groups`, `questionGroups`, or within `contentData` / `content`)
 * and falling back to a flat `questions` list.
 */
export function extractPartQuestions(part: any): any[] {
  if (!part) return [];

  const groups =
    part.question_groups ??
    part.questionGroups ??
    part.contentData?.question_groups ??
    part.contentData?.questionGroups ??
    part.content?.question_groups ??
    part.content?.questionGroups;

  if (Array.isArray(groups) && groups.length > 0) {
    const flattened = groups.flatMap((group: any) =>
      Array.isArray(group?.questions) ? group.questions : []
    );
    if (flattened.length > 0) {
      return flattened;
    }
  }

  if (Array.isArray(part.questions) && part.questions.length > 0) {
    return part.questions;
  }
  if (Array.isArray(part.contentData?.questions) && part.contentData.questions.length > 0) {
    return part.contentData.questions;
  }
  if (Array.isArray(part.content?.questions) && part.content.questions.length > 0) {
    return part.content.questions;
  }

  return [];
}

/**
 * Returns the declared part number (1..N) if valid.
 */
export function declaredPartNumber(part: any): number | null {
  const raw = part?.part_number ?? part?.partNumber;
  return typeof raw === 'number' && Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

/**
 * Extracts a numeric question number from the tail of a question id (e.g. "q_042" -> 42).
 */
export function parseQuestionNumberFromId(questionId: unknown): number | null {
  if (typeof questionId !== 'string') return null;
  const trimmed = questionId.trim();
  const match = /(\d+)$/.exec(trimmed);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

/**
 * Detects whether two adjacent questions in a group represent an IELTS / Cambridge multi-choice
 * pair (where two consecutive question slots share a 2-answer question).
 */
export function isMultiChoicePair(q1?: any | null, q2?: any | null): boolean {
  if (!q1 || !q2) return false;
  // Explicit multi-choice pair type
  if (q1.type === 'MULTIPLE_CHOICE_MULTI' && q2.type === 'MULTIPLE_CHOICE_MULTI') {
    return true;
  }
  
  const text1 = (q1.question_text || '').trim();
  const text2 = (q2.question_text || '').trim();
  const isIdenticalText = Boolean(text1 && text1 === text2);
  const hasTwoKeyword = /choose\s+two|chọn\s+2|which\s+two/i.test(text1) || /choose\s+two|chọn\s+2|which\s+two/i.test(text2);
  const hasRange = /questions?\s*\d+\s*[-–]\s*\d+|câu\s*\d+\s*[-–]\s*\d+/i.test(text1) || /questions?\s*\d+\s*[-–]\s*\d+|câu\s*\d+\s*[-–]\s*\d+/i.test(text2);

  // Shared answer_group id (e.g. Cambridge IELTS v2 datasets, IeltsExcelV2ExamParser)
  const g1 = q1.answer_group?.id ?? q1.metadata?.answer_group?.id;
  const g2 = q2.answer_group?.id ?? q2.metadata?.answer_group?.id;
  const ids1 = q1.answer_group?.question_ids ?? q1.metadata?.answer_group?.question_ids;
  const ids2 = q2.answer_group?.question_ids ?? q2.metadata?.answer_group?.question_ids;
  const hasSharedGroup = Boolean((g1 && g2 && g1 === g2) || (Array.isArray(ids1) && Array.isArray(ids2) && ids1.includes(q2.question_id) && ids2.includes(q1.question_id)));

  if (hasSharedGroup) {
    return true;
  }

  // Range/Text matching in IELTS ("Question 17-18: Which TWO..." or "Choose TWO letters")
  if (isIdenticalText && (hasTwoKeyword || hasRange)) {
    return true;
  }
  return false;
}

/**
 * Trích xuất ngưỡng số từ tối thiểu (minWords) cho câu hỏi Writing.
 * Ưu tiên:
 * 1. Thuộc tính metadata min_words / minWords từ question hoặc part.
 * 2. Regex phân tích văn bản từ question_text, prompt, instruction.
 * 3. Fallback: Task 2 -> 250 từ; Task 1 hoặc mặc định -> 150 từ.
 */
export function extractMinWords(question?: any, part?: any, examType?: string): number {
  if (typeof question?.min_words === 'number' && question.min_words > 0) return question.min_words;
  if (typeof question?.minWords === 'number' && question.minWords > 0) return question.minWords;
  if (typeof part?.min_words === 'number' && part.min_words > 0) return part.min_words;
  if (typeof part?.minWords === 'number' && part.minWords > 0) return part.minWords;

  const textsToSearch = [
    question?.question_text,
    question?.prompt,
    part?.instruction,
    part?.content?.instruction,
    part?.title,
    part?.content?.part_title,
  ].filter(Boolean).join(' ');

  // Pattern 1: "(Minimum 100 words)", "at least 250 words", "tối thiểu 150 từ", "min 80 words", "minimum of 200 words"
  const matchPattern1 = textsToSearch.match(/(?:minimum|min|at\s+least|ít\s+nhất|tối\s+thiểu)\s*(?:of\s*)?[:\s]*(\d+)\s*(?:words|từ)/i);
  if (matchPattern1?.[1]) {
    const parsed = parseInt(matchPattern1[1], 10);
    if (parsed > 0) return parsed;
  }

  // Pattern 2: "120 words minimum", "300 words or more"
  const matchPattern2 = textsToSearch.match(/(\d+)\s*(?:words|từ)\s*(?:minimum|or\s+more)/i);
  if (matchPattern2?.[1]) {
    const parsed = parseInt(matchPattern2[1], 10);
    if (parsed > 0) return parsed;
  }

  // Generic language-practice tasks have no implicit certification minimum.
  if (examType === 'LANGUAGE_PRACTICE') return 0;

  // Fallback theo Task 2 vs Task 1
  const isTask2 = /task\s*2/i.test(part?.title ?? '') ||
    /task\s*2/i.test(part?.content?.part_title ?? '') ||
    /task\s*2/i.test(question?.question_text ?? '');

  return isTask2 ? 250 : 150;
}

/**
 * Tính toán đơn vị kỹ năng và số thứ tự động cho header làm bài thi.
 * - WRITING: 'Task'
 * - READING: 'Passage' (hoặc 'Part' nếu thi TOEIC)
 * - LISTENING / SPEAKING / Khác: 'Part'
 * Mẫu số là tổng số phần trong kỹ năng/section hiện tại hoặc toàn bài thi.
 */
export function getPartHeaderInfo(
  currentSkill: string,
  currentPart?: any,
  sectionParts: any[] = [],
  allParts: any[] = [],
  examType?: string
): PartHeaderInfo {
  const normalizedSkill = (currentSkill || '').toUpperCase();
  const normalizedExamType = (examType || '').toUpperCase();
  const isToeic = normalizedExamType.includes('TOEIC');

  let unitLabel = normalizedSkill === 'WRITING'
    ? 'Task'
    : normalizedSkill === 'READING'
      ? 'Passage'
      : 'Part';

  if (isToeic) {
    unitLabel = 'Part';
  }

  const partsInCurrentSection = Array.isArray(sectionParts) && sectionParts.length > 0
    ? sectionParts
    : (Array.isArray(allParts) && allParts.length > 0 ? allParts : []);

  let totalCount = partsInCurrentSection.length || 1;

  const partTitle = currentPart?.title || currentPart?.content?.part_title || '';
  const titleNumberMatch = partTitle.match(/(?:Task|Passage|Part|Section|Phần)\s*(\d+)/i);

  // 1. Trích xuất số từ title nếu có (ví dụ: "Writing Task 1" -> 1, "Reading Passage 2" -> 2,
  //    "Part 5" -> 5). Title ưu tiên trước part_number vì IELTS đánh số cục bộ theo kỹ năng
  //    ("Reading Passage 1", "Writing Task 2") trong khi part_number là số toàn đề 1..9.
  const declaredRaw = currentPart?.part_number ?? currentPart?.partNumber;
  const declaredPartNumber =
    typeof declaredRaw === 'number' && Number.isSafeInteger(declaredRaw) && declaredRaw > 0 ? declaredRaw : null;

  const currentId = currentPart?.id ?? currentPart?.part_id ?? currentPart?.partId;

  let currentNumber = 1;
  if (titleNumberMatch?.[1]) {
    currentNumber = parseInt(titleNumberMatch[1], 10);
  } else if (declaredPartNumber !== null) {
    currentNumber = declaredPartNumber;
  } else {
    // 3. Tìm vị trí trong toàn đề; không dùng số thứ tự trong section làm số Part.
    const indexInAll = allParts.findIndex(p => (p?.id ?? p?.part_id ?? p?.partId) === currentId);
    if (indexInAll >= 0) {
      currentNumber = indexInAll + 1;
    } else {
      // 4. Fallback cuối cùng: vị trí trong section hiện tại.
      const indexInSection = partsInCurrentSection.findIndex(
        p => (p?.id ?? p?.part_id ?? p?.partId) === currentId
      );
      currentNumber = indexInSection >= 0 ? indexInSection + 1 : 1;
    }
  }

  if (isToeic && allParts.length >= currentNumber) {
    totalCount = allParts.length;
  }

  return {
    unitLabel,
    currentNumber,
    totalCount,
    displayText: `${unitLabel} ${currentNumber} / ${totalCount}`,
  };
}
