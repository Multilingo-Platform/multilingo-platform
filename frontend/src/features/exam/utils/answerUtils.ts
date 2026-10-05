import type { QuestionType } from '../types/exam.types';

/**
 * Kiểm tra xem một câu hỏi đã thực sự được người dùng trả lời hay chưa.
 *
 * Quy chuẩn:
 * - null / undefined => false
 * - string (ESSAY, FILL_IN, MCQ đơn, TFNG...): trim().length > 0
 * - string[] (MULTIPLE_CHOICE): length > 0 và có ít nhất 1 phần tử có nội dung thực tế
 * - object (MATCHING, LABELING): có ít nhất 1 cặp giá trị không rỗng
 */
export function isAnswered(value: unknown, _type?: QuestionType): boolean {
  if (value == null) return false;

  // Xử lý chuỗi văn bản (Writing, Fill-in, Single Choice, TFNG...)
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  // Xử lý mảng (Multiple Choice / Chọn nhiều đáp án)
  if (Array.isArray(value)) {
    return (
      value.length > 0 &&
      value.some(item =>
        typeof item === 'string' ? item.trim().length > 0 : item != null
      )
    );
  }

  // Xử lý object / key-value map (Matching, Map Labeling, Diagram Labeling)
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(v =>
      typeof v === 'string' ? v.trim().length > 0 : v != null && v !== ''
    );
  }

  return false;
}
