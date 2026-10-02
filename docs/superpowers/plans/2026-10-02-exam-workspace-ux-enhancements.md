# Exam Workspace UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện 4 trải nghiệm cốt lõi (UX) cho phòng thi CBT: Resizable divider giữa 2 panel (mặc định 50/50), chuyển layout animation 200ms mượt mà, bộ đếm số từ cố định với cảnh báo ngưỡng tối thiểu (Task 1: 150, Task 2: 250 từ), và hệ thống Flag câu hỏi cùng Question Palette 3 trạng thái chuẩn thi thật.

**Architecture:** Sử dụng Redux Toolkit (`answerSlice`) mở rộng để lưu trữ trạng thái flagged questions song song với answers. Tích hợp thanh chia Resizable splitter thuần React (Zero external dependencies) với giới hạn biên an toàn 25%-75% và reset 50/50 qua double click. Áp dụng CSS transition 200ms linh hoạt (tự động tắt khi kéo divider để tránh lag). Chuẩn hóa QuestionPalette hiển thị 3 trạng thái với biểu tượng cờ và tương thích ngược với các test case hiện hành.

**Tech Stack:** React 19, TypeScript, Redux Toolkit, Tailwind CSS v4, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-29-sprint02-exam-workspace-design.md` & yêu cầu bổ sung UX thi CBT.

## Global Constraints

- Không cài đặt thêm thư viện bên ngoài (Zero dependencies) cho phần resizable splitter nhằm tránh xung đột React 19.
- Giữ vững toàn bộ hợp đồng API hiện có của `attemptApi.ts` và luồng autosave/submit.
- Mọi action Redux mới phải có test unit kiểm thử Reducer và Selector tương ứng.
- Đảm bảo Question Palette hoạt động mượt mà cả khi nhận `allParts` lẫn `questions` đơn lẻ (backward-compatible).
- Đảm bảo divider kéo được mượt mà trên desktop (`lg:` breakpoint) và tự động ẩn/co giãn hợp lý trên mobile.

## Review Focus

1. **Divider drag behavior:** Khi kéo divider, nếu con trỏ chuột di chuyển nhanh hoặc ra ngoài trình duyệt, sự kiện `mousemove`/`mouseup` toàn cục vẫn phải được bắt và giải phóng đúng cách (không bị dính trạng thái kéo).
2. **Transition lag vs drag smoothness:** Khi kéo chuột, CSS transition phải bị vô hiệu hóa (`transition-none`) để divider bám sát chuột tức thì; chỉ kích hoạt `transition-[width] duration-200` khi chuyển part hoặc nhấp đúp đặt lại 50/50.
3. **Word count accuracy & threshold detection:** Đếm từ chính xác (loại bỏ khoảng trắng thừa, xử lý newline/tab) và tự động phân biệt đúng Task 1 (150 từ) và Task 2 (250 từ) theo tiêu chuẩn thi IELTS Writing.
4. **Flag persistence & rendering in Palette:** Trạng thái Flag tồn tại độc lập với việc câu hỏi đã trả lời hay chưa (có thể: Chưa làm + Flag, Đã làm + Flag, Đã làm + Không flag, Chưa làm + Không flag).
5. **Palette test compatibility:** Test suite `QuestionPalette.test.tsx` hiện tại bị lỗi do đổi contract `allParts`, Task 3 phải khắc phục để toàn bộ test suite pass 100%.

---

### Task 1: Redux AnswerSlice - Flag State Management

**Files:**
- Modify: `frontend/src/features/exam/store/answerSlice.ts`
- Modify: `frontend/src/features/exam/__tests__/answerSlice.test.ts`

**Interfaces:**
- Consumes: `partId: number`, `questionId: string`
- Produces:
  - Action `toggleFlag({ partId: number, questionId: string })`
  - Action `clearFlags()`
  - Selector `selectFlaggedQuestions(state: RootState): Record<number, Record<string, boolean>>`
  - Selector `selectIsQuestionFlagged(state: RootState, partId: number, questionId: string): boolean`

- [ ] **Step 1: Write failing tests for flag actions and selectors in answerSlice.test.ts**

```typescript
// Thêm vào frontend/src/features/exam/__tests__/answerSlice.test.ts
import { toggleFlag, clearFlags, selectIsQuestionFlagged } from '../store/answerSlice';

it('toggles question flag on and off', () => {
  let state = answerReducer(initialState, toggleFlag({ partId: 1, questionId: 'q_001' }));
  expect(state.flags?.[1]?.['q_001']).toBe(true);

  state = answerReducer(state, toggleFlag({ partId: 1, questionId: 'q_001' }));
  expect(state.flags?.[1]?.['q_001']).toBe(false);
});

it('clears all flags on clearFlags', () => {
  let state = answerReducer(initialState, toggleFlag({ partId: 1, questionId: 'q_001' }));
  state = answerReducer(state, clearFlags());
  expect(state.flags).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/exam/__tests__/answerSlice.test.ts`
Expected: FAIL with "toggleFlag is not defined"

- [ ] **Step 3: Implement flag state in answerSlice.ts**

```typescript
// In AnswerState:
flags: Record<number, Record<string, boolean>>;

// In initialState:
flags: {},

// In reducers:
toggleFlag(state, action: PayloadAction<{ partId: number; questionId: string }>) {
  const { partId, questionId } = action.payload;
  if (!state.flags[partId]) {
    state.flags[partId] = {};
  }
  state.flags[partId][questionId] = !state.flags[partId][questionId];
},
clearFlags(state) {
  state.flags = {};
},

// Selectors:
export function selectIsQuestionFlagged(state: { answers: AnswerState }, partId: number, questionId: string): boolean {
  return !!state.answers.flags?.[partId]?.[questionId];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/exam/__tests__/answerSlice.test.ts`
Expected: PASS (tất cả 19 tests pass)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/store/answerSlice.ts frontend/src/features/exam/__tests__/answerSlice.test.ts
git commit -m "feat(exam): add flag state management in answerSlice"
```

---

### Task 2: EssayRenderer - Fixed Word Count Bar with Threshold Alerts

**Files:**
- Modify: `frontend/src/features/exam/components/renderers/EssayRenderer.tsx`
- Create: `frontend/src/features/exam/__tests__/EssayRenderer.test.tsx`
- Modify: `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx`

**Interfaces:**
- Consumes:
  - `minWords?: number` (Mặc định 150 cho Task 1, 250 cho Task 2)
  - `value: string | null`
  - `onChange: (val: string) => void`
- Produces:
  - Fixed bottom word-counter bar
  - 3 visual states: Neutral (0 từ), Warning (< minWords, badge đỏ/hổ phách kèm icon cảnh báo), Success (>= minWords, badge xanh kèm checkmark)

- [ ] **Step 1: Write failing tests in EssayRenderer.test.tsx**

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EssayRenderer from '../components/renderers/EssayRenderer';

describe('EssayRenderer Word Count & Warning', () => {
  it('shows warning alert when word count is below minimum threshold (Task 1: 150)', () => {
    render(<EssayRenderer value="This is a short essay." onChange={vi.fn()} questionText="Task 1" minWords={150} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveTextContent('5 / 150 từ');
    expect(counter).toHaveAttribute('data-status', 'warning');
  });

  it('shows success badge when word count meets or exceeds threshold', () => {
    const essay = Array(150).fill('word').join(' ');
    render(<EssayRenderer value={essay} onChange={vi.fn()} questionText="Task 1" minWords={150} />);
    const counter = screen.getByTestId('essay-word-count');
    expect(counter).toHaveTextContent('150 / 150 từ (Đạt yêu cầu)');
    expect(counter).toHaveAttribute('data-status', 'success');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/exam/__tests__/EssayRenderer.test.tsx`
Expected: FAIL with "essay-word-count not found"

- [ ] **Step 3: Update EssayRenderer.tsx and QuestionRenderer.tsx**

```typescript
// Trong EssayRenderer.tsx:
interface Props {
  value: string | null;
  onChange: (v: string) => void;
  questionText: string;
  media?: SharedMedia | null;
  minWords?: number;
}

// Render fixed bottom bar với styling:
// - isBelow: text-rose-700 bg-rose-50 border-rose-200
// - isMet: text-emerald-700 bg-emerald-50 border-emerald-200
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/exam/__tests__/EssayRenderer.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/components/renderers/EssayRenderer.tsx frontend/src/features/exam/components/renderers/QuestionRenderer.tsx frontend/src/features/exam/__tests__/EssayRenderer.test.tsx
git commit -m "feat(exam): add fixed word count with threshold warning in EssayRenderer"
```

---

### Task 3: QuestionPalette - 3-State Display (Answered, Unanswered, Flagged) & Dual-Mode Compatibility

**Files:**
- Modify: `frontend/src/features/exam/components/QuestionPalette.tsx`
- Modify: `frontend/src/features/exam/__tests__/QuestionPalette.test.tsx`

**Interfaces:**
- Consumes:
  - `allParts?: any[]` (dành cho chế độ đa part / study4 style)
  - `questions?: Question[]` (dành cho tương thích ngược)
  - `activePartId?: number`, `partId?: number`
  - Redux `state.answers.flags` & `state.answers.answers`
- Produces:
  - 3 visual states cho mỗi cell câu hỏi:
    1. `data-status="answered"` (Đã trả lời, không flag: xanh lá)
    2. `data-status="unanswered"` (Chưa làm, không flag: trắng/viền xám)
    3. `data-status="flagged"` (Được flag: icon cờ ⚑, viền vàng cam nổi bật)
  - Legend 3 trạng thái: Đã làm / Chưa làm / Đánh dấu xem lại (Flag)

- [ ] **Step 1: Update QuestionPalette.test.tsx to test 3-state and compatibility**

```typescript
it('displays flagged status on palette cell when question is flagged', () => {
  const store = makeStore();
  store.dispatch(toggleFlag({ partId: 1, questionId: 'q_002' }));
  render(
    <Provider store={store}>
      <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
    </Provider>
  );
  const cell = screen.getByTestId('palette-q_002');
  expect(cell).toHaveAttribute('data-flagged', 'true');
});
```

- [ ] **Step 2: Run test to verify current failures and new expectation**

Run: `npm test -- src/features/exam/__tests__/QuestionPalette.test.tsx`
Expected: FAIL (TypeError + missing data-flagged)

- [ ] **Step 3: Update QuestionPalette.tsx**

- Hỗ trợ cả 2 dạng props: nếu `allParts` không truyền, tự động bọc `questions` và `partId` thành cấu trúc `allParts`.
- Lấy `flags` từ `state.answers.flags ?? {}`.
- Đối với mỗi câu hỏi `q`:
  - `const isFlagged = !!flags[pId]?.[qId];`
  - `const isAnswered = ...;`
  - Gắn badge cờ ⚑ hoặc border/background màu cam hổ phách khi `isFlagged`.
  - Bổ sung chỉ dẫn Flag vào phần Legend bên dưới.

- [ ] **Step 4: Run test to verify all QuestionPalette tests pass**

Run: `npm test -- src/features/exam/__tests__/QuestionPalette.test.tsx`
Expected: PASS (Toàn bộ test suites của QuestionPalette pass 100%)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/components/QuestionPalette.tsx frontend/src/features/exam/__tests__/QuestionPalette.test.tsx
git commit -m "feat(exam): implement 3-state QuestionPalette with flag support and dual-mode props"
```

---

### Task 4: WorkspacePage - Resizable Split Divider, Smooth Animation & Flag Toggle Button

**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Create/Modify: `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`

**Interfaces:**
- Consumes:
  - User mouse drag events trên thanh divider
  - Redux `toggleFlag`
  - `currentSkill` & `currentPart`
- Produces:
  - Resizable divider giữa Left Pane và Right Pane (default 50/50, min 25%, max 75%, double click reset)
  - `transition-[width] duration-200 ease-in-out` khi chuyển Part/Skill
  - Tự động tắt transition (`transition-none`) khi đang kéo divider để đạt 60fps mượt mà
  - Flag toggle button 🚩 trên mỗi Question Card
  - Tự động tính toán `minWords` (150 cho Task 1, 250 cho Task 2) truyền cho `QuestionRenderer`

- [ ] **Step 1: Write test for WorkspacePage flag toggle & layout classes**

```typescript
it('renders flag toggle button on question card and toggles flagged state', () => {
  // Test click flag button dispatches toggleFlag
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/features/exam/__tests__/WorkspacePage.test.tsx`

- [ ] **Step 3: Implement Resizable Divider & Flag Button in WorkspacePage.tsx**

1. Khai báo state split:
```typescript
const [splitRatio, setSplitRatio] = useState<number>(50);
const [isDraggingSplit, setIsDraggingSplit] = useState(false);
const workspaceContainerRef = useRef<HTMLDivElement>(null);
```
2. Thêm global mouse listeners cho pointermove/pointerup khi `isDraggingSplit` hoạt động:
```typescript
useEffect(() => {
  if (!isDraggingSplit) return;
  const onMouseMove = (e: MouseEvent) => {
    if (!workspaceContainerRef.current) return;
    const rect = workspaceContainerRef.current.getBoundingClientRect();
    const ratio = ((e.clientX - rect.left) / rect.width) * 100;
    if (ratio >= 25 && ratio <= 75) {
      setSplitRatio(ratio);
    }
  };
  const onMouseUp = () => setIsDraggingSplit(false);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  return () => {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
}, [isDraggingSplit]);
```
3. Chèn `Divider` component vào giữa Left Pane và Right Pane với style col-resize và nút vạch kéo.
4. Đặt class `transition-[width] duration-200 ease-in-out` (và `isDraggingSplit ? 'transition-none select-none' : ''`) trên cả 2 pane.
5. Thêm nút Flag cạnh số thứ tự câu hỏi trong danh sách:
```typescript
<button
  type="button"
  onClick={() => dispatch(toggleFlag({ partId, questionId: qId }))}
  className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
    isFlagged
      ? 'bg-amber-100 border-amber-300 text-amber-800'
      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
  }`}
>
  <span>{isFlagged ? '🚩' : '🏳️'}</span>
  <span>{isFlagged ? 'Đã xem lại' : 'Xem lại'}</span>
</button>
```
6. Truyền `minWords` chính xác dựa trên `partTitle` (Task 1: 150, Task 2: 250) vào `QuestionRenderer`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/features/exam/__tests__/WorkspacePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Run all test suites across the frontend**

Run: `npm test -- --run`
Expected: 100% test files pass (13/13 test files passed)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/exam/pages/WorkspacePage.tsx frontend/src/features/exam/__tests__/WorkspacePage.test.tsx
git commit -m "feat(exam): add resizable divider, smooth transitions, and flag button in WorkspacePage"
```

---

### Task 5: Verification & End-to-End Visual Inspection

**Files:**
- Manual / Subagent browser check: `http://localhost:5173/attempts/{attemptId}/workspace`

- [ ] **Step 1: Run frontend test suite to ensure clean build and no regression**
Run: `npm test -- --run`
Expected: PASS

- [ ] **Step 2: Verify in browser**
- Mở bài thi Writing: Thử kéo divider sang phải/trái -> Xác nhận Left Pane mở rộng/thu hẹp mượt mà.
- Nhấp đúp vào divider -> Xác nhận trở lại đúng 50/50.
- Nhập từ vào Writing Task 1: Dưới 150 từ báo đỏ/vàng cảnh báo; đạt >= 150 từ chuyển sang xanh lá.
- Bấm nút Flag ở câu hỏi bất kỳ -> Xem Question Palette đổi màu/hiển thị cờ ngay lập tức.
- Chuyển đổi giữa các Part -> Layout co/giãn mượt mà với hiệu ứng transition 200ms.
