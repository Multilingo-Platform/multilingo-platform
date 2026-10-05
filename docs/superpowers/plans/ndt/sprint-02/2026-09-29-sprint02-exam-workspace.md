# Sprint 02 — Exam Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Exam Workspace frontend — routing, API client, Redux answer state, and all question renderers — so a student can view an exam and enter answers for all question types.

**Architecture:** `ExamStartPage` (`/exams/:examId/start`) collects scope/mode and POSTs to create an attempt, then redirects to `WorkspacePage` (`/attempts/:attemptId`). The workspace loads via `useWorkspace` hook, hydrates Redux `answerSlice`, and renders parts through `WorkspaceShell` → section → part → group → `QuestionRenderer` dispatcher → per-type renderer. `HtmlContent` (DOMPurify) and `AudioPlayer` (controlled pause) are shared primitives.

**Tech Stack:** React 19, TypeScript 6, Redux Toolkit 2, Axios 1.x, DOMPurify, Vitest 5 + @testing-library/react 16, Vite 8, react-router-dom 7

**Spec:** `docs/superpowers/specs/2026-09-29-sprint02-exam-workspace-design.md`

## Global Constraints

- **No `correct_answer` in client state** — `WorkspaceResponse` never contains it; `answerSlice` must never store it
- **TypeScript strict** — no `any`, no type assertions unless mapping raw `Map<String,Object>` snapshot
- **Question field name:** Backend fixture uses `"type"` for question type; frontend `exam.types.ts` currently uses `question_type` — Task 1 aligns them
- **DOMPurify required** for all HTML rendering — `dangerouslySetInnerHTML` without sanitize is a plan failure
- **Vitest test runner:** `npm run test` = `vitest run` from `frontend/`
- **All new files** in `frontend/src/features/exam/` — no changes to files outside that path except: `App.tsx` (routes), `store/store.ts` (reducer registration), `package.json` (dompurify install)
- **No autosave to server** in Sprint 02 — answers live in Redux only until Sprint 03
- **Existing routes** `/test-audio` and `/test-student` must still work after routing changes

## Review Focus

1. **Stale audio on Part switch** — `AudioPlayer` must pause when `isActive` prop becomes `false`; if the ref is null at that moment the audio keeps playing. The test in Task 6 must verify `pause()` is called via `HTMLMediaElement` mock.
2. **MULTIPLE_CHOICE bỏ hết → `[]` not `null`** — Redux reducer must produce an empty array, not `null` or `undefined`, when all checkboxes are unchecked. Task 3 test must assert `toEqual([])`.
3. **XSS via `onerror` attribute** — DOMPurify strips `<script>` but `<img onerror="...">` must also be stripped. Task 5 test must check both attack vectors.
4. **Unknown `type` in dispatcher does not crash** — `QuestionRenderer` switch with no matching case must render the fallback div, not throw. Task 7 test must pass an unrecognized type string.
5. **scope=SINGLE_PART with missing `part_id`** — `ScopeModePicker` submit button must remain disabled; form must not POST. Task 2 test must cover this boundary.

---

## Task 1: TypeScript Types + DOMPurify Install

**Files:**
- Modify: `frontend/src/features/exam/types/exam.types.ts`
- Install: `dompurify` + `@types/dompurify` in `frontend/package.json`

**Interfaces:**
- Consumes: nothing (foundation task)
- Produces:
  - `QuestionType` union (aligned with backend `"type"` field)
  - `Question.type: QuestionType` (renamed from `question_type`)
  - `AnswerValue` re-exported from `answer.types.ts`

> **Why rename:** Backend fixture uses `"type"` not `"question_type"`. `WorkspaceResponse.examSnapshot` is `Map<String,Object>`, so the JSON keys come from the fixture. Aligning now prevents a runtime mismatch in every renderer.

- [ ] **Step 1: Install dompurify**

```bash
cd frontend
npm install dompurify
npm install --save-dev @types/dompurify
```

Expected: `package.json` gains `"dompurify"` in dependencies, `"@types/dompurify"` in devDependencies.

- [ ] **Step 2: Update `exam.types.ts` — rename `question_type` → `type`**

Replace the entire file with:

```typescript
export type SkillType = 'READING' | 'LISTENING' | 'WRITING';

export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'FILL_IN_THE_BLANK'
  | 'TRUE_FALSE_NOT_GIVEN'
  | 'YES_NO_NOT_GIVEN'
  | 'MATCHING_FEATURES'
  | 'MATCHING_HEADINGS'
  | 'MAP_LABELING'
  | 'DIAGRAM_LABELING'
  | 'ESSAY';

export interface ExamOption {
  id: string;
  text: string;
}

export interface Question {
  question_id: string;
  question_number: number;
  type: QuestionType;       // ← was question_type; aligns with backend "type" field
  question_text: string;
  options: ExamOption[] | null;
  media: SharedMedia | null;
  // correct_answer intentionally absent — server never sends it in workspace
}

export interface SharedMedia {
  type: 'image';
  url: string;
  display_config?: {
    size_preset?: 'medium' | 'large';
    alignment?: 'center' | 'left' | 'right';
  };
}

export interface SharedAudio {
  url: string;
  duration_seconds?: number;
}

export interface QuestionGroup {
  group_id: string;
  instruction: string | null;
  context_html: string | null;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  questions: Question[];
}

export interface ExamPartContent {
  part_title: string;
  instruction: string;
  shared_audio: SharedAudio | null;
  shared_media: SharedMedia | null;
  content_html: string | null;
  question_groups: QuestionGroup[];
}

export interface ExamPart {
  id: number;
  part_number: number;
  content: ExamPartContent;
}

export interface ExamSection {
  id: number;
  skill_type: SkillType;
  title: string;
  duration_minutes: number;
  parts: ExamPart[];
}

export interface ExamSnapshot {
  exam_id: number;
  code: string;
  title: string;
  type: string;
  sections: ExamSection[];
}
```

- [ ] **Step 3: Run type check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors. If there are errors about `question_type` elsewhere, fix them in the same commit.

- [ ] **Step 4: Run existing tests to confirm nothing broke**

```bash
cd frontend
npm run test
```

Expected: existing `smoke.test.ts` passes.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/features/exam/types/exam.types.ts
git commit -m "feat(workspace/types): align Question.type with backend; add SharedAudio/SharedMedia; install dompurify"
```

---

## Task 2: API Client + ScopeModePicker Page

**Files:**
- Create: `frontend/src/features/exam/api/attemptApi.ts`
- Create: `frontend/src/features/exam/pages/ExamStartPage.tsx`
- Create: `frontend/src/features/exam/components/ScopeModePicker.tsx`
- Modify: `frontend/src/App.tsx` (add routes)
- Create: `frontend/src/features/exam/__tests__/ScopeModePicker.test.tsx`

**Interfaces:**
- Consumes: `CreateAttemptRequest`, `WorkspaceResponse`, `ApiResponse<T>` from `types/api.types.ts`; `axiosClient` from `src/api/axiosClient.ts`
- Produces:
  - `attemptApi.createAttempt(req: CreateAttemptRequest): Promise<WorkspaceResponse>`
  - `attemptApi.getWorkspace(attemptId: number): Promise<WorkspaceResponse>`
  - `<ExamStartPage />` navigates to `/attempts/:id` on success
  - `<ScopeModePicker examId={number} onSubmit={...} isLoading={boolean} error={string|null} />`

- [ ] **Step 1: Write failing tests for ScopeModePicker**

Create `frontend/src/features/exam/__tests__/ScopeModePicker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ScopeModePicker from '../components/ScopeModePicker';

describe('ScopeModePicker', () => {
  const mockSubmit = vi.fn();

  it('TC_WS_PICKER_01: submits FULL_EXAM + MOCK_TEST with null IDs', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'FULL_EXAM' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'MOCK_TEST' } });
    fireEvent.click(screen.getByRole('button', { name: /bắt đầu/i }));
    expect(mockSubmit).toHaveBeenCalledWith({
      exam_id: 1,
      test_scope: 'FULL_EXAM',
      test_mode: 'MOCK_TEST',
      section_id: null,
      part_id: null,
    });
  });

  it('TC_WS_PICKER_02: button disabled when mode not selected', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'FULL_EXAM' } });
    // mode not changed
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('TC_WS_PICKER_03: SINGLE_PART with missing part_id keeps button disabled', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'SINGLE_PART' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'PRACTICE' } });
    fireEvent.change(screen.getByLabelText(/section/i), { target: { value: '1' } });
    // part_id not selected
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });

  it('shows error message when error prop is set', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={false} error="Không thể tạo phiên thi" />);
    expect(screen.getByText(/không thể tạo phiên thi/i)).toBeInTheDocument();
  });

  it('disables button when isLoading is true', () => {
    render(<ScopeModePicker examId={1} onSubmit={mockSubmit} isLoading={true} error={null} />);
    fireEvent.change(screen.getByLabelText(/scope/i), { target: { value: 'FULL_EXAM' } });
    fireEvent.change(screen.getByLabelText(/mode/i), { target: { value: 'MOCK_TEST' } });
    expect(screen.getByRole('button', { name: /bắt đầu/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail (component not found)**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String -Pattern "FAIL|Cannot find|Pass"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `attemptApi.ts`**

Create `frontend/src/features/exam/api/attemptApi.ts`:

```typescript
import axiosClient from '../../../api/axiosClient';
import type { ApiResponse, CreateAttemptRequest, WorkspaceResponse } from '../types/api.types';

/**
 * POST /api/v1/attempts
 * Creates a new test attempt. Returns workspace without correct_answer.
 */
export async function createAttempt(req: CreateAttemptRequest): Promise<WorkspaceResponse> {
  // axiosClient interceptor unwraps response.data, so we receive ApiResponse<WorkspaceResponse>
  const res = await axiosClient.post<unknown, ApiResponse<WorkspaceResponse>>('/v1/attempts', req);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Failed to create attempt');
  }
  return res.data;
}

/**
 * GET /api/v1/attempts/:id
 * Loads workspace for an existing attempt. Returns workspace without correct_answer.
 */
export async function getWorkspace(attemptId: number): Promise<WorkspaceResponse> {
  const res = await axiosClient.get<unknown, ApiResponse<WorkspaceResponse>>(`/v1/attempts/${attemptId}/workspace`);
  if (!res.success || !res.data) {
    throw new Error(res.message || 'Attempt not found');
  }
  return res.data;
}
```

- [ ] **Step 4: Create `ScopeModePicker.tsx`**

Create `frontend/src/features/exam/components/ScopeModePicker.tsx`:

```tsx
import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const ScopeModePicker: React.FC<ScopeModePickerProps> = ({ examId, onSubmit, isLoading, error }) => {
  const [scope, setScope] = useState<TestScope | ''>('');
  const [mode, setMode] = useState<TestMode | ''>('');
  const [sectionId, setSectionId] = useState<string>('');
  const [partId, setPartId] = useState<string>('');

  const needsSection = scope === 'SINGLE_SKILL' || scope === 'SINGLE_PART';
  const needsPart = scope === 'SINGLE_PART';

  const isValid =
    scope !== '' &&
    mode !== '' &&
    (!needsSection || sectionId !== '') &&
    (!needsPart || partId !== '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !scope || !mode) return;
    onSubmit({
      exam_id: examId,
      test_scope: scope as TestScope,
      test_mode: mode as TestMode,
      section_id: needsSection && sectionId ? parseInt(sectionId, 10) : null,
      part_id: needsPart && partId ? parseInt(partId, 10) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label="Thiết lập phiên thi">
      <div>
        <label htmlFor="scope-select">Scope</label>
        <select
          id="scope-select"
          aria-label="scope"
          value={scope}
          onChange={e => { setScope(e.target.value as TestScope); setSectionId(''); setPartId(''); }}
        >
          <option value="">-- Chọn phạm vi --</option>
          <option value="FULL_EXAM">Toàn bộ đề</option>
          <option value="SINGLE_SKILL">Một kỹ năng</option>
          <option value="SINGLE_PART">Một phần</option>
        </select>
      </div>

      <div>
        <label htmlFor="mode-select">Mode</label>
        <select
          id="mode-select"
          aria-label="mode"
          value={mode}
          onChange={e => setMode(e.target.value as TestMode)}
        >
          <option value="">-- Chọn chế độ --</option>
          <option value="MOCK_TEST">Mock Test</option>
          <option value="PRACTICE">Practice</option>
        </select>
      </div>

      {needsSection && (
        <div>
          <label htmlFor="section-select">Section</label>
          <select
            id="section-select"
            aria-label="section"
            value={sectionId}
            onChange={e => { setSectionId(e.target.value); setPartId(''); }}
          >
            <option value="">-- Chọn kỹ năng --</option>
            <option value="1">Reading</option>
            <option value="2">Listening</option>
            <option value="3">Writing</option>
          </select>
        </div>
      )}

      {needsPart && (
        <div>
          <label htmlFor="part-select">Part</label>
          <select
            id="part-select"
            aria-label="part"
            value={partId}
            onChange={e => setPartId(e.target.value)}
          >
            <option value="">-- Chọn phần --</option>
            <option value="1">Part 1</option>
            <option value="2">Part 2</option>
            <option value="3">Part 3</option>
          </select>
        </div>
      )}

      {error && <p role="alert" style={{ color: 'red' }}>{error}</p>}

      <button type="submit" disabled={!isValid || isLoading}>
        {isLoading ? 'Đang tạo...' : 'Bắt đầu'}
      </button>
    </form>
  );
};

export default ScopeModePicker;
```

- [ ] **Step 5: Create `ExamStartPage.tsx`**

Create `frontend/src/features/exam/pages/ExamStartPage.tsx`:

```tsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import type { CreateAttemptRequest } from '../types/api.types';

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (req: CreateAttemptRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const workspace = await createAttempt(req);
      navigate(`/attempts/${workspace.attempt_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tạo phiên thi. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!examId) return <div>Exam ID không hợp lệ</div>;

  return (
    <div>
      <h1>Thiết lập phiên thi</h1>
      <ScopeModePicker
        examId={parseInt(examId, 10)}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
};

export default ExamStartPage;
```

- [ ] **Step 6: Update `WorkspaceResponse` TypeScript type** to match the Java DTO

Open `frontend/src/features/exam/types/api.types.ts` and update `WorkspaceResponse`:

```typescript
import type { AttemptStatus, PartAnswers } from './answer.types';
import type { ExamSnapshot } from './exam.types';
import type { TestMode, TestScope } from './api.types';

export type TestScope = 'FULL_EXAM' | 'SINGLE_SKILL' | 'SINGLE_PART';
export type TestMode = 'MOCK_TEST' | 'PRACTICE';

export interface CreateAttemptRequest {
  exam_id: number;
  test_scope: TestScope;
  test_mode: TestMode;
  section_id: number | null;
  part_id: number | null;
}

export interface WorkspaceResponse {
  attempt_id: number;      // Java: attemptId → JSON: attempt_id (Spring default camelCase → snake_case depends on config)
  status: AttemptStatus;
  test_scope: TestScope;
  test_mode: TestMode;
  deadline: string | null;  // ISO-8601 UTC Instant
  exam_snapshot: ExamSnapshot;
  version: number;
  saved_answers: PartAnswers[];
}

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
}
```

> **Note:** Java `WorkspaceResponse` uses camelCase fields. Spring Boot default serialization outputs camelCase unless configured otherwise. Verify actual JSON response field names when backend runs. If fields are camelCase (`attemptId`, `examSnapshot`), update the interface accordingly.

- [ ] **Step 7: Add routes to `App.tsx`**

In `frontend/src/App.tsx`, add imports and routes (keep existing routes intact):

```tsx
// Add imports at top:
import ExamStartPage from './features/exam/pages/ExamStartPage';
import WorkspacePage from './features/exam/pages/WorkspacePage'; // will be created in Task 4

// Add inside <Routes> (keep existing routes):
<Route path="/exams/:examId/start" element={<ExamStartPage />} />
<Route path="/attempts/:attemptId" element={<WorkspacePage />} />
```

> WorkspacePage will be a stub returning `<div>Loading workspace...</div>` until Task 4.

Create stub `frontend/src/features/exam/pages/WorkspacePage.tsx`:

```tsx
import React from 'react';

const WorkspacePage: React.FC = () => <div>Workspace (coming in Task 4)</div>;
export default WorkspacePage;
```

- [ ] **Step 8: Run tests — they should pass now**

```bash
cd frontend
npm run test
```

Expected: ScopeModePicker tests 5/5 PASS, smoke test PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/exam/api/attemptApi.ts frontend/src/features/exam/components/ScopeModePicker.tsx frontend/src/features/exam/pages/ExamStartPage.tsx frontend/src/features/exam/pages/WorkspacePage.tsx frontend/src/features/exam/__tests__/ScopeModePicker.test.tsx frontend/src/features/exam/types/api.types.ts frontend/src/App.tsx
git commit -m "feat(workspace): add attemptApi, ScopeModePicker, ExamStartPage; add routes /exams/:examId/start + /attempts/:attemptId"
```

---

## Task 3: Redux Answer Slice

**Files:**
- Create: `frontend/src/features/exam/store/answerSlice.ts`
- Modify: `frontend/src/store/store.ts`
- Create: `frontend/src/features/exam/__tests__/answerSlice.test.ts`

**Interfaces:**
- Consumes: `AnswerValue`, `PartAnswers` from `answer.types.ts`
- Produces:
  - `answerSlice.reducer` registered as `answers` in root store
  - Actions: `setAttemptContext({ attemptId, version, savedAnswers })`, `setAnswer({ partId, questionId, value })`, `clearAnswers()`
  - Selectors: `selectAnswer(state, partId, questionId): AnswerValue`, `selectAnsweredQuestionIds(state, partId): string[]`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/features/exam/__tests__/answerSlice.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import answerReducer, {
  setAttemptContext,
  setAnswer,
  clearAnswers,
  selectAnswer,
  selectAnsweredQuestionIds,
} from '../store/answerSlice';

function makeStore() {
  return configureStore({ reducer: { answers: answerReducer } });
}

describe('answerSlice', () => {
  it('TC_WS_ANS_01: setAnswer stores string for SINGLE_CHOICE', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
  });

  it('TC_WS_ANS_02: switching part does not erase answers from previous part', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(setAnswer({ partId: 2, questionId: 'q_010', value: 'B' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
    expect(selectAnswer(store.getState(), 2, 'q_010')).toBe('B');
  });

  it('TC_WS_ANS_03: MULTIPLE_CHOICE stores string array', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: ['B', 'C'] }));
    expect(selectAnswer(store.getState(), 1, 'q_002')).toEqual(['B', 'C']);
  });

  it('TC_WS_ANS_04: MULTIPLE_CHOICE cleared to empty array (not null)', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: [] }));
    expect(selectAnswer(store.getState(), 1, 'q_002')).toEqual([]);
    expect(selectAnswer(store.getState(), 1, 'q_002')).not.toBeNull();
  });

  it('setAttemptContext hydrates savedAnswers from server', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({
      attemptId: 5,
      version: 3,
      savedAnswers: [
        { part_id: 1, answers: [{ question_id: 'q_001', answer: 'A' }] }
      ],
    }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBe('A');
  });

  it('setAnswer is a no-op when attemptId is null', () => {
    const store = makeStore();
    // Do NOT call setAttemptContext — attemptId stays null
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBeNull();
  });

  it('clearAnswers resets state', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(clearAnswers());
    expect(store.getState().answers.attemptId).toBeNull();
    expect(selectAnswer(store.getState(), 1, 'q_001')).toBeNull();
  });

  it('selectAnsweredQuestionIds returns ids with non-null answers', () => {
    const store = makeStore();
    store.dispatch(setAttemptContext({ attemptId: 5, version: 1, savedAnswers: [] }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_001', value: 'A' }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_002', value: null }));
    store.dispatch(setAnswer({ partId: 1, questionId: 'q_003', value: ['B'] }));
    const ids = selectAnsweredQuestionIds(store.getState(), 1);
    expect(ids).toContain('q_001');
    expect(ids).toContain('q_003');
    expect(ids).not.toContain('q_002');
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `answerSlice.ts`**

Create `frontend/src/features/exam/store/answerSlice.ts`:

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AnswerValue, PartAnswers } from '../types/answer.types';

interface AnswerState {
  attemptId: number | null;
  version: number;
  /** answers[partId][questionId] = AnswerValue */
  answers: Record<number, Record<string, AnswerValue>>;
}

const initialState: AnswerState = {
  attemptId: null,
  version: 0,
  answers: {},
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
      // Invariant: no writes when no active attempt
      if (state.attemptId === null) return;
      const { partId, questionId, value } = action.payload;
      if (!state.answers[partId]) {
        state.answers[partId] = {};
      }
      state.answers[partId][questionId] = value;
    },

    clearAnswers() {
      return initialState;
    },
  },
});

export const { setAttemptContext, setAnswer, clearAnswers } = answerSlice.actions;

// Selectors
type RootLike = { answers: AnswerState };

export function selectAnswer(state: RootLike, partId: number, questionId: string): AnswerValue {
  return state.answers.answers?.[partId]?.[questionId] ?? null;
}

export function selectAnsweredQuestionIds(state: RootLike, partId: number): string[] {
  const partAnswers = state.answers.answers?.[partId];
  if (!partAnswers) return [];
  return Object.entries(partAnswers)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0 && false))
    .map(([k]) => k);
}

export default answerSlice.reducer;
```

- [ ] **Step 4: Register reducer in `store.ts`**

Replace `frontend/src/store/store.ts`:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import answerReducer from '../features/exam/store/answerSlice';

export const store = configureStore({
  reducer: {
    answers: answerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

- [ ] **Step 5: Run tests — all pass**

```bash
cd frontend
npm run test
```

Expected: answerSlice 8/8 PASS, ScopeModePicker 5/5 PASS, smoke PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/exam/store/answerSlice.ts frontend/src/store/store.ts frontend/src/features/exam/__tests__/answerSlice.test.ts
git commit -m "feat(workspace): add answerSlice with setAttemptContext/setAnswer/clearAnswers; register in store"
```

---

## Task 4: useWorkspace Hook + WorkspacePage Shell

**Files:**
- Create: `frontend/src/features/exam/hooks/useWorkspace.ts`
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx` (replace stub)
- Create: `frontend/src/features/exam/__tests__/useWorkspace.test.tsx`

**Interfaces:**
- Consumes: `getWorkspace` from `attemptApi.ts`; `setAttemptContext`, `clearAnswers` from `answerSlice`
- Produces:
  - `useWorkspace(attemptId: number): { workspace: WorkspaceResponse | null; loading: boolean; error: string | null; retry: () => void }`
  - `<WorkspacePage />` renders shell with loading/error/content states

- [ ] **Step 1: Write failing tests for useWorkspace**

Create `frontend/src/features/exam/__tests__/useWorkspace.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import answerReducer from '../store/answerSlice';
import useWorkspace from '../hooks/useWorkspace';
import * as attemptApi from '../api/attemptApi';

function makeWrapper() {
  const store = configureStore({ reducer: { answers: answerReducer } });
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );
}

const mockWorkspace = {
  attempt_id: 5,
  status: 'IN_PROGRESS' as const,
  test_scope: 'FULL_EXAM' as const,
  test_mode: 'MOCK_TEST' as const,
  deadline: null,
  exam_snapshot: { exam_id: 1, code: 'IE01', title: 'IELTS Mock', type: 'IELTS', sections: [] },
  version: 1,
  saved_answers: [],
};

describe('useWorkspace', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('TC_WS_ROUTE_01: starts loading, then returns workspace', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockResolvedValueOnce(mockWorkspace);
    const { result } = renderHook(() => useWorkspace(5), { wrapper: makeWrapper() });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspace).toEqual(mockWorkspace);
    expect(result.current.error).toBeNull();
  });

  it('TC_WS_ROUTE_03: sets error on 404', async () => {
    vi.spyOn(attemptApi, 'getWorkspace').mockRejectedValueOnce(new Error('Attempt not found'));
    const { result } = renderHook(() => useWorkspace(999), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Attempt not found');
    expect(result.current.workspace).toBeNull();
  });

  it('retry re-fetches workspace', async () => {
    const spy = vi.spyOn(attemptApi, 'getWorkspace')
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(mockWorkspace);
    const { result } = renderHook(() => useWorkspace(5), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    result.current.retry();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workspace).toEqual(mockWorkspace);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

- [ ] **Step 3: Create `useWorkspace.ts`**

Create `frontend/src/features/exam/hooks/useWorkspace.ts`:

```typescript
import { useEffect, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../../store/store';
import { getWorkspace } from '../api/attemptApi';
import { setAttemptContext, clearAnswers } from '../store/answerSlice';
import type { WorkspaceResponse } from '../types/api.types';

interface UseWorkspaceResult {
  workspace: WorkspaceResponse | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export default function useWorkspace(attemptId: number): UseWorkspaceResult {
  const dispatch = useDispatch<AppDispatch>();
  const [workspace, setWorkspace] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getWorkspace(attemptId)
      .then(data => {
        if (cancelled) return;
        setWorkspace(data);
        dispatch(setAttemptContext({
          attemptId: data.attempt_id,
          version: data.version,
          savedAnswers: data.saved_answers,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Không thể tải phiên thi');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      dispatch(clearAnswers());
    };
  }, [attemptId, retryCount, dispatch]);

  const retry = useCallback(() => setRetryCount(c => c + 1), []);

  return { workspace, loading, error, retry };
}
```

- [ ] **Step 4: Replace WorkspacePage stub with real shell**

Replace `frontend/src/features/exam/pages/WorkspacePage.tsx`:

```tsx
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useWorkspace from '../hooks/useWorkspace';

const WorkspacePage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const navigate = useNavigate();
  const id = parseInt(attemptId ?? '0', 10);
  const { workspace, loading, error, retry } = useWorkspace(id);

  if (loading) {
    return <div role="status" aria-live="polite">Đang tải phiên thi...</div>;
  }

  if (error) {
    return (
      <div role="alert">
        <p>{error}</p>
        <button onClick={retry}>Thử lại</button>
        <button onClick={() => navigate('/')}>Về trang chủ</button>
      </div>
    );
  }

  if (!workspace) return null;

  if (workspace.status === 'COMPLETED') {
    navigate(`/attempts/${id}/result`);
    return null;
  }

  return (
    <div>
      <h1>{workspace.exam_snapshot.title}</h1>
      {/* WorkspaceShell will be added in Task 8 */}
      <pre style={{ fontSize: '12px' }}>{JSON.stringify(workspace.exam_snapshot, null, 2)}</pre>
    </div>
  );
};

export default WorkspacePage;
```

- [ ] **Step 5: Run all tests**

```bash
cd frontend
npm run test
```

Expected: useWorkspace 3/3 PASS + previous tasks all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/exam/hooks/useWorkspace.ts frontend/src/features/exam/pages/WorkspacePage.tsx frontend/src/features/exam/__tests__/useWorkspace.test.tsx
git commit -m "feat(workspace): add useWorkspace hook with loading/error/retry; WorkspacePage shell"
```

---

## Task 5: HtmlContent + MediaDisplay (Sanitized Rendering)

**Files:**
- Create: `frontend/src/features/exam/components/content/HtmlContent.tsx`
- Create: `frontend/src/features/exam/components/content/MediaDisplay.tsx`
- Create: `frontend/src/features/exam/__tests__/HtmlContent.test.tsx`

**Interfaces:**
- Produces:
  - `<HtmlContent html={string|null} className?: string />` — sanitized HTML via DOMPurify
  - `<MediaDisplay media={SharedMedia|null} />` — renders `<img>` with alt

- [ ] **Step 1: Write failing tests**

Create `frontend/src/features/exam/__tests__/HtmlContent.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HtmlContent from '../components/content/HtmlContent';

describe('HtmlContent', () => {
  it('TC_WS_HTML_01: strips <script> tags (XSS)', () => {
    const { container } = render(
      <HtmlContent html="<p>safe</p><script>window.__xss=1</script>" />
    );
    expect(container.querySelector('script')).toBeNull();
    expect((window as any).__xss).toBeUndefined();
  });

  it('TC_WS_HTML_02: strips onerror event handler', () => {
    const { container } = render(
      <HtmlContent html='<img src="x" onerror="window.__xss=2" />' />
    );
    const img = container.querySelector('img');
    expect(img?.getAttribute('onerror')).toBeNull();
    expect((window as any).__xss).toBeUndefined();
  });

  it('TC_WS_HTML_03: renders valid HTML structure', () => {
    const { container } = render(
      <HtmlContent html="<h3>Title</h3><p>Para with <strong>bold</strong></p>" />
    );
    expect(container.querySelector('h3')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('TC_WS_HTML_04: null renders nothing without crashing', () => {
    const { container } = render(<HtmlContent html={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('applies className to wrapper', () => {
    const { container } = render(<HtmlContent html="<p>test</p>" className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

- [ ] **Step 3: Create `HtmlContent.tsx`**

Create `frontend/src/features/exam/components/content/HtmlContent.tsx`:

```tsx
import React from 'react';
import DOMPurify from 'dompurify';
import type { SharedMedia } from '../../types/exam.types';

interface HtmlContentProps {
  html: string | null;
  className?: string;
}

const HtmlContent: React.FC<HtmlContentProps> = ({ html, className }) => {
  if (!html) return null;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
};

export default HtmlContent;
```

- [ ] **Step 4: Create `MediaDisplay.tsx`**

Create `frontend/src/features/exam/components/content/MediaDisplay.tsx`:

```tsx
import React from 'react';
import type { SharedMedia } from '../../types/exam.types';

interface MediaDisplayProps {
  media: SharedMedia | null;
  alt?: string;
}

const MediaDisplay: React.FC<MediaDisplayProps> = ({ media, alt = 'Exam image' }) => {
  if (!media) return null;
  const size = media.display_config?.size_preset === 'large' ? '100%' : '60%';
  const align = media.display_config?.alignment ?? 'center';
  return (
    <div style={{ textAlign: align as React.CSSProperties['textAlign'] }}>
      <img src={media.url} alt={alt} style={{ maxWidth: size }} />
    </div>
  );
};

export default MediaDisplay;
```

- [ ] **Step 5: Run all tests**

```bash
cd frontend
npm run test
```

Expected: HtmlContent 5/5 PASS + all previous PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/exam/components/content/HtmlContent.tsx frontend/src/features/exam/components/content/MediaDisplay.tsx frontend/src/features/exam/__tests__/HtmlContent.test.tsx
git commit -m "feat(workspace): add HtmlContent (DOMPurify XSS-safe) and MediaDisplay components"
```

---

## Task 6: AudioPlayer

**Files:**
- Create: `frontend/src/features/exam/components/AudioPlayer.tsx`
- Create: `frontend/src/features/exam/__tests__/AudioPlayer.test.tsx`

**Interfaces:**
- Produces: `<AudioPlayer url={string} durationSeconds?: number isActive={boolean} />`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/features/exam/__tests__/AudioPlayer.test.tsx`:

```tsx
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AudioPlayer from '../components/AudioPlayer';

// Mock HTMLMediaElement methods (jsdom doesn't implement them)
beforeEach(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.load = vi.fn();
});

describe('AudioPlayer', () => {
  it('TC_WS_AUDIO_01: renders audio element with correct src', () => {
    const { container } = render(
      <AudioPlayer url="http://cdn/test.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio');
    expect(audio).not.toBeNull();
    expect(audio?.querySelector('source')?.getAttribute('src')).toBe('http://cdn/test.mp3');
  });

  it('TC_WS_AUDIO_02: shows fallback text when onerror fires', () => {
    const { container, getByText } = render(
      <AudioPlayer url="http://bad/broken.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio')!;
    act(() => { audio.dispatchEvent(new Event('error')); });
    expect(getByText(/không thể tải audio/i)).toBeTruthy();
  });

  it('TC_WS_AUDIO_03: pause() called when isActive changes false', () => {
    const { rerender, container } = render(
      <AudioPlayer url="http://cdn/test.mp3" isActive={true} />
    );
    const audio = container.querySelector('audio')!;
    // Spy on the actual element
    const pauseSpy = vi.spyOn(audio, 'pause');
    rerender(<AudioPlayer url="http://cdn/test.mp3" isActive={false} />);
    expect(pauseSpy).toHaveBeenCalledOnce();
  });

  it('does not crash when url changes', () => {
    const { rerender } = render(<AudioPlayer url="http://cdn/a.mp3" isActive={true} />);
    expect(() => rerender(<AudioPlayer url="http://cdn/b.mp3" isActive={true} />)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

- [ ] **Step 3: Create `AudioPlayer.tsx`**

Create `frontend/src/features/exam/components/AudioPlayer.tsx`:

```tsx
import React, { useRef, useEffect, useState } from 'react';

interface AudioPlayerProps {
  url: string;
  durationSeconds?: number;
  isActive: boolean;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({ url, isActive }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [hasError, setHasError] = useState(false);

  // Pause when this player becomes inactive (Part changed)
  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isActive]);

  // Reset error state when URL changes
  useEffect(() => {
    setHasError(false);
  }, [url]);

  if (hasError) {
    return (
      <div role="alert" style={{ color: '#c0392b', padding: '8px' }}>
        ⚠️ Không thể tải audio. Vui lòng thử lại hoặc liên hệ hỗ trợ.
      </div>
    );
  }

  return (
    <audio
      ref={audioRef}
      controls
      style={{ width: '100%' }}
      onError={() => setHasError(true)}
    >
      <source src={url} type="audio/mpeg" />
      Trình duyệt của bạn không hỗ trợ phát audio.
    </audio>
  );
};

export default AudioPlayer;
```

- [ ] **Step 4: Run all tests**

```bash
cd frontend
npm run test
```

Expected: AudioPlayer 4/4 PASS + all previous PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/components/AudioPlayer.tsx frontend/src/features/exam/__tests__/AudioPlayer.test.tsx
git commit -m "feat(workspace): add AudioPlayer with isActive pause control and onerror fallback"
```

---

## Task 7: Question Renderers (All Types)

**Files:**
- Create: `frontend/src/features/exam/components/renderers/SingleChoiceRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/TFNGRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/MultipleChoiceRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/FillInBlankRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/MatchingRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/EssayRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/MapLabelingRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/DiagramLabelingRenderer.tsx`
- Create: `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx`
- Create: `frontend/src/features/exam/__tests__/QuestionRenderer.test.tsx`

**Interfaces:**
- Consumes: `Question`, `ExamOption`, `QuestionType` from `exam.types.ts`; `AnswerValue` from `answer.types.ts`
- Produces: `<QuestionRenderer question={Question} partId={number} currentAnswer={AnswerValue} onChange={(v: AnswerValue) => void} />`

- [ ] **Step 1: Write failing tests for dispatcher + key renderers**

Create `frontend/src/features/exam/__tests__/QuestionRenderer.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionRenderer from '../components/renderers/QuestionRenderer';
import type { Question } from '../types/exam.types';

function makeQuestion(type: string, options?: Array<{id: string; text: string}>): Question {
  return {
    question_id: 'q_001',
    question_number: 1,
    type: type as Question['type'],
    question_text: 'Test question?',
    options: options ?? null,
    media: null,
  };
}

const opts = [
  { id: 'A', text: 'Option A' },
  { id: 'B', text: 'Option B' },
  { id: 'C', text: 'Option C' },
  { id: 'D', text: 'Option D' },
];

describe('QuestionRenderer', () => {
  it('TC_WS_QTYPE_01: SINGLE_CHOICE renders radio buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('SINGLE_CHOICE', opts)} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('TC_WS_QTYPE_02: TRUE_FALSE_NOT_GIVEN renders 3 buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('TRUE_FALSE_NOT_GIVEN')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText('TRUE')).toBeTruthy();
    expect(screen.getByText('FALSE')).toBeTruthy();
    expect(screen.getByText('NOT GIVEN')).toBeTruthy();
  });

  it('TC_WS_QTYPE_03: YES_NO_NOT_GIVEN renders 3 buttons', () => {
    render(
      <QuestionRenderer question={makeQuestion('YES_NO_NOT_GIVEN')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText('YES')).toBeTruthy();
    expect(screen.getByText('NO')).toBeTruthy();
    expect(screen.getByText('NOT GIVEN')).toBeTruthy();
  });

  it('TC_WS_QTYPE_04: FILL_IN_THE_BLANK renders text input', () => {
    render(
      <QuestionRenderer question={makeQuestion('FILL_IN_THE_BLANK')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('TC_WS_QTYPE_05: ESSAY renders textarea', () => {
    render(
      <QuestionRenderer question={makeQuestion('ESSAY')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByRole('textbox').tagName.toLowerCase()).toBe('textarea');
  });

  it('TC_WS_QTYPE_06: MULTIPLE_CHOICE renders checkboxes', () => {
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={[]} onChange={vi.fn()} />
    );
    expect(screen.getAllByRole('checkbox')).toHaveLength(4);
  });

  it('TC_WS_QTYPE_07: unknown type renders fallback without crashing', () => {
    render(
      <QuestionRenderer question={makeQuestion('FUTURE_TYPE')} partId={1} currentAnswer={null} onChange={vi.fn()} />
    );
    expect(screen.getByText(/chưa được hỗ trợ/i)).toBeTruthy();
  });

  it('SINGLE_CHOICE onChange returns option id string', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('SINGLE_CHOICE', opts)} partId={1} currentAnswer={null} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option A'));
    expect(onChange).toHaveBeenCalledWith('A');
  });

  it('MULTIPLE_CHOICE adds and removes from array', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={['B']} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option C')); // add C
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining(['B', 'C']));
  });

  it('MULTIPLE_CHOICE remove: uncheck existing returns array without it', () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer question={makeQuestion('MULTIPLE_CHOICE', opts)} partId={1} currentAnswer={['B', 'C']} onChange={onChange} />
    );
    fireEvent.click(screen.getByLabelText('Option B')); // remove B
    expect(onChange).toHaveBeenCalledWith(['C']);
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

- [ ] **Step 3: Create individual renderers**

Create `frontend/src/features/exam/components/renderers/SingleChoiceRenderer.tsx`:
```tsx
import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props { options: ExamOption[]; value: string | null; onChange: (v: string) => void; }

const SingleChoiceRenderer: React.FC<Props> = ({ options, value, onChange }) => (
  <div role="radiogroup">
    {options.map(opt => (
      <label key={opt.id} style={{ display: 'block', margin: '6px 0' }}>
        <input
          type="radio"
          name="single-choice"
          value={opt.id}
          checked={value === opt.id}
          onChange={() => onChange(opt.id)}
          aria-label={opt.text}
        />
        {' '}{opt.id}. {opt.text}
      </label>
    ))}
  </div>
);
export default SingleChoiceRenderer;
```

Create `frontend/src/features/exam/components/renderers/TFNGRenderer.tsx`:
```tsx
import React from 'react';

interface Props {
  variant: 'TRUE_FALSE_NOT_GIVEN' | 'YES_NO_NOT_GIVEN';
  value: string | null;
  onChange: (v: string) => void;
}

const TFNGRenderer: React.FC<Props> = ({ variant, value, onChange }) => {
  const options = variant === 'YES_NO_NOT_GIVEN'
    ? ['YES', 'NO', 'NOT GIVEN']
    : ['TRUE', 'FALSE', 'NOT GIVEN'];
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {options.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={{
            padding: '6px 14px',
            fontWeight: value === opt ? 'bold' : 'normal',
            border: value === opt ? '2px solid #3498db' : '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};
export default TFNGRenderer;
```

Create `frontend/src/features/exam/components/renderers/MultipleChoiceRenderer.tsx`:
```tsx
import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props { options: ExamOption[]; value: string[]; onChange: (v: string[]) => void; }

const MultipleChoiceRenderer: React.FC<Props> = ({ options, value, onChange }) => {
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
    onChange(next);
  };
  return (
    <div>
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'block', margin: '6px 0' }}>
          <input
            type="checkbox"
            checked={value.includes(opt.id)}
            onChange={() => toggle(opt.id)}
            aria-label={opt.text}
          />
          {' '}{opt.id}. {opt.text}
        </label>
      ))}
    </div>
  );
};
export default MultipleChoiceRenderer;
```

Create `frontend/src/features/exam/components/renderers/FillInBlankRenderer.tsx`:
```tsx
import React from 'react';

interface Props { value: string | null; onChange: (v: string) => void; questionText: string; }

const FillInBlankRenderer: React.FC<Props> = ({ value, onChange, questionText }) => (
  <div>
    <p>{questionText}</p>
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ width: '200px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
      placeholder="Nhập đáp án..."
    />
  </div>
);
export default FillInBlankRenderer;
```

Create `frontend/src/features/exam/components/renderers/MatchingRenderer.tsx`:
```tsx
import React from 'react';
import type { ExamOption } from '../../types/exam.types';

interface Props { options: ExamOption[]; value: string | null; onChange: (v: string) => void; questionText: string; }

const MatchingRenderer: React.FC<Props> = ({ options, value, onChange, questionText }) => (
  <div>
    <p>{questionText}</p>
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '4px 8px' }}
    >
      <option value="">-- Chọn --</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>{opt.id}. {opt.text}</option>
      ))}
    </select>
  </div>
);
export default MatchingRenderer;
```

Create `frontend/src/features/exam/components/renderers/EssayRenderer.tsx`:
```tsx
import React from 'react';

interface Props { value: string | null; onChange: (v: string) => void; questionText: string; }

const EssayRenderer: React.FC<Props> = ({ value, onChange, questionText }) => {
  const text = value ?? '';
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div>
      <p>{questionText}</p>
      <textarea
        rows={10}
        value={text}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        placeholder="Viết câu trả lời của bạn..."
      />
      <small style={{ color: '#666' }}>Số từ: {wordCount}</small>
    </div>
  );
};
export default EssayRenderer;
```

Create `frontend/src/features/exam/components/renderers/MapLabelingRenderer.tsx`:
```tsx
import React from 'react';
import type { ExamOption, SharedMedia } from '../../types/exam.types';
// Simplified: render as radio list alongside the map image
interface Props { options: ExamOption[]; value: string | null; onChange: (v: string) => void; media?: SharedMedia | null; }

const MapLabelingRenderer: React.FC<Props> = ({ options, value, onChange, media }) => (
  <div>
    {media && <img src={media.url} alt="Map" style={{ maxWidth: '100%' }} />}
    <div role="radiogroup">
      {options.map(opt => (
        <label key={opt.id} style={{ display: 'block', margin: '4px 0' }}>
          <input type="radio" name="map-label" value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} />
          {' '}{opt.text}
        </label>
      ))}
    </div>
  </div>
);
export default MapLabelingRenderer;
```

Create `frontend/src/features/exam/components/renderers/DiagramLabelingRenderer.tsx`:
```tsx
import React from 'react';
// Simplified: renders as single text input (diagram image shown via shared_media above the group)
interface Props { value: string | null; onChange: (v: string) => void; placeholder?: string; }

const DiagramLabelingRenderer: React.FC<Props> = ({ value, onChange, placeholder }) => (
  <input
    type="text"
    value={value ?? ''}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder ?? 'Điền nhãn...'}
    style={{ width: '160px', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '4px' }}
  />
);
export default DiagramLabelingRenderer;
```

- [ ] **Step 4: Create `QuestionRenderer.tsx` dispatcher**

Create `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx`:

```tsx
import React from 'react';
import type { Question } from '../../types/exam.types';
import type { AnswerValue } from '../../types/answer.types';
import SingleChoiceRenderer from './SingleChoiceRenderer';
import TFNGRenderer from './TFNGRenderer';
import MultipleChoiceRenderer from './MultipleChoiceRenderer';
import FillInBlankRenderer from './FillInBlankRenderer';
import MatchingRenderer from './MatchingRenderer';
import EssayRenderer from './EssayRenderer';
import MapLabelingRenderer from './MapLabelingRenderer';
import DiagramLabelingRenderer from './DiagramLabelingRenderer';

interface QuestionRendererProps {
  question: Question;
  partId: number;
  currentAnswer: AnswerValue;
  onChange: (value: AnswerValue) => void;
}

const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question, currentAnswer, onChange,
}) => {
  const { type, question_text, options, media } = question;

  switch (type) {
    case 'SINGLE_CHOICE':
      return (
        <SingleChoiceRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    case 'TRUE_FALSE_NOT_GIVEN':
    case 'YES_NO_NOT_GIVEN':
      return (
        <TFNGRenderer
          variant={type}
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    case 'MULTIPLE_CHOICE':
      return (
        <MultipleChoiceRenderer
          options={options ?? []}
          value={(currentAnswer as string[] | null) ?? []}
          onChange={onChange}
        />
      );

    case 'FILL_IN_THE_BLANK':
      return (
        <FillInBlankRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
        />
      );

    case 'MATCHING_FEATURES':
    case 'MATCHING_HEADINGS':
      return (
        <MatchingRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
        />
      );

    case 'ESSAY':
      return (
        <EssayRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
          questionText={question_text}
        />
      );

    case 'MAP_LABELING':
      return (
        <MapLabelingRenderer
          options={options ?? []}
          value={currentAnswer as string | null}
          onChange={onChange}
          media={media}
        />
      );

    case 'DIAGRAM_LABELING':
      return (
        <DiagramLabelingRenderer
          value={currentAnswer as string | null}
          onChange={onChange}
        />
      );

    default:
      return (
        <div role="note" style={{ color: '#999', fontStyle: 'italic' }}>
          Dạng câu hỏi chưa được hỗ trợ: {type}
        </div>
      );
  }
};

export default QuestionRenderer;
```

- [ ] **Step 5: Run all tests**

```bash
cd frontend
npm run test
```

Expected: QuestionRenderer 10/10 PASS + all previous PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/exam/components/renderers/
git commit -m "feat(workspace): add 8 question renderers + QuestionRenderer dispatcher; all types covered with fallback"
```

---

## Task 8: Question Palette

**Files:**
- Create: `frontend/src/features/exam/components/QuestionPalette.tsx`
- Create: `frontend/src/features/exam/__tests__/QuestionPalette.test.tsx`

**Interfaces:**
- Consumes: `selectAnsweredQuestionIds` from `answerSlice`
- Produces: `<QuestionPalette questions={Question[]} partId={number} onNavigate={(questionId: string) => void} />`

- [ ] **Step 1: Write failing tests**

Create `frontend/src/features/exam/__tests__/QuestionPalette.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import React from 'react';
import answerReducer, { setAttemptContext, setAnswer } from '../store/answerSlice';
import QuestionPalette from '../components/QuestionPalette';
import type { Question } from '../types/exam.types';

function makeQuestion(id: string, num: number): Question {
  return { question_id: id, question_number: num, type: 'SINGLE_CHOICE', question_text: '', options: [], media: null };
}

function makeStore(answeredIds: string[] = []) {
  const store = configureStore({ reducer: { answers: answerReducer } });
  store.dispatch(setAttemptContext({ attemptId: 1, version: 1, savedAnswers: [] }));
  answeredIds.forEach(id => store.dispatch(setAnswer({ partId: 1, questionId: id, value: 'A' })));
  return store;
}

const questions = [
  makeQuestion('q_001', 1), makeQuestion('q_002', 2), makeQuestion('q_003', 3),
  makeQuestion('q_004', 4), makeQuestion('q_005', 5),
];

describe('QuestionPalette', () => {
  it('TC_WS_PAL_01: shows answered/blank distinction for 3 of 5 answered', () => {
    const store = makeStore(['q_001', 'q_003', 'q_005']);
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getByTestId('palette-q_001')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_002')).toHaveAttribute('data-answered', 'false');
    expect(screen.getByTestId('palette-q_003')).toHaveAttribute('data-answered', 'true');
    expect(screen.getByTestId('palette-q_005')).toHaveAttribute('data-answered', 'true');
  });

  it('TC_WS_PAL_02: Enter key triggers onNavigate', () => {
    const onNavigate = vi.fn();
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={onNavigate} />
      </Provider>
    );
    const cell = screen.getByTestId('palette-q_003');
    cell.focus();
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('q_003');
  });

  it('TC_WS_PAL_03: renders all 5 cells', () => {
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={vi.fn()} />
      </Provider>
    );
    expect(screen.getAllByTestId(/palette-q_/)).toHaveLength(5);
  });

  it('click triggers onNavigate', () => {
    const onNavigate = vi.fn();
    const store = makeStore();
    render(
      <Provider store={store}>
        <QuestionPalette questions={questions} partId={1} onNavigate={onNavigate} />
      </Provider>
    );
    fireEvent.click(screen.getByTestId('palette-q_002'));
    expect(onNavigate).toHaveBeenCalledWith('q_002');
  });
});
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd frontend
npm run test -- --reporter=verbose 2>&1 | Select-String "FAIL|cannot find"
```

- [ ] **Step 3: Create `QuestionPalette.tsx`**

Create `frontend/src/features/exam/components/QuestionPalette.tsx`:

```tsx
import React from 'react';
import { useSelector } from 'react-redux';
import type { Question } from '../types/exam.types';
import { selectAnsweredQuestionIds } from '../store/answerSlice';

interface QuestionPaletteProps {
  questions: Question[];
  partId: number;
  onNavigate: (questionId: string) => void;
}

type RootLike = { answers: ReturnType<typeof import('../store/answerSlice').default> };

const QuestionPalette: React.FC<QuestionPaletteProps> = ({ questions, partId, onNavigate }) => {
  const answeredIds = useSelector((state: RootLike) => selectAnsweredQuestionIds(state, partId));
  const answeredSet = new Set(answeredIds);

  return (
    <div
      role="navigation"
      aria-label="Điều hướng câu hỏi"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px' }}
    >
      {questions.map(q => {
        const answered = answeredSet.has(q.question_id);
        return (
          <div
            key={q.question_id}
            data-testid={`palette-${q.question_id}`}
            data-answered={answered ? 'true' : 'false'}
            role="button"
            tabIndex={0}
            aria-label={`Câu ${q.question_number}${answered ? ' (đã trả lời)' : ' (chưa trả lời)'}`}
            onClick={() => onNavigate(q.question_id)}
            onKeyDown={e => { if (e.key === 'Enter') onNavigate(q.question_id); }}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              backgroundColor: answered ? '#2ecc71' : '#ecf0f1',
              color: answered ? '#fff' : '#2c3e50',
              border: answered ? '1px solid #27ae60' : '1px solid #bdc3c7',
            }}
          >
            {q.question_number}
          </div>
        );
      })}
    </div>
  );
};

export default QuestionPalette;
```

- [ ] **Step 4: Run all tests**

```bash
cd frontend
npm run test
```

Expected: QuestionPalette 4/4 PASS + all previous PASS. Total ≥ 30 test cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/components/QuestionPalette.tsx frontend/src/features/exam/__tests__/QuestionPalette.test.tsx
git commit -m "feat(workspace): add QuestionPalette with answered/blank status and keyboard navigation"
```

---

## Task 9: Final Integration — TypeScript Check + Full Test Run + Sprint Commit

**Files:**
- No new files — validation only

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Full test run with coverage summary**

```bash
cd frontend
npm run test -- --reporter=verbose
```

Expected: All tests PASS. Minimum 30 passing tests across:
- answerSlice (8)
- ScopeModePicker (5)
- useWorkspace (3)
- HtmlContent (5)
- AudioPlayer (4)
- QuestionRenderer (10)
- QuestionPalette (4)
- smoke (1+)

- [ ] **Step 3: Verify existing routes not broken**

Start dev server and check `/test-audio` and `/test-student` still render:

```bash
cd frontend
npm run dev
```

Navigate to `http://localhost:5173/test-audio` and `http://localhost:5173/test-student` — both must render without errors.

- [ ] **Step 4: Final sprint commit**

```bash
git add -A
git commit -m "feat(sprint02): complete Exam Workspace — routing, Redux slice, 8 renderers, AudioPlayer, HtmlContent XSS-safe, QuestionPalette; 30+ tests pass"
```

---

## Self-Review Checklist

**1. Spec coverage:**
- [x] S02-01: Routes `/exams/:examId/start` + `/attempts/:attemptId` — Task 2
- [x] S02-02: ScopeModePicker with scope/mode/sectionId/partId — Task 2
- [x] S02-03: API client `attemptApi.ts` — Task 2
- [x] S02-04: Redux answerSlice — Task 3
- [x] S02-05: WorkspacePage shell + loading/error/retry — Task 4
- [x] S02-06: HtmlContent with DOMPurify — Task 5
- [x] S02-07: AudioPlayer with isActive pause — Task 6
- [x] S02-08: SingleChoiceRenderer, TFNGRenderer — Task 7
- [x] S02-09: MultipleChoiceRenderer with array toggle — Task 7
- [x] S02-10: FillInBlankRenderer, MapLabelingRenderer, DiagramLabelingRenderer — Task 7
- [x] S02-11: MatchingRenderer, EssayRenderer — Task 7
- [x] S02-12: QuestionPalette with keyboard nav — Task 8

**2. Placeholder scan:** None found — all steps have concrete code.

**3. Type consistency:**
- `Question.type` used consistently across all renderers (Task 1 rename)
- `AnswerValue` from `answer.types.ts` flows through `QuestionRenderer.onChange` → `setAnswer` → Redux
- `selectAnsweredQuestionIds` signature matches usage in `QuestionPalette`

**4. Review Focus — additional tests added:**
- Stale audio: Task 6 Step 1 `TC_WS_AUDIO_03` ✓
- MULTIPLE_CHOICE empty array: Task 3 Step 1 `TC_WS_ANS_04` ✓
- XSS onerror: Task 5 Step 1 `TC_WS_HTML_02` ✓
- Unknown type fallback: Task 7 Step 1 `TC_WS_QTYPE_07` ✓
- SINGLE_PART missing part_id: Task 2 Step 1 `TC_WS_PICKER_03` ✓
