export interface PartHeaderInfo {
  unitLabel: string;
  currentNumber: number;
  totalCount: number;
  displayText: string;
}

/**
 * Trích xuất ngưỡng số từ tối thiểu (minWords) cho câu hỏi Writing.
 * Ưu tiên:
 * 1. Thuộc tính metadata min_words / minWords từ question hoặc part.
 * 2. Regex phân tích văn bản từ question_text, prompt, instruction.
 * 3. Fallback: Task 2 -> 250 từ; Task 1 hoặc mặc định -> 150 từ.
 */
export function extractMinWords(question?: any, part?: any): number {
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

  // Fallback theo Task 2 vs Task 1
  const isTask2 = /task\s*2/i.test(part?.title ?? '') ||
    /task\s*2/i.test(part?.content?.part_title ?? '') ||
    /task\s*2/i.test(question?.question_text ?? '');

  return isTask2 ? 250 : 150;
}

/**
 * Tính toán đơn vị kỹ năng và số thứ tự động cho header làm bài thi.
 * - WRITING: 'Task'
 * - READING: 'Passage'
 * - LISTENING / SPEAKING / Khác: 'Part'
 * Mẫu số là tổng số phần trong kỹ năng/section hiện tại.
 */
export function getPartHeaderInfo(
  currentSkill: string,
  currentPart?: any,
  sectionParts: any[] = [],
  allParts: any[] = []
): PartHeaderInfo {
  const normalizedSkill = (currentSkill || '').toUpperCase();
  const unitLabel = normalizedSkill === 'WRITING'
    ? 'Task'
    : normalizedSkill === 'READING'
      ? 'Passage'
      : 'Part';

  const partsInCurrentSection = Array.isArray(sectionParts) && sectionParts.length > 0
    ? sectionParts
    : (Array.isArray(allParts) && allParts.length > 0 ? allParts : []);

  const totalCount = partsInCurrentSection.length || 1;

  // 1. Trích xuất số từ title nếu có (ví dụ: "Writing Task 1" -> 1, "Reading Passage 2" -> 2,
  //    "Part 5" -> 5). Title ưu tiên trước part_number vì IELTS đánh số cục bộ theo kỹ năng
  //    ("Reading Passage 1", "Writing Task 2") trong khi part_number là số toàn đề 1..9.
  const partTitle = currentPart?.title || currentPart?.content?.part_title || '';
  const titleNumberMatch = partTitle.match(/(?:Task|Passage|Part|Section)\s*(\d+)/i);

  // 2. Số Part tường minh (part_number/partNumber) là nguồn chính xác khi title không chứa số
  //    (ví dụ TOEIC title "Photographs"/"Text Completion").
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

  return {
    unitLabel,
    currentNumber,
    totalCount,
    displayText: `${unitLabel} ${currentNumber} / ${totalCount}`,
  };
}
