# Sprint 03 — Autosave, Timer & Submit: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp Timer đếm ngược, Autosave polling 15 giây, WorkspaceShell layout, và Submit flow (manual + auto khi hết giờ) vào màn hình làm bài hoàn chỉnh.

**Architecture:** Frontend dùng 2 custom hooks độc lập (`useExamTimer`, `useAutosave`) đọc/ghi Redux `answerSlice` được mở rộng với `isDirty` + `saveStatus`. Backend thêm 2 endpoint (`PUT /answers`, `POST /submit`) vào controller hiện có + 1 `@Scheduled` Cron Job (`AttemptWatchdogService`) finalize bài thi hết hạn. Submit API là idempotent: gọi nhiều lần không chấm điểm 2 lần.

**Tech Stack:**
- Backend: Spring Boot 3.3.4, Spring Scheduling (`@EnableScheduling`), JPA, H2 (test), MockMvc
- Frontend: React 19, Redux Toolkit, TypeScript, Vitest + React Testing Library, `axiosClient` hiện có

**Spec:** `docs/superpowers/specs/2026-09-30-sprint03-autosave-timer-design.md`

## Global Constraints

- Mọi Controller phải trả về `ResponseEntity<ApiResponse<T>>` — theo chuẩn `BaseEntity` đã có.
- Mọi lỗi nghiệp vụ phải ném `AppException(ErrorCode.XYZ)` — `GlobalExceptionHandler` xử lý.
- Frontend: không bao giờ lưu `correct_answer` vào Redux hay localStorage.
- `autosaveAnswers()` chỉ gọi khi `isDirty === true && saveStatus !== 'saving'`.
- Submit API: nếu attempt đã `COMPLETED` → trả HTTP 200 với data cũ, KHÔNG chấm lại.
- Backend Cron Job: chỉ finalize attempt có `status = IN_PROGRESS AND deadline < NOW()`.
- Tất cả test Backend chạy trên H2 in-memory với `@ActiveProfiles("test")`.
- Frontend test: dùng `vi.useFakeTimers()` để kiểm soát interval mà không chờ thực sự.

## Review Focus

1. **Autosave không gọi 2 lần đồng thời** — nếu interval fire trong khi API đang chờ response, phải bỏ qua. Guard: `saveStatus !== 'saving'`.
2. **Timer chính xác sau khi ẩn tab** — `setInterval` của trình duyệt bị throttle xuống 1fps khi tab ẩn. Giải pháp: luôn tính `Date.parse(deadline) - Date.now()`, không dùng biến đếm giây.
3. **localStorage collision** — nhiều bài thi khác nhau không được ghi đè key nhau. Key phải là `exam_draft_${attemptId}`.
4. **Submit idempotency** — FE retry + BE cron có thể submit cùng lúc. Task 4 (BE Submit) phải kiểm tra status trước khi chấm điểm.
5. **Cron Job chạy mỗi 60s** — test đơn vị phải mock `AttemptRepository` và không cần `@SpringBootTest` đầy đủ.

---

## Task 1: Mở rộng `answerSlice` — thêm `isDirty`, `saveStatus`, `lastSavedAt`

**Files:**
- Modify: `frontend/src/features/exam/store/answerSlice.ts`
- Modify (thêm test): `frontend/src/features/exam/__tests__/answerSlice.test.ts`

**Interfaces:**
- Produces: `isDirty: boolean`, `saveStatus: 'idle'|'saving'|'saved'|'error'`, `lastSavedAt: number|null` trong Redux state
- Produces: actions `markSavePending()`, `markSaveSuccess(savedAt: number)`, `markSaveError()`
- Produces: selector `selectSaveStatus(state): { isDirty, saveStatus, lastSavedAt }`

- [ ] **Step 1: Thêm test case kiểm tra `isDirty` tự động bật khi `setAnswer`**

Mở `frontend/src/features/exam/__tests__/answerSlice.test.ts`, thêm vào cuối:

```typescript
describe('isDirty flag', () => {
  it('isDirty starts false', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state.isDirty).toBe(false);
  });

  it('setAnswer marks isDirty = true', () => {
    let state = reducer({ ...initialState, attemptId: 1 }, setAttemptContext({ attemptId: 1, version: 0, savedAnswers: [] }));
    state = reducer(state, setAnswer({ partId: 1, questionId: 'q1', value: 'A' }));
    expect(state.isDirty).toBe(true);
  });

  it('markSaveSuccess resets isDirty to false and sets lastSavedAt', () => {
    let state = reducer({ ...initialState, attemptId: 1, isDirty: true }, markSaveSuccess({ savedAt: 1000 }));
    expect(state.isDirty).toBe(false);
    expect(state.lastSavedAt).toBe(1000);
    expect(state.saveStatus).toBe('saved');
  });

  it('markSaveError keeps isDirty true', () => {
    let state = reducer({ ...initialState, isDirty: true }, markSaveError());
    expect(state.isDirty).toBe(true);
    expect(state.saveStatus).toBe('error');
  });

  it('markSavePending sets saveStatus to saving', () => {
    const state = reducer(initialState, markSavePending());
    expect(state.saveStatus).toBe('saving');
  });

  it('clearAnswers resets isDirty and saveStatus', () => {
    const dirty = { ...initialState, isDirty: true, saveStatus: 'error' as const };
    const state = reducer(dirty, clearAnswers());
    expect(state.isDirty).toBe(false);
    expect(state.saveStatus).toBe('idle');
  });
});
```

- [ ] **Step 2: Chạy test để verify FAIL**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/answerSlice.test.ts
```
Expected: FAIL — `isDirty` property does not exist on type / `markSaveSuccess` not exported.

- [ ] **Step 3: Mở rộng `answerSlice.ts`**

Thay thế nội dung file `frontend/src/features/exam/store/answerSlice.ts`:

```typescript
import { createSlice, createSelector, type PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AnswerState {
  attemptId: number | null;
  version: number;
  /** answers[partId][questionId] = AnswerValue */
  answers: Record<number, Record<string, AnswerValue>>;
  /** true khi có đáp án chưa được autosave lên server thành công */
  isDirty: boolean;
  /** null cho đến lần autosave thành công đầu tiên */
  lastSavedAt: number | null;
  saveStatus: SaveStatus;
}

export const initialState: AnswerState = {
  attemptId: null,
  version: 0,
  answers: {},
  isDirty: false,
  lastSavedAt: null,
  saveStatus: 'idle',
};

const answerSlice = createSlice({
  name: 'answers',
  initialState,
  reducers: {
    setAttemptContext(
      state,
      action: PayloadAction<{ attemptId: number; version: number; savedAnswers: PartAnswers[] }>
    ) {
      const { attemptId, version, savedAnswers } = action.payload;
      state.attemptId = attemptId;
      state.version = version;
      state.answers = {};
      state.isDirty = false;
      state.saveStatus = 'idle';
      for (const part of savedAnswers) {
        state.answers[part.part_id] = {};
        for (const ua of part.answers) {
          state.answers[part.part_id][ua.question_id] = ua.answer;
        }
      }
    },

    setAnswer(
      state,
      action: PayloadAction<{ partId: number; questionId: string; value: AnswerValue }>
    ) {
      if (state.attemptId === null) return;
      const { partId, questionId, value } = action.payload;
      if (!state.answers[partId]) {
        state.answers[partId] = {};
      }
      state.answers[partId][questionId] = value;
      state.isDirty = true;
    },

    markSavePending(state) {
      state.saveStatus = 'saving';
    },

    markSaveSuccess(state, action: PayloadAction<{ savedAt: number }>) {
      state.isDirty = false;
      state.lastSavedAt = action.payload.savedAt;
      state.saveStatus = 'saved';
    },

    markSaveError(state) {
      state.saveStatus = 'error';
      // isDirty remains true — retry on next interval
    },

    clearAnswers() {
      return initialState;
    },
  },
});

export const {
  setAttemptContext,
  setAnswer,
  markSavePending,
  markSaveSuccess,
  markSaveError,
  clearAnswers,
} = answerSlice.actions;

type RootLike = { answers: AnswerState };

export function selectAnswer(state: RootLike, partId: number, questionId: string): AnswerValue {
  return state.answers.answers?.[partId]?.[questionId] ?? null;
}

export const selectAnsweredQuestionIds = createSelector(
  [(state: RootLike) => state.answers.answers, (_: RootLike, partId: number) => partId],
  (answers, partId): string[] => {
    const partAnswers = answers[partId];
    if (!partAnswers) return [];
    return Object.entries(partAnswers)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k]) => k);
  }
);

export const selectSaveStatus = (state: RootLike) => ({
  isDirty: state.answers.isDirty,
  saveStatus: state.answers.saveStatus,
  lastSavedAt: state.answers.lastSavedAt,
});

// Export for tests
export const reducer = answerSlice.reducer;
export default answerSlice.reducer;
```

- [ ] **Step 4: Chạy lại test để verify PASS**

```powershell
npx vitest run src/features/exam/__tests__/answerSlice.test.ts
```
Expected: tất cả tests PASS (bao gồm cả tests cũ).

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/features/exam/store/answerSlice.ts frontend/src/features/exam/__tests__/answerSlice.test.ts
git commit -m "feat(exam): extend answerSlice with isDirty, saveStatus, markSave* actions"
```

---

## Task 2: Thêm `autosaveAnswers()` và `submitAttempt()` vào `attemptApi.ts`

**Files:**
- Modify: `frontend/src/features/exam/api/attemptApi.ts`
- Create: `frontend/src/features/exam/__tests__/attemptApi.test.ts`

**Interfaces:**
- Consumes: `axiosClient` hiện có từ `src/api/axiosClient.ts`
- Produces:
  ```typescript
  autosaveAnswers(attemptId: number, req: AutosaveRequest): Promise<void>
  submitAttempt(attemptId: number, req: AutosaveRequest): Promise<SubmitResult>
  ```
- Produces types (thêm vào `frontend/src/features/exam/types/api.types.ts`):
  ```typescript
  interface AutosaveRequest {
    version: number;
    answers: PartAnswers[];
  }
  interface SubmitResult {
    attempt_id: number;
    status: 'COMPLETED' | 'AI_GRADING';
    redirect_url: string;
  }
  ```

- [ ] **Step 1: Thêm types vào `api.types.ts`**

Mở `frontend/src/features/exam/types/api.types.ts`, thêm vào cuối:

```typescript
export interface AutosaveRequest {
  version: number;
  answers: PartAnswers[];
}

export interface SubmitResult {
  attempt_id: number;
  status: 'COMPLETED' | 'AI_GRADING';
  redirect_url: string;
}
```

(Import `PartAnswers` từ `./answer.types` nếu chưa có — kiểm tra file trước khi thêm.)

- [ ] **Step 2: Viết test cho `autosaveAnswers` và `submitAttempt`**

Tạo file `frontend/src/features/exam/__tests__/attemptApi.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as axiosClientModule from '../../../api/axiosClient';
import { autosaveAnswers, submitAttempt } from '../api/attemptApi';

vi.mock('../../../api/axiosClient', () => ({
  default: { put: vi.fn(), post: vi.fn(), get: vi.fn() },
}));

const mockAxios = axiosClientModule.default as any;

describe('autosaveAnswers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls PUT /v1/attempts/:id/answers with correct payload', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: true, data: null });
    await autosaveAnswers(42, { version: 3, answers: [] });
    expect(mockAxios.put).toHaveBeenCalledWith('/v1/attempts/42/answers', {
      version: 3,
      answers: [],
    });
  });

  it('throws when API returns success=false', async () => {
    mockAxios.put.mockResolvedValueOnce({ success: false, message: 'conflict' });
    await expect(autosaveAnswers(42, { version: 1, answers: [] })).rejects.toThrow('conflict');
  });
});

describe('submitAttempt', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls POST /v1/attempts/:id/submit and returns normalized result', async () => {
    mockAxios.post.mockResolvedValueOnce({
      success: true,
      data: { attemptId: 42, status: 'COMPLETED', redirectUrl: '/attempts/42/result' },
    });
    const result = await submitAttempt(42, { version: 5, answers: [] });
    expect(mockAxios.post).toHaveBeenCalledWith('/v1/attempts/42/submit', {
      version: 5,
      answers: [],
    });
    expect(result).toEqual({
      attempt_id: 42,
      status: 'COMPLETED',
      redirect_url: '/attempts/42/result',
    });
  });

  it('throws when server returns error', async () => {
    mockAxios.post.mockResolvedValueOnce({ success: false, message: 'not found' });
    await expect(submitAttempt(99, { version: 1, answers: [] })).rejects.toThrow('not found');
  });
});
```

- [ ] **Step 3: Chạy test để verify FAIL**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/attemptApi.test.ts
```
Expected: FAIL — `autosaveAnswers` not exported from `attemptApi`.

- [ ] **Step 4: Thêm hàm vào `attemptApi.ts`**

Mở `frontend/src/features/exam/api/attemptApi.ts`, thêm vào cuối file:

```typescript
/**
 * PUT /api/v1/attempts/:id/answers
 * Autosave draft answers. Called by useAutosave hook every 15s when isDirty=true.
 */
export async function autosaveAnswers(attemptId: number, req: AutosaveRequest): Promise<void> {
  const res = await axiosClient.put<unknown, ApiResponse<null>>(
    `/v1/attempts/${attemptId}/answers`,
    { version: req.version, answers: req.answers }
  );
  if (!res.success) {
    throw new Error(res.message || 'Autosave failed');
  }
}

/**
 * POST /api/v1/attempts/:id/submit
 * Submit attempt. Idempotent — safe to call multiple times.
 */
export async function submitAttempt(attemptId: number, req: AutosaveRequest): Promise<SubmitResult> {
  const res = await axiosClient.post<unknown, ApiResponse<any>>(
    `/v1/attempts/${attemptId}/submit`,
    { version: req.version, answers: req.answers }
  );
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Submit failed');
  }
  return {
    attempt_id: res.data.attemptId ?? res.data.attempt_id,
    status: res.data.status,
    redirect_url: res.data.redirectUrl ?? res.data.redirect_url,
  };
}
```

Thêm import ở đầu file:
```typescript
import type { ApiResponse, AutosaveRequest, CreateAttemptRequest, SubmitResult, WorkspaceResponse } from '../types/api.types';
```

- [ ] **Step 5: Chạy lại test để verify PASS**

```powershell
npx vitest run src/features/exam/__tests__/attemptApi.test.ts
```
Expected: tất cả 4 tests PASS.

- [ ] **Step 6: Commit**

```powershell
cd ..
git add frontend/src/features/exam/api/attemptApi.ts frontend/src/features/exam/types/api.types.ts frontend/src/features/exam/__tests__/attemptApi.test.ts
git commit -m "feat(exam): add autosaveAnswers and submitAttempt to attemptApi"
```

---

## Task 3: Hook `useExamTimer` — đếm ngược chống throttle

**Files:**
- Create: `frontend/src/features/exam/hooks/useExamTimer.ts`
- Create: `frontend/src/features/exam/__tests__/useExamTimer.test.ts`

**Interfaces:**
- Produces:
  ```typescript
  function useExamTimer(deadline: string | null): {
    timeLeftMs: number;
    isExpired: boolean;
    displayTime: string;   // "MM:SS" hoặc "HH:MM:SS" nếu ≥ 1 giờ
    isPractice: boolean;   // true khi deadline === null
  }
  ```

- [ ] **Step 1: Tạo file test**

Tạo file `frontend/src/features/exam/__tests__/useExamTimer.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useExamTimer } from '../hooks/useExamTimer';

describe('useExamTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns isPractice=true when deadline is null', () => {
    const { result } = renderHook(() => useExamTimer(null));
    expect(result.current.isPractice).toBe(true);
    expect(result.current.isExpired).toBe(false);
    expect(result.current.timeLeftMs).toBe(0);
  });

  it('computes timeLeftMs correctly from deadline', () => {
    const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 giờ nữa
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.timeLeftMs).toBeGreaterThan(59 * 60 * 1000);
    expect(result.current.isExpired).toBe(false);
  });

  it('decrements every 500ms by re-reading Date.now()', () => {
    const deadline = new Date(Date.now() + 10_000).toISOString(); // 10 giây
    const { result } = renderHook(() => useExamTimer(deadline));
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(result.current.timeLeftMs).toBeLessThan(6_000);
    expect(result.current.timeLeftMs).toBeGreaterThan(4_000);
  });

  it('sets isExpired=true when deadline is in the past', () => {
    const deadline = new Date(Date.now() - 1000).toISOString(); // đã qua
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.isExpired).toBe(true);
    expect(result.current.timeLeftMs).toBe(0);
  });

  it('formats displayTime as MM:SS for < 1 hour', () => {
    const deadline = new Date(Date.now() + 5 * 60 * 1000 + 30 * 1000).toISOString(); // 5:30
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.displayTime).toMatch(/^0?5:30$/);
  });

  it('formats displayTime as HH:MM:SS for >= 1 hour', () => {
    const deadline = new Date(Date.now() + 75 * 60 * 1000).toISOString(); // 1:15:00
    const { result } = renderHook(() => useExamTimer(deadline));
    expect(result.current.displayTime).toMatch(/^1:1[45]:\d{2}$/);
  });
});
```

- [ ] **Step 2: Chạy test để verify FAIL**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/useExamTimer.test.ts
```
Expected: FAIL — Cannot find module `../hooks/useExamTimer`.

- [ ] **Step 3: Tạo `useExamTimer.ts`**

Tạo file `frontend/src/features/exam/hooks/useExamTimer.ts`:

```typescript
import { useState, useEffect } from 'react';

export interface ExamTimerResult {
  timeLeftMs: number;
  isExpired: boolean;
  displayTime: string;
  isPractice: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

export function useExamTimer(deadline: string | null): ExamTimerResult {
  const isPractice = deadline === null;

  const computeTimeLeft = (): number => {
    if (isPractice || !deadline) return 0;
    return Math.max(0, Date.parse(deadline) - Date.now());
  };

  const [timeLeftMs, setTimeLeftMs] = useState<number>(computeTimeLeft);

  useEffect(() => {
    if (isPractice) return;

    // Refresh mỗi 500ms để tránh giật khi quay lại từ tab ẩn
    const id = setInterval(() => {
      setTimeLeftMs(computeTimeLeft());
    }, 500);

    return () => clearInterval(id);
  }, [deadline, isPractice]);

  return {
    timeLeftMs,
    isExpired: !isPractice && timeLeftMs === 0,
    displayTime: isPractice ? '' : formatTime(timeLeftMs),
    isPractice,
  };
}
```

- [ ] **Step 4: Chạy lại test để verify PASS**

```powershell
npx vitest run src/features/exam/__tests__/useExamTimer.test.ts
```
Expected: tất cả 6 tests PASS.

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/features/exam/hooks/useExamTimer.ts frontend/src/features/exam/__tests__/useExamTimer.test.ts
git commit -m "feat(exam): add useExamTimer hook — deadline-based countdown, tab-throttle resistant"
```

---

## Task 4: Hook `useAutosave` — polling 15s + isDirty guard

**Files:**
- Create: `frontend/src/features/exam/hooks/useAutosave.ts`
- Create: `frontend/src/features/exam/__tests__/useAutosave.test.ts`

**Interfaces:**
- Consumes: `selectSaveStatus`, `markSavePending`, `markSaveSuccess`, `markSaveError` từ Task 1
- Consumes: `autosaveAnswers` từ Task 2
- Produces: hook `useAutosave(attemptId: number | null): void`

- [ ] **Step 1: Tạo file test**

Tạo `frontend/src/features/exam/__tests__/useAutosave.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as attemptApiModule from '../api/attemptApi';
import { useAutosave } from '../hooks/useAutosave';
import { renderWithStore } from '../../../test-utils/renderWithStore';
import { setAnswer, setAttemptContext } from '../store/answerSlice';

vi.mock('../api/attemptApi', () => ({
  autosaveAnswers: vi.fn(),
}));

const mockAutosave = attemptApiModule.autosaveAnswers as ReturnType<typeof vi.fn>;

// Helper: render hook với Redux store có sẵn
function setup(preloadedState?: any) {
  return renderHook(() => useAutosave(42), {
    wrapper: ({ children }) => renderWithStore(children, preloadedState),
  });
}

describe('useAutosave', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
  afterEach(() => vi.useRealTimers());

  it('does NOT call API when isDirty=false', async () => {
    setup({ answers: { attemptId: 42, isDirty: false, version: 0, answers: {}, saveStatus: 'idle', lastSavedAt: null } });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('calls autosaveAnswers after 15s when isDirty=true', async () => {
    mockAutosave.mockResolvedValueOnce(undefined);
    setup({ answers: { attemptId: 42, isDirty: true, version: 2, answers: {}, saveStatus: 'idle', lastSavedAt: null } });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(mockAutosave).toHaveBeenCalledWith(42, expect.objectContaining({ version: 2 }));
  });

  it('does NOT call API when saveStatus=saving (guard)', async () => {
    setup({ answers: { attemptId: 42, isDirty: true, version: 1, answers: {}, saveStatus: 'saving', lastSavedAt: null } });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(mockAutosave).not.toHaveBeenCalled();
  });

  it('dispatches markSaveError when API throws', async () => {
    mockAutosave.mockRejectedValueOnce(new Error('network error'));
    const { store } = setup({ answers: { attemptId: 42, isDirty: true, version: 1, answers: {}, saveStatus: 'idle', lastSavedAt: null } });
    await act(async () => { vi.advanceTimersByTime(15_000); });
    expect(store.getState().answers.saveStatus).toBe('error');
    expect(store.getState().answers.isDirty).toBe(true);
  });
});
```

*(Lưu ý: cần tạo `frontend/src/test-utils/renderWithStore.tsx` helper — xem Step 3)*

- [ ] **Step 2: Tạo `test-utils/renderWithStore.tsx`** (nếu chưa có)

Tạo file `frontend/src/test-utils/renderWithStore.tsx`:

```tsx
import React from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../features/exam/store/answerSlice';

export function renderWithStore(children: React.ReactNode, preloadedState?: any) {
  const store = configureStore({
    reducer: { answers: answerReducer },
    preloadedState,
  });
  return { store, element: <Provider store={store}>{children}</Provider> };
}
```

*(Và điều chỉnh renderHook wrapper trong test để dùng `element` từ helper.)*

- [ ] **Step 3: Tạo `useAutosave.ts`**

Tạo file `frontend/src/features/exam/hooks/useAutosave.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store/store';
import { markSavePending, markSaveSuccess, markSaveError, selectSaveStatus } from '../store/answerSlice';
import { autosaveAnswers } from '../api/attemptApi';

const AUTOSAVE_INTERVAL_MS = 15_000;

export function useAutosave(attemptId: number | null): void {
  const dispatch = useDispatch<AppDispatch>();
  const { isDirty, saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));
  const answersState = useSelector((state: RootState) => state.answers);

  // Dùng ref để tránh closure stale trong setInterval
  const stateRef = useRef({ isDirty, saveStatus, answersState });
  stateRef.current = { isDirty, saveStatus, answersState };

  useEffect(() => {
    if (!attemptId) return;

    const id = setInterval(async () => {
      const { isDirty, saveStatus, answersState } = stateRef.current;
      // Guard: bỏ qua nếu không dirty hoặc đang save
      if (!isDirty || saveStatus === 'saving') return;

      dispatch(markSavePending());

      // Chuyển answers Record thành mảng PartAnswers
      const answers = Object.entries(answersState.answers).map(([partId, qMap]) => ({
        part_id: Number(partId),
        answers: Object.entries(qMap).map(([question_id, answer]) => ({ question_id, answer })),
      }));

      try {
        await autosaveAnswers(attemptId, { version: answersState.version, answers });
        dispatch(markSaveSuccess({ savedAt: Date.now() }));
        // Ghi vào localStorage làm fallback
        localStorage.setItem(`exam_draft_${attemptId}`, JSON.stringify(answersState.answers));
      } catch {
        dispatch(markSaveError());
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [attemptId, dispatch]);
}
```

- [ ] **Step 4: Chạy test để verify PASS**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/useAutosave.test.ts
```
Expected: tất cả 4 tests PASS.

- [ ] **Step 5: Commit**

```powershell
cd ..
git add frontend/src/features/exam/hooks/useAutosave.ts frontend/src/features/exam/__tests__/useAutosave.test.ts frontend/src/test-utils/renderWithStore.tsx
git commit -m "feat(exam): add useAutosave hook — polling 15s, isDirty guard, localStorage fallback"
```

---

## Task 5: Backend — DTO + Service cho Autosave và Submit

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/AutosaveAnswersRequest.java`
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/SubmitResultResponse.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/TestAttemptService.java`
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/service/impl/TestAttemptServiceImpl.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java`

**Interfaces:**
- Produces (Service interface):
  ```java
  void autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request);
  SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request);
  ```

- [ ] **Step 1: Tạo DTO `AutosaveAnswersRequest.java`**

```java
// backend/src/main/java/com/multilingo/backend/modules/testing/dto/request/AutosaveAnswersRequest.java
package com.multilingo.backend.modules.testing.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class AutosaveAnswersRequest {
    @NotNull
    private Integer version;

    @NotNull
    private List<PartAnswerDto> answers;

    @Data
    public static class PartAnswerDto {
        private Integer partId;
        private List<QuestionAnswerDto> answers;
    }

    @Data
    public static class QuestionAnswerDto {
        private String questionId;
        private Object answer;  // AnswerValue: String, String[], etc.
    }
}
```

- [ ] **Step 2: Tạo DTO `SubmitResultResponse.java`**

```java
// backend/src/main/java/com/multilingo/backend/modules/testing/dto/response/SubmitResultResponse.java
package com.multilingo.backend.modules.testing.dto.response;

import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SubmitResultResponse {
    private Integer attemptId;
    private AttemptStatus status;
    private String redirectUrl;

    public static SubmitResultResponse from(Integer attemptId, AttemptStatus status) {
        return SubmitResultResponse.builder()
                .attemptId(attemptId)
                .status(status)
                .redirectUrl("/attempts/" + attemptId + "/result")
                .build();
    }
}
```

- [ ] **Step 3: Viết test cho Service (TDD)**

Mở `backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java`, thêm:

```java
@Test
void autosaveAnswers_saves_to_attempt_answers_table() {
    // Arrange: tạo attempt IN_PROGRESS trong DB
    TestAttempt attempt = attemptRepo.findAll().get(0); // fixture tạo sẵn
    AutosaveAnswersRequest req = new AutosaveAnswersRequest();
    req.setVersion(1);
    req.setAnswers(Collections.emptyList());

    // Act
    assertDoesNotThrow(() -> testAttemptService.autosaveAnswers(attempt.getId(), req));
}

@Test
void submitAttempt_changes_status_to_COMPLETED() {
    TestAttempt attempt = attemptRepo.findAll().get(0);
    AutosaveAnswersRequest req = new AutosaveAnswersRequest();
    req.setVersion(1);
    req.setAnswers(Collections.emptyList());

    SubmitResultResponse result = testAttemptService.submitAttempt(attempt.getId(), req);

    assertThat(result.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
    assertThat(result.getRedirectUrl()).contains(attempt.getId().toString());
}

@Test
void submitAttempt_is_idempotent_when_already_completed() {
    // Submit lần 1
    TestAttempt attempt = attemptRepo.findAll().get(0);
    AutosaveAnswersRequest req = new AutosaveAnswersRequest();
    req.setVersion(1);
    req.setAnswers(Collections.emptyList());
    testAttemptService.submitAttempt(attempt.getId(), req);

    // Submit lần 2 — phải trả về kết quả cũ, không throw
    SubmitResultResponse result2 = testAttemptService.submitAttempt(attempt.getId(), req);
    assertThat(result2.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
}
```

- [ ] **Step 4: Chạy test để verify FAIL**

```powershell
cd backend
mvn test -Dtest=TestAttemptServiceTest -pl . 2>&1 | Select-String -Pattern "FAIL|ERROR|BUILD"
```
Expected: BUILD FAILURE — method `autosaveAnswers` not found on service.

- [ ] **Step 5: Thêm signature vào Service interface và implement**

Thêm vào `TestAttemptService.java`:
```java
void autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request);
SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request);
```

Thêm vào `TestAttemptServiceImpl.java`:
```java
@Override
@Transactional
public void autosaveAnswers(Integer attemptId, AutosaveAnswersRequest request) {
    TestAttempt attempt = attemptRepo.findById(attemptId)
            .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN));
    // Lưu đáp án nháp vào attempt_answers (upsert theo partId + questionId)
    // Sprint 03: lưu toàn bộ JSON vào AttemptAnswer.userAnswers (JSONB)
    AttemptAnswer draftAnswer = attemptAnswerRepo
            .findByAttemptId(attemptId)
            .orElse(AttemptAnswer.builder().attempt(attempt).build());
    draftAnswer.setUserAnswers(request.getAnswers()); // serialize to JSONB
    attemptAnswerRepo.save(draftAnswer);
}

@Override
@Transactional
public SubmitResultResponse submitAttempt(Integer attemptId, AutosaveAnswersRequest request) {
    TestAttempt attempt = attemptRepo.findById(attemptId)
            .orElseThrow(() -> new AppException(ErrorCode.FORBIDDEN));

    // Idempotency: nếu đã submitted, trả về kết quả cũ
    if (attempt.getStatus() != AttemptStatus.IN_PROGRESS) {
        return SubmitResultResponse.from(attempt.getId(), attempt.getStatus());
    }

    // Lưu đáp án cuối cùng
    autosaveAnswers(attemptId, request);

    // Chuyển trạng thái
    attempt.setStatus(AttemptStatus.COMPLETED);
    attempt.setEndTime(Instant.now());
    attemptRepo.save(attempt);

    return SubmitResultResponse.from(attempt.getId(), AttemptStatus.COMPLETED);
}
```

- [ ] **Step 6: Chạy lại test để verify PASS**

```powershell
mvn test -Dtest=TestAttemptServiceTest -pl .
```
Expected: BUILD SUCCESS.

- [ ] **Step 7: Commit**

```powershell
cd ..
git add backend/src/main/java/com/multilingo/backend/modules/testing/
git add backend/src/test/java/com/multilingo/backend/modules/testing/service/TestAttemptServiceTest.java
git commit -m "feat(testing-be): add autosaveAnswers and idempotent submitAttempt to service"
```

---

## Task 6: Backend — Controller endpoints + Integration Tests

**Files:**
- Modify: `backend/src/main/java/com/multilingo/backend/modules/testing/controller/TestAttemptController.java`
- Modify: `backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptControllerIT.java`

**Interfaces:**
- Consumes: `testAttemptService.autosaveAnswers()` và `testAttemptService.submitAttempt()` từ Task 5
- Produces: `PUT /api/v1/attempts/{id}/answers → 200` và `POST /api/v1/attempts/{id}/submit → 200`

- [ ] **Step 1: Viết IT tests cho 2 endpoints mới**

Thêm vào `TestAttemptControllerIT.java`:

```java
// ─── UC-03: PUT /api/v1/attempts/{id}/answers ────────────────────────────────

@Test
void put_answers_returns_200_for_valid_attempt() throws Exception {
    // Create attempt first
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.MOCK_TEST);
    MvcResult create = mockMvc.perform(post("/api/v1/attempts")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(req)))
            .andReturn();
    int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
            .path("data").path("attemptId").asInt();

    String body = "{\"version\": 1, \"answers\": []}";
    mockMvc.perform(put("/api/v1/attempts/{id}/answers", attemptId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isOk());
}

// ─── UC-04: POST /api/v1/attempts/{id}/submit ───────────────────────────────

@Test
void post_submit_changes_status_to_COMPLETED() throws Exception {
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1);
    req.setTestScope(TestScope.FULL_EXAM);
    req.setTestMode(TestMode.MOCK_TEST);
    MvcResult create = mockMvc.perform(post("/api/v1/attempts")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(objectMapper.writeValueAsString(req)))
            .andReturn();
    int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
            .path("data").path("attemptId").asInt();

    String body = "{\"version\": 1, \"answers\": []}";
    mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("COMPLETED"))
            .andExpect(jsonPath("$.data.redirectUrl").value("/attempts/" + attemptId + "/result"));
}

@Test
void post_submit_idempotent_returns_200_when_already_submitted() throws Exception {
    // Submit 2 lần — cả 2 phải trả 200
    CreateAttemptRequest req = new CreateAttemptRequest();
    req.setExamId(1); req.setTestScope(TestScope.FULL_EXAM); req.setTestMode(TestMode.MOCK_TEST);
    MvcResult create = mockMvc.perform(post("/api/v1/attempts").contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(req))).andReturn();
    int attemptId = objectMapper.readTree(create.getResponse().getContentAsString())
            .path("data").path("attemptId").asInt();
    String body = "{\"version\": 1, \"answers\": []}";

    mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk());
    mockMvc.perform(post("/api/v1/attempts/{id}/submit", attemptId)
            .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.status").value("COMPLETED"));
}
```

- [ ] **Step 2: Chạy IT test để verify FAIL**

```powershell
cd backend
mvn test -Dtest=TestAttemptControllerIT -pl .
```
Expected: FAIL — 405 Method Not Allowed (endpoint chưa có).

- [ ] **Step 3: Thêm endpoints vào `TestAttemptController.java`**

```java
@PutMapping("/{id}/answers")
public ResponseEntity<ApiResponse<Void>> autosaveAnswers(
        @PathVariable Integer id,
        @Valid @RequestBody AutosaveAnswersRequest request) {
    testAttemptService.autosaveAnswers(id, request);
    return ResponseEntity.ok(ApiResponse.success(null));
}

@PostMapping("/{id}/submit")
public ResponseEntity<ApiResponse<SubmitResultResponse>> submitAttempt(
        @PathVariable Integer id,
        @Valid @RequestBody AutosaveAnswersRequest request) {
    SubmitResultResponse result = testAttemptService.submitAttempt(id, request);
    return ResponseEntity.ok(ApiResponse.success(result));
}
```

Thêm imports: `AutosaveAnswersRequest`, `SubmitResultResponse`, `org.springframework.web.bind.annotation.PutMapping`.

- [ ] **Step 4: Chạy lại IT test để verify PASS**

```powershell
mvn test -Dtest=TestAttemptControllerIT -pl .
```
Expected: BUILD SUCCESS.

- [ ] **Step 5: Chạy full backend test suite**

```powershell
mvn test -pl .
```
Expected: BUILD SUCCESS, không có test RED.

- [ ] **Step 6: Commit**

```powershell
cd ..
git add backend/src/main/java/com/multilingo/backend/modules/testing/controller/TestAttemptController.java
git add backend/src/test/java/com/multilingo/backend/modules/testing/controller/TestAttemptControllerIT.java
git commit -m "feat(testing-be): add PUT /answers and POST /submit endpoints"
```

---

## Task 7: Backend — `AttemptWatchdogService` (Cron Job)

**Files:**
- Create: `backend/src/main/java/com/multilingo/backend/modules/testing/service/AttemptWatchdogService.java`
- Create: `backend/src/test/java/com/multilingo/backend/modules/testing/service/AttemptWatchdogServiceTest.java`
- Modify: `backend/src/main/java/com/multilingo/backend/BackendApplication.java` — thêm `@EnableScheduling`

**Interfaces:**
- Produces: method `finalizeExpiredAttempts()` chạy mỗi 60 giây

- [ ] **Step 1: Viết unit test**

Tạo `backend/src/test/java/com/multilingo/backend/modules/testing/service/AttemptWatchdogServiceTest.java`:

```java
package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AttemptWatchdogServiceTest {

    @Mock
    TestAttemptRepository attemptRepo;

    @InjectMocks
    AttemptWatchdogService watchdogService;

    @Test
    void finalizeExpiredAttempts_changes_status_to_COMPLETED() {
        TestAttempt expired = new TestAttempt();
        expired.setStatus(AttemptStatus.IN_PROGRESS);
        expired.setDeadline(Instant.now().minusSeconds(120));

        when(attemptRepo.findByStatusAndDeadlineBefore(eq(AttemptStatus.IN_PROGRESS), any(Instant.class)))
                .thenReturn(List.of(expired));

        watchdogService.finalizeExpiredAttempts();

        assertThat(expired.getStatus()).isEqualTo(AttemptStatus.COMPLETED);
        verify(attemptRepo).saveAll(List.of(expired));
    }

    @Test
    void finalizeExpiredAttempts_does_nothing_when_no_expired_attempts() {
        when(attemptRepo.findByStatusAndDeadlineBefore(any(), any())).thenReturn(List.of());
        watchdogService.finalizeExpiredAttempts();
        verify(attemptRepo).saveAll(List.of());
    }
}
```

- [ ] **Step 2: Chạy test để verify FAIL**

```powershell
cd backend
mvn test -Dtest=AttemptWatchdogServiceTest -pl .
```

- [ ] **Step 3: Thêm `@EnableScheduling` vào `BackendApplication.java`**

```java
@SpringBootApplication
@EnableScheduling  // thêm dòng này
public class BackendApplication { ... }
```

- [ ] **Step 4: Thêm query method vào `TestAttemptRepository`**

```java
List<TestAttempt> findByStatusAndDeadlineBefore(AttemptStatus status, Instant deadline);
```

- [ ] **Step 5: Tạo `AttemptWatchdogService.java`**

```java
package com.multilingo.backend.modules.testing.service;

import com.multilingo.backend.modules.testing.entity.TestAttempt;
import com.multilingo.backend.modules.testing.entity.enums.AttemptStatus;
import com.multilingo.backend.modules.testing.repository.TestAttemptRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AttemptWatchdogService {

    private final TestAttemptRepository attemptRepo;

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void finalizeExpiredAttempts() {
        List<TestAttempt> expired = attemptRepo
                .findByStatusAndDeadlineBefore(AttemptStatus.IN_PROGRESS, Instant.now());
        if (expired.isEmpty()) {
            attemptRepo.saveAll(List.of());
            return;
        }
        log.info("Watchdog: finalizing {} expired attempt(s)", expired.size());
        expired.forEach(a -> {
            a.setStatus(AttemptStatus.COMPLETED);
            a.setEndTime(Instant.now());
        });
        attemptRepo.saveAll(expired);
    }
}
```

- [ ] **Step 6: Chạy lại test để verify PASS**

```powershell
mvn test -Dtest=AttemptWatchdogServiceTest -pl .
```

- [ ] **Step 7: Chạy full test suite**

```powershell
mvn test -pl .
```
Expected: BUILD SUCCESS.

- [ ] **Step 8: Commit**

```powershell
cd ..
git add backend/src/main/java/com/multilingo/backend/modules/testing/service/AttemptWatchdogService.java
git add backend/src/test/java/com/multilingo/backend/modules/testing/service/AttemptWatchdogServiceTest.java
git add backend/src/main/java/com/multilingo/backend/BackendApplication.java
git commit -m "feat(testing-be): add AttemptWatchdogService cron job to auto-finalize expired attempts"
```

---

## Task 8: UI Components — `TimerDisplay`, `SaveStatusBadge`, `SubmitOverlay`, `SubmitConfirmModal`

**Files:**
- Create: `frontend/src/features/exam/components/TimerDisplay.tsx`
- Create: `frontend/src/features/exam/components/SaveStatusBadge.tsx`
- Create: `frontend/src/features/exam/components/SubmitOverlay.tsx`
- Create: `frontend/src/features/exam/components/SubmitConfirmModal.tsx`
- Create: `frontend/src/features/exam/__tests__/TimerDisplay.test.tsx`

**Interfaces:**
- Consumes: `ExamTimerResult` từ Task 3; `selectSaveStatus` từ Task 1

- [ ] **Step 1: Viết test cho `TimerDisplay`**

Tạo `frontend/src/features/exam/__tests__/TimerDisplay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { TimerDisplay } from '../components/TimerDisplay';

describe('TimerDisplay', () => {
  it('renders displayTime', () => {
    render(<TimerDisplay displayTime="45:30" isExpired={false} isPractice={false} />);
    expect(screen.getByText('45:30')).toBeDefined();
  });

  it('renders null when isPractice=true', () => {
    const { container } = render(<TimerDisplay displayTime="" isExpired={false} isPractice={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies danger style when isExpired=true', () => {
    render(<TimerDisplay displayTime="00:00" isExpired={true} isPractice={false} />);
    const el = screen.getByText('00:00');
    expect(el.className).toMatch(/expired|danger|red/i);
  });
});
```

- [ ] **Step 2: Tạo tất cả 4 components**

Tạo `frontend/src/features/exam/components/TimerDisplay.tsx`:
```tsx
interface TimerDisplayProps {
  displayTime: string;
  isExpired: boolean;
  isPractice: boolean;
}

export function TimerDisplay({ displayTime, isExpired, isPractice }: TimerDisplayProps) {
  if (isPractice) return null;
  return (
    <div className={`timer-display ${isExpired ? 'timer-expired' : ''}`}
         style={{ color: isExpired ? '#dc2626' : undefined, fontVariantNumeric: 'tabular-nums' }}>
      ⏱ {displayTime}
    </div>
  );
}
```

Tạo `frontend/src/features/exam/components/SaveStatusBadge.tsx`:
```tsx
import { useSelector } from 'react-redux';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

export function SaveStatusBadge() {
  const { saveStatus } = useSelector((state: RootState) => selectSaveStatus(state));

  if (saveStatus === 'idle') return null;
  const map = {
    saving: { icon: '⟳', text: 'Đang lưu...', color: '#6b7280' },
    saved:  { icon: '✓', text: 'Đã lưu', color: '#16a34a' },
    error:  { icon: '⚠', text: 'Đang thử lại...', color: '#d97706' },
  } as const;
  const { icon, text, color } = map[saveStatus];
  return (
    <span style={{ fontSize: '0.8rem', color }}>
      {icon} {text}
    </span>
  );
}
```

Tạo `frontend/src/features/exam/components/SubmitOverlay.tsx`:
```tsx
interface SubmitOverlayProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

export function SubmitOverlay({ visible, isRetrying, onRetry }: SubmitOverlayProps) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, color: 'white', gap: 16,
    }}>
      <h2>⏰ Hết thời gian!</h2>
      {isRetrying
        ? <p>Đang nộp bài...</p>
        : (
          <>
            <p style={{ color: '#fca5a5' }}>Nộp bài thất bại — kiểm tra kết nối mạng.</p>
            <button onClick={onRetry} style={{ padding: '8px 24px', borderRadius: 8, cursor: 'pointer' }}>
              Thử nộp lại
            </button>
          </>
        )
      }
    </div>
  );
}
```

Tạo `frontend/src/features/exam/components/SubmitConfirmModal.tsx`:
```tsx
interface SubmitConfirmModalProps {
  open: boolean;
  unansweredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmModal({ open, unansweredCount, onConfirm, onCancel }: SubmitConfirmModalProps) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
      <div style={{ background: 'white', padding: 32, borderRadius: 12, maxWidth: 400, width: '90%' }}>
        <h3>Xác nhận nộp bài</h3>
        {unansweredCount > 0 && (
          <p style={{ color: '#d97706' }}>Bạn còn {unansweredCount} câu chưa trả lời.</p>
        )}
        <p>Sau khi nộp bài, bạn không thể chỉnh sửa đáp án. Tiếp tục?</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button onClick={onConfirm} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', borderRadius: 8, cursor: 'pointer' }}>
            Nộp bài
          </button>
          <button onClick={onCancel} style={{ flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer' }}>
            Tiếp tục làm bài
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Chạy test**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/TimerDisplay.test.tsx
```
Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
cd ..
git add frontend/src/features/exam/components/TimerDisplay.tsx
git add frontend/src/features/exam/components/SaveStatusBadge.tsx
git add frontend/src/features/exam/components/SubmitOverlay.tsx
git add frontend/src/features/exam/components/SubmitConfirmModal.tsx
git add frontend/src/features/exam/__tests__/TimerDisplay.test.tsx
git commit -m "feat(exam): add TimerDisplay, SaveStatusBadge, SubmitOverlay, SubmitConfirmModal components"
```

---

## Task 9: `WorkspacePage` — tích hợp tất cả hooks và components

**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Create: `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`

**Interfaces:**
- Consumes: `useWorkspace`, `useExamTimer`, `useAutosave` từ Task 3 & 4
- Consumes: `TimerDisplay`, `SaveStatusBadge`, `SubmitOverlay`, `SubmitConfirmModal` từ Task 8
- Consumes: `submitAttempt` từ Task 2

- [ ] **Step 1: Viết test integration cho WorkspacePage**

Tạo `frontend/src/features/exam/__tests__/WorkspacePage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../store/answerSlice';
import WorkspacePage from '../pages/WorkspacePage';

vi.mock('../hooks/useWorkspace', () => ({
  default: () => ({
    workspace: {
      attempt_id: 1,
      status: 'IN_PROGRESS',
      test_mode: 'MOCK_TEST',
      deadline: new Date(Date.now() + 3600_000).toISOString(),
      exam_snapshot: { sections: [] },
      version: 0,
      saved_answers: [],
    },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));

function renderPage() {
  const store = configureStore({ reducer: { answers: answerReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/attempts/1']}>
        <Routes>
          <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('WorkspacePage', () => {
  it('renders Timer when mode is MOCK_TEST', () => {
    renderPage();
    // TimerDisplay phải có trên màn hình (hiển thị thời gian)
    expect(screen.getByText(/:\d{2}$/)).toBeDefined();
  });

  it('does not crash with empty sections', () => {
    expect(() => renderPage()).not.toThrow();
  });
});
```

- [ ] **Step 2: Chạy test để verify hiện trạng**

```powershell
cd frontend
npx vitest run src/features/exam/__tests__/WorkspacePage.test.tsx
```

- [ ] **Step 3: Cập nhật `WorkspacePage.tsx`**

Thay thế nội dung `frontend/src/features/exam/pages/WorkspacePage.tsx`:

```tsx
import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import useWorkspace from '../hooks/useWorkspace';
import { useExamTimer } from '../hooks/useExamTimer';
import { useAutosave } from '../hooks/useAutosave';
import { TimerDisplay } from '../components/TimerDisplay';
import { SaveStatusBadge } from '../components/SaveStatusBadge';
import { SubmitOverlay } from '../components/SubmitOverlay';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal';
import { QuestionPalette } from '../components/QuestionPalette';
import { submitAttempt } from '../api/attemptApi';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

export default function WorkspacePage() {
  const { attemptId: attemptIdStr } = useParams<{ attemptId: string }>();
  const attemptId = Number(attemptIdStr);
  const navigate = useNavigate();

  const { workspace, loading, error, retry } = useWorkspace(attemptId);
  const { displayTime, isExpired, isPractice } = useExamTimer(workspace?.deadline ?? null);
  useAutosave(workspace ? attemptId : null);

  const { isDirty } = useSelector((state: RootState) => selectSaveStatus(state));
  const answersState = useSelector((state: RootState) => state.answers);

  const [showConfirm, setShowConfirm] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-submit khi hết giờ
  useEffect(() => {
    if (isExpired && !showOverlay) {
      setShowOverlay(true);
      handleSubmit();
    }
  }, [isExpired]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const answers = Object.entries(answersState.answers).map(([partId, qMap]) => ({
      part_id: Number(partId),
      answers: Object.entries(qMap).map(([question_id, answer]) => ({ question_id, answer })),
    }));
    try {
      const result = await submitAttempt(attemptId, { version: answersState.version, answers });
      navigate(result.redirect_url);
    } catch {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}>Đang tải bài thi...</div>;
  if (error) return (
    <div style={{ padding: 32 }}>
      <p>Lỗi: {error}</p>
      <button onClick={retry}>Thử lại</button>
    </div>
  );
  if (!workspace) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Left: nội dung đề thi */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2>Bài thi</h2>
          <SaveStatusBadge />
        </div>
        {/* Sections/Parts/Questions sẽ render từ exam_snapshot — chi tiết trong WorkspaceShell */}
        <pre style={{ fontSize: '0.7rem', color: '#999' }}>
          {JSON.stringify(workspace.exam_snapshot, null, 2).slice(0, 200)}...
        </pre>
      </div>

      {/* Right: Timer + Palette + Submit */}
      <div style={{ width: 280, borderLeft: '1px solid #e5e7eb', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
        <QuestionPalette workspace={workspace} />
        <button
          disabled={isDirty}
          onClick={() => setShowConfirm(true)}
          style={{ padding: '10px 16px', background: isDirty ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 8, cursor: isDirty ? 'not-allowed' : 'pointer' }}
        >
          {isDirty ? 'Đang lưu...' : 'Nộp bài'}
        </button>
      </div>

      <SubmitConfirmModal
        open={showConfirm}
        unansweredCount={0}
        onConfirm={() => { setShowConfirm(false); setShowOverlay(true); handleSubmit(); }}
        onCancel={() => setShowConfirm(false)}
      />
      <SubmitOverlay
        visible={showOverlay}
        isRetrying={isSubmitting}
        onRetry={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 4: Chạy lại test để verify PASS**

```powershell
npx vitest run src/features/exam/__tests__/WorkspacePage.test.tsx
```

- [ ] **Step 5: Chạy toàn bộ FE test suite**

```powershell
npx vitest run
```
Expected: tất cả tests PASS.

- [ ] **Step 6: Commit**

```powershell
cd ..
git add frontend/src/features/exam/pages/WorkspacePage.tsx
git add frontend/src/features/exam/__tests__/WorkspacePage.test.tsx
git commit -m "feat(exam): integrate Timer, Autosave, Submit into WorkspacePage"
```

---

## Task 10: Verification — Full Test Run & Manual Smoke Test

- [ ] **Step 1: Chạy toàn bộ Backend tests**

```powershell
cd backend
mvn clean test
```
Expected: BUILD SUCCESS, 0 FAIL.

- [ ] **Step 2: Chạy toàn bộ Frontend tests**

```powershell
cd ../frontend
npx vitest run
```
Expected: tất cả tests PASS (≥ 50 tests).

- [ ] **Step 3: Smoke test manual**

Đảm bảo Docker (PostgreSQL + Redis) và Backend đang chạy, rồi:
1. Khởi động: `npm run dev`
2. Truy cập `http://localhost:5173/exams/1/start`
3. Chọn FULL_EXAM + MOCK_TEST → Bắt đầu
4. Kiểm tra: Timer đếm ngược hiển thị trên màn hình
5. Chọn 1 đáp án → badge "Đang lưu..." xuất hiện sau 15s, chuyển "Đã lưu"
6. Bấm "Nộp bài" → Modal xác nhận hiện ra → Xác nhận → Overlay → Navigate

- [ ] **Step 4: Final commit**

```powershell
cd ..
git add .
git commit -m "feat(sprint03): complete Exam Integration — Timer, Autosave, Submit, Watchdog; all tests pass"
```

---

*Plan hoàn chỉnh. Mọi task đều có test cụ thể, code thực tế, và commit message theo Conventional Commits.*
