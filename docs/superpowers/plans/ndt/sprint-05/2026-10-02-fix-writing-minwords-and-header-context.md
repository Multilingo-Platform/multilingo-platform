# Fix Writing MinWords & Header Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Giải quyết triệt để 2 phát hiện phụ ở Mục 9 trong giao diện làm bài thi: tự động trích xuất ngưỡng từ tối thiểu (`minWords`) từ nội dung đề thi thay vì hardcode 150/250, và hiển thị nhãn header động theo ngữ cảnh kỹ năng (`Task X / Y` cho Writing, `Passage X / Y` cho Reading, `Part X / Y` cho Listening/Speaking) với mẫu số là tổng số phần trong kỹ năng hiện tại thay vì toàn bài thi.

**Architecture:** Tạo module tiện ích `examPartUtils.ts` chứa hàm trích xuất regex/metadata `extractMinWords` và hàm tính toán nhãn hiển thị header `getPartHeaderInfo`. Tích hợp vào `WorkspacePage.tsx` thay thế toàn bộ logic hardcode cũ. Kiểm thử TDD với Vitest và kiểm chứng trực quan bằng browser subagent.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tailwind CSS, Vite.

**Spec:** Section 9 ("Phát hiện phụ") trong Bug Brief `BUG-S05-WRITING-EMPTY-ANSWER` và tài liệu Sprint 05 CBT Workspace (`docs/superpowers/specs/ndt/2026-09-30-sprint03-autosave-timer-design.md`).

## Global Constraints

- Không sửa đổi cấu trúc dữ liệu backend hay phá vỡ Redux state contract đã định hình ở Sprint 05.
- Hàm `extractMinWords` phải an toàn tuyệt đối với dữ liệu rỗng, `null`, `undefined` và hỗ trợ đa ngôn ngữ (tiếng Anh & tiếng Việt: `words`, `từ`, `minimum`, `at least`, `tối thiểu`, `ít nhất`).
- Header badge phải thể hiện đúng số thứ tự và tổng số phần của kỹ năng/section hiện tại (ví dụ: `Task 1 / 2`), không được lấy tổng số part của toàn bộ bài thi đa kỹ năng (như `Passage 7 / 7`).
- Mọi thay đổi phải vượt qua `npm --prefix frontend test`, `npm --prefix frontend run build`, và `./mvnw test`.

## Review Focus

1. Câu hỏi Writing Task 1 có ghi `(Minimum 100 words)` nhưng tiêu chuẩn IELTS Task 1 là 150: hàm phải ưu tiên lấy đúng `100` từ đề bài.
2. Câu hỏi Writing không ghi rõ số từ nhưng thuộc Task 2: hàm phải fallback chuẩn xác về `250` từ.
3. Đề thi Full Mock Test có 7 parts (3 Reading, 2 Listening, 2 Writing): khi làm Writing Task 1, header badge phải hiển thị `Task 1 / 2` (hoặc `Task 2 / 2`), tuyệt đối không hiển thị `Passage 7 / 7`.
4. Khi chuyển đổi giữa các kỹ năng trong cùng 1 bài thi (Reading -> Listening -> Writing), nhãn header phải tự động chuyển từ `Passage X / 3` -> `Part X / 2` -> `Task X / 2`.
5. Đề thi Practice Mode (chỉ gồm 1 Part duy nhất): header badge hiển thị `Task 1 / 1` (hoặc `Passage 1 / 1`) mà không gây chia cho 0 hoặc lỗi NaN.

---

### Task 1: Tạo Module Tiện Ích `examPartUtils.ts` (TDD)

**Files:**
- Create: `frontend/src/features/exam/utils/examPartUtils.ts`
- Test: `frontend/src/features/exam/__tests__/examPartUtils.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PartHeaderInfo {
    unitLabel: string;      // 'Task' | 'Passage' | 'Part'
    currentNumber: number;  // 1-based index or extracted number
    totalCount: number;     // total parts in current skill/section
    displayText: string;    // e.g. 'Task 1 / 2'
  }

  export function extractMinWords(question?: any, part?: any): number;
  export function getPartHeaderInfo(
    currentSkill: string,
    currentPart?: any,
    sectionParts?: any[],
    allParts?: any[]
  ): PartHeaderInfo;
  ```

- [ ] **Step 1: Viết test case ban đầu cho `examPartUtils.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { extractMinWords, getPartHeaderInfo } from '../utils/examPartUtils';

describe('extractMinWords', () => {
  it('extracts minWords from explicit question metadata properties', () => {
    expect(extractMinWords({ min_words: 120 })).toBe(120);
    expect(extractMinWords({ minWords: 180 })).toBe(180);
    expect(extractMinWords({}, { min_words: 200 })).toBe(200);
    expect(extractMinWords({}, { minWords: 220 })).toBe(220);
  });

  it('extracts minWords from question_text with "(Minimum 100 words)"', () => {
    const q = {
      question_text: 'Summarize the key trends shown in global language adoption over the past 20 years. (Minimum 100 words)',
    };
    expect(extractMinWords(q)).toBe(100);
  });

  it('extracts minWords from various English phrasing variations', () => {
    expect(extractMinWords({ question_text: 'Write at least 250 words about climate change.' })).toBe(250);
    expect(extractMinWords({ prompt: 'Write a minimum of 200 words.' })).toBe(200);
    expect(extractMinWords({ question_text: 'Complete the response (min 80 words).' })).toBe(80);
    expect(extractMinWords({ question_text: '120 words minimum required.' })).toBe(120);
    expect(extractMinWords({ question_text: 'You must write 300 words or more.' })).toBe(300);
  });

  it('extracts minWords from Vietnamese phrasing variations', () => {
    expect(extractMinWords({ question_text: 'Viết bài luận tối thiểu 150 từ về chủ đề sau.' })).toBe(150);
    expect(extractMinWords({ prompt: 'Thí sinh viết ít nhất 250 từ.' })).toBe(250);
    expect(extractMinWords({}, { instruction: 'Số lượng từ tối thiểu: 100 từ' })).toBe(100);
  });

  it('falls back to 250 for Task 2 when no explicit word count is found', () => {
    expect(extractMinWords({ question_text: 'Discuss both views.' }, { title: 'Writing Task 2' })).toBe(250);
    expect(extractMinWords({ question_text: 'Writing Task 2 Essay Question' })).toBe(250);
    expect(extractMinWords({}, { content: { part_title: 'IELTS Writing Task 2' } })).toBe(250);
  });

  it('falls back to 150 for Task 1 or general Writing when no word count is found', () => {
    expect(extractMinWords({ question_text: 'Describe the chart.' }, { title: 'Writing Task 1' })).toBe(150);
    expect(extractMinWords(null, null)).toBe(150);
  });
});

describe('getPartHeaderInfo', () => {
  const fullExamParts = [
    { id: 1, title: 'Reading Part 1' },
    { id: 2, title: 'Reading Part 2' },
    { id: 3, title: 'Reading Part 3' },
    { id: 4, title: 'Listening Part 1' },
    { id: 5, title: 'Listening Part 2' },
    { id: 6, title: 'Writing Task 2' },
    { id: 7, title: 'Writing Task 1' },
  ];

  it('formats WRITING skill correctly with Task label and section part count', () => {
    const writingSectionParts = [
      { id: 6, title: 'Writing Task 2' },
      { id: 7, title: 'Writing Task 1' },
    ];

    const resultTask1 = getPartHeaderInfo('WRITING', writingSectionParts[1], writingSectionParts, fullExamParts);
    expect(resultTask1).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Task 1 / 2',
    });

    const resultTask2 = getPartHeaderInfo('WRITING', writingSectionParts[0], writingSectionParts, fullExamParts);
    expect(resultTask2).toEqual({
      unitLabel: 'Task',
      currentNumber: 2,
      totalCount: 2,
      displayText: 'Task 2 / 2',
    });
  });

  it('formats READING skill correctly with Passage label and section part count', () => {
    const readingSectionParts = [
      { id: 1, title: 'Reading Part 1' },
      { id: 2, title: 'Reading Part 2' },
      { id: 3, title: 'Reading Part 3' },
    ];

    const result = getPartHeaderInfo('READING', readingSectionParts[1], readingSectionParts, fullExamParts);
    expect(result).toEqual({
      unitLabel: 'Passage',
      currentNumber: 2,
      totalCount: 3,
      displayText: 'Passage 2 / 3',
    });
  });

  it('formats LISTENING skill correctly with Part label', () => {
    const listeningSectionParts = [
      { id: 4, title: 'Listening Part 1' },
      { id: 5, title: 'Listening Part 2' },
    ];

    const result = getPartHeaderInfo('LISTENING', listeningSectionParts[0], listeningSectionParts, fullExamParts);
    expect(result).toEqual({
      unitLabel: 'Part',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Part 1 / 2',
    });
  });

  it('handles single-part practice mode gracefully', () => {
    const singlePart = { id: 7, title: 'Writing Task 1' };
    const result = getPartHeaderInfo('WRITING', singlePart, [singlePart], [singlePart]);
    expect(result).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 1,
      displayText: 'Task 1 / 1',
    });
  });

  it('falls back to index in section when title does not contain a number', () => {
    const customSectionParts = [
      { id: 10, title: 'Essay Analysis' },
      { id: 11, title: 'Summary Report' },
    ];
    const result = getPartHeaderInfo('WRITING', customSectionParts[0], customSectionParts, customSectionParts);
    expect(result).toEqual({
      unitLabel: 'Task',
      currentNumber: 1,
      totalCount: 2,
      displayText: 'Task 1 / 2',
    });
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npm --prefix frontend test frontend/src/features/exam/__tests__/examPartUtils.test.ts`  
Expected: FAIL với lỗi file hoặc module `../utils/examPartUtils` không tồn tại.

- [ ] **Step 3: Viết mã nguồn cho `examPartUtils.ts` (Green)**

```ts
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
```

- [ ] **Step 4: Chạy test để xác nhận hoàn tất Task 1**

Run: `npm --prefix frontend test frontend/src/features/exam/__tests__/examPartUtils.test.ts`  
Expected: PASS 100% (toàn bộ test cases cho `extractMinWords` và `getPartHeaderInfo` đều xanh lá).

- [ ] **Step 5: Git Commit Task 1**

```bash
git add frontend/src/features/exam/utils/examPartUtils.ts frontend/src/features/exam/__tests__/examPartUtils.test.ts
git commit -m "feat(exam): add examPartUtils for dynamic minWords and skill header context"
```

---

### Task 2: Tích Hợp Vào `WorkspacePage.tsx` và Viết Component Tests

**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Modify: `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`

**Interfaces:**
- Consumes: `extractMinWords`, `getPartHeaderInfo` từ `examPartUtils.ts`.
- Updates:
  - Header badge: Thay `Passage {currentPartNumber} / {allParts.length}` bằng `{partHeaderInfo.displayText}`.
  - Left pane title: Thay `Passage ${currentPartNumber}` fallback bằng `${partHeaderInfo.unitLabel} ${partHeaderInfo.currentNumber}`.
  - Right pane `minWords`: Thay `const minWords = isTask2 ? 250 : 150` bằng `extractMinWords(q, currentPart)`.

- [ ] **Step 1: Viết 2 component test mới vào `WorkspacePage.test.tsx`**

```tsx
  it('renders dynamic skill header "Task 1 / 2" instead of "Passage 7 / 7" when in Writing section', async () => {
    const mockWritingWorkspace = {
      attempt_id: 1,
      status: 'IN_PROGRESS',
      test_scope: 'FULL_EXAM',
      test_mode: 'MOCK_TEST',
      deadline: null,
      serverTimeOffset: 0,
      saved_answers: [],
      version: 1,
      exam_snapshot: {
        exam_id: 1,
        code: 'IE01',
        title: 'IELTS Mock Test – Full',
        type: 'IELTS',
        sections: [
          {
            id: 1,
            skill_type: 'READING',
            title: 'Reading',
            duration_minutes: 60,
            parts: [{ id: 1, title: 'Reading Part 1' }, { id: 2, title: 'Reading Part 2' }, { id: 3, title: 'Reading Part 3' }],
          },
          {
            id: 2,
            skill_type: 'WRITING',
            title: 'Writing',
            duration_minutes: 60,
            parts: [{ id: 6, title: 'Writing Task 2' }, { id: 7, title: 'Writing Task 1' }],
          },
        ],
      },
    };

    vi.mocked(attemptApi.getWorkspace).mockResolvedValueOnce(mockWritingWorkspace as any);

    renderWithProviders(<WorkspacePage />);

    // Chờ tải xong và chọn Writing Task 1
    const task1Btn = await screen.findByRole('button', { name: /writing task 1/i });
    fireEvent.click(task1Btn);

    // Header badge phải hiển thị "Task 1 / 2"
    const headerBadge = screen.getByTestId('header-part-badge');
    expect(headerBadge.textContent).toBe('Task 1 / 2');
    expect(headerBadge.textContent).not.toContain('Passage');
  });

  it('passes dynamic minWords extracted from question text to EssayRenderer', async () => {
    const mockWritingWorkspace = {
      attempt_id: 1,
      status: 'IN_PROGRESS',
      test_scope: 'FULL_EXAM',
      test_mode: 'MOCK_TEST',
      deadline: null,
      serverTimeOffset: 0,
      saved_answers: [],
      version: 1,
      exam_snapshot: {
        exam_id: 1,
        code: 'IE01',
        title: 'IELTS Mock Test',
        type: 'IELTS',
        sections: [
          {
            id: 2,
            skill_type: 'WRITING',
            title: 'Writing',
            duration_minutes: 60,
            parts: [
              {
                id: 7,
                title: 'Writing Task 1',
                questions: [
                  {
                    id: 9,
                    question_id: 'q_9',
                    question_number: 9,
                    type: 'ESSAY',
                    question_text: 'Summarize the key trends shown in global language adoption. (Minimum 100 words)',
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    vi.mocked(attemptApi.getWorkspace).mockResolvedValueOnce(mockWritingWorkspace as any);

    renderWithProviders(<WorkspacePage />);

    // Kiểm tra bộ đếm từ của EssayRenderer hiển thị đúng 100 từ tối thiểu thay vì 150
    expect(await screen.findByText(/0 \/ 100 từ/i)).toBeDefined();
  });
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `npm --prefix frontend test frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`  
Expected: FAIL do chưa có testid `header-part-badge` hoặc header badge vẫn ghi `Passage` và minWords vẫn là `150`.

- [ ] **Step 3: Cập nhật `WorkspacePage.tsx` (Green)**

1. Import `extractMinWords` và `getPartHeaderInfo` từ `../utils/examPartUtils`.
2. Tính toán `partHeaderInfo`:
```tsx
  const partHeaderInfo = useMemo(() => {
    return getPartHeaderInfo(currentSkill, currentPart, currentSection?.parts, allParts);
  }, [currentSkill, currentPart, currentSection, allParts]);

  const partTitle = currentPart?.title || currentPart?.content?.part_title || `${partHeaderInfo.unitLabel} ${partHeaderInfo.currentNumber}`;
```
3. Cập nhật header badge (dòng ~300):
```tsx
            {allParts.length > 0 && (
              <span
                data-testid="header-part-badge"
                className="badge-orange shrink-0 hidden md:inline-flex"
              >
                {partHeaderInfo.displayText}
              </span>
            )}
```
4. Cập nhật dòng ~442:
```tsx
  const minWords = extractMinWords(q, currentPart);
```

- [ ] **Step 4: Chạy test để xác nhận test vượt qua (Green)**

Run: `npm --prefix frontend test frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`  
Expected: PASS toàn bộ các test cases.

- [ ] **Step 5: Git Commit Task 2**

```bash
git add frontend/src/features/exam/pages/WorkspacePage.tsx frontend/src/features/exam/__tests__/WorkspacePage.test.tsx
git commit -m "fix(exam): adapt header context label and dynamic minWords in workspace"
```

---

### Task 3: Chạy Toàn Bộ Bộ Kiểm Thử & Kiểm Chứng Trình Duyệt Thực Tế

**Files:**
- Toàn bộ source code frontend & backend

- [ ] **Step 1: Kiểm thử toàn bộ frontend test suites**
Run: `npm --prefix frontend test`  
Expected: 18/18 test files passed (100% PASS).

- [ ] **Step 2: Kiểm thử build production frontend**
Run: `npm --prefix frontend run build`  
Expected: 0 lỗi TypeScript, build thành công.

- [ ] **Step 3: Kiểm thử toàn bộ backend test suites**
Run: `powershell -Command "$env:JAVA_HOME = 'C:\Program Files\Java\jdk-21.0.12'; ./mvnw test"`  
Expected: 109/109 tests passed, `BUILD SUCCESS`.

- [ ] **Step 4: Dùng `browser_subagent` kiểm chứng trực tiếp trên trình duyệt**
- Mở `http://localhost:5173/exams/1/start`, nhấn "Bắt đầu làm bài".
- Chuyển sang phần thi "Writing Task 1".
- Chụp ảnh màn hình kiểm chứng:
  1. Header góc trái trên: Hiển thị badge **`Task 1 / 2`** (thay vì `Passage 7 / 7`).
  2. Footer của khung soạn thảo Writing Task 1: Hiển thị **`0 / 100 từ`** (thay vì `0 / 150 từ`).
  3. Chuyển sang "Writing Task 2": Header hiển thị **`Task 2 / 2`** và footer hiển thị **`0 / 150 từ`** (đúng theo đề bài `Minimum 150 words`).

---

## Self-Review Checklist

- [x] **Spec Coverage:** Khắc phục đầy đủ cả 2 mục trong Phát hiện phụ (Mục 9).
- [x] **Placeholder Scan:** Không có TODO, TBD, hay code mô tả chung chung; toàn bộ code snippets đều cụ thể.
- [x] **Type Consistency:** Hàm `extractMinWords` và `getPartHeaderInfo` có kiểu dữ liệu TypeScript nhất quán.
- [x] **Review Focus:** Đã bao phủ 5 tình huống biên (Task 1 100 từ, Task 2 150 từ, chuyển tab kỹ năng, practice mode 1 part).
