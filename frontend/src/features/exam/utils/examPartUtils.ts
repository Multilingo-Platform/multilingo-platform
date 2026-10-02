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

  // 1. Trích xuất số từ title nếu có (ví dụ: "Writing Task 1" -> 1, "Reading Part 2" -> 2)
  const partTitle = currentPart?.title || currentPart?.content?.part_title || '';
  const titleNumberMatch = partTitle.match(/(?:Task|Passage|Part|Section)\s*(\d+)/i);

  let currentNumber = 1;
  if (titleNumberMatch?.[1]) {
    currentNumber = parseInt(titleNumberMatch[1], 10);
  } else {
    // 2. Tìm vị trí index trong section hiện tại
    const currentId = currentPart?.id ?? currentPart?.part_id;
    const indexInSection = partsInCurrentSection.findIndex(p => (p?.id ?? p?.part_id) === currentId);
    if (indexInSection >= 0) {
      currentNumber = indexInSection + 1;
    } else if (typeof currentPart?.part_number === 'number' && currentPart.part_number > 0) {
      currentNumber = currentPart.part_number;
    } else {
      const indexInAll = allParts.findIndex(p => (p?.id ?? p?.part_id) === currentId);
      currentNumber = indexInAll >= 0 ? indexInAll + 1 : 1;
    }
  }

  return {
    unitLabel,
    currentNumber,
    totalCount,
    displayText: `${unitLabel} ${currentNumber} / ${totalCount}`,
  };
}
