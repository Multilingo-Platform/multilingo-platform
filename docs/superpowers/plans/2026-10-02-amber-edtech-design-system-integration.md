# Amber EdTech Design System Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin and modernize the Multilingo frontend application to adopt the Amber EdTech design system tokens and layouts defined in `ui-design-template.md` and Stitch Project `5548438490588532530`.

**Architecture:** Update CSS custom properties and utility classes in `index.css` / `App.css` to switch from dark slate mode (`#0F172A`) to a clean, light, accessible EdTech theme (`#f9fafb` background, `#ffffff` cards, `#d97706` amber brand accents, `#111827` primary typography). Refactor core layout components and pages (`HomePage`, `ExamStartPage`, `WorkspacePage`, `ExamResultPage`, `QuestionPalette`, `TimerDisplay`, `SaveStatusBadge`) while preserving all existing props, test IDs, and Redux/API integrations.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS / Vanilla CSS tokens, Vitest, React Router v7, Redux Toolkit.

**Spec:** [frontend/ui-design-template.md](file:///d:/Project/University/multilingo-platform/frontend/ui-design-template.md) & Stitch Project `projects/5548438490588532530`

## Global Constraints
- Preserve all existing public contracts, test IDs (`data-testid`), component props, Redux slices, and route paths (`/`, `/exams/:examId/start`, `/attempts/:attemptId`, `/attempts/:attemptId/result`).
- Design system colors: Primary Amber `#d97706` (Hover `#b45309`, Light `#fffbeb`), Background `#f9fafb`, Surface `#ffffff`, Border `#e5e7eb`, Text `#111827`, Muted `#9ca3af`, Success `#10b981`, Danger `#ef4444`.
- Typography: Plus Jakarta Sans for headings/buttons, Inter for body/reading passages, tabular monospace for timers.
- All existing 75 unit/integration tests in `frontend/src/features/exam/__tests__` must pass.
- `npm run build` must compile with 0 TypeScript or lint errors.

## Review Focus
1. **Timer & Autosave Visibility:** Sticky header must remain fixed at top (`z-index: 20+`) with legible high-contrast badges for timer and autosave status on light `#f9fafb`/`#ffffff` backgrounds.
2. **Text Selection & Tooltip Popup:** In `WorkspacePage`, reading text must remain selectable (`user-select: text`) with clear selection styling without breaking split-pane scroll synchronization.
3. **Question Palette State Highlighting:** In `QuestionPalette`, unanswered, answered, flagged, and active states must maintain WCAG contrast against light surfaces.
4. **Result Score Breakdown:** In `ExamResultPage`, score badges, radar metrics, and question review cards must render accurately whether scores are numeric or band-based.
5. **Mobile & Viewport Responsiveness:** Split-pane CBT layout must maintain minimum widths and scroll behavior without horizontal document overflow.

---

### Task 1: Design Tokens & Base CSS Styling
**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Produces: CSS variables (`--color-primary`, `--color-primary-hover`, `--color-primary-light`, `--color-surface`, `--color-bg`, `--ed-card`, `.btn-primary`, `.badge-orange`, etc.)

- [ ] **Step 1: Update index.css with Amber EdTech design tokens and light mode base styles**
Replace dark `#0F172A` styles in `frontend/src/index.css` with Amber EdTech tokens:
```css
@import "tailwindcss";
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

@theme {
  --color-primary: #d97706;
  --color-primary-hover: #b45309;
  --color-primary-light: #fffbeb;
  --color-primary-dark: #92400e;

  --color-accent: #ca8a04;
  --color-success: #10B981;
  --color-success-light: #d1fae5;
  --color-warning: #F59E0B;
  --color-warning-light: #fef3c7;
  --color-danger: #EF4444;
  --color-danger-light: #fee2e2;

  --color-bg-primary: #f9fafb;
  --color-bg-secondary: #ffffff;
  --color-bg-tertiary: #f3f4f6;

  --color-text-primary: #111827;
  --color-text-secondary: #4b5563;
  --color-text-muted: #9ca3af;

  --color-border-light: #e5e7eb;
  --color-border-dark: #d1d5db;

  --font-heading: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

- [ ] **Step 2: Add reusable utility classes to App.css**
Define `.ed-card`, `.btn-primary`, `.btn-outline`, `.badge-orange`, `.badge-green` in `frontend/src/App.css`.

- [ ] **Step 3: Run tests to verify base styles don't break existing specs**
Run: `npm test` in `frontend`. Expected: PASS (75 tests).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/index.css frontend/src/App.css
git commit -m "style: apply amber edtech design tokens to index.css and App.css"
```

---

### Task 2: Update Header Badges & Question Palette
**Files:**
- Modify: `frontend/src/features/exam/components/TimerDisplay.tsx`
- Modify: `frontend/src/features/exam/components/SaveStatusBadge.tsx`
- Modify: `frontend/src/features/exam/components/QuestionPalette.tsx`

**Interfaces:**
- Consumes: Existing component props (`displayTime`, `isExpired`, `isPractice`, `status`, `questions`, `answersState`, `activeQuestionId`, `onSelectQuestion`).
- Produces: Updated Amber EdTech visual styling for timer pill, autosave indicator, and question matrix.

- [ ] **Step 1: Restyle TimerDisplay**
Update `TimerDisplay.tsx` to render an amber-pill container (`bg-amber-50 text-amber-800 border-amber-200`) with monospace tabular numbers. When under 5 minutes, shift to danger red (`bg-red-50 text-red-700 border-red-200`).

- [ ] **Step 2: Restyle SaveStatusBadge**
Update `SaveStatusBadge.tsx` to render a subtle pill with emerald dot for SAVED (`bg-emerald-50 text-emerald-700 border-emerald-200`), amber dot for SAVING (`bg-amber-50 text-amber-700`), and red dot for ERROR.

- [ ] **Step 3: Restyle QuestionPalette**
Update `QuestionPalette.tsx` to use Study4 clean grid styling:
- Answered: `bg-emerald-600 text-white`
- Unvisited: `bg-white text-gray-700 border border-gray-200 hover:border-amber-400`
- Active: `ring-2 ring-amber-500 font-bold`
- Flagged: Yellow flag indicator dot or badge.

- [ ] **Step 4: Verify component tests pass**
Run: `npx vitest run src/features/exam/__tests__/TimerDisplay.test.tsx src/features/exam/__tests__/QuestionPalette.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/components/TimerDisplay.tsx frontend/src/features/exam/components/SaveStatusBadge.tsx frontend/src/features/exam/components/QuestionPalette.tsx
git commit -m "style: modernize TimerDisplay, SaveStatusBadge, and QuestionPalette"
```

---

### Task 3: Redesign Home & Exam Portal Page
**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `axiosClient`, `Link`, test cases array.
- Produces: Redesigned `HomePage` with Amber EdTech sticky header, hero dual CTA, value proposition feature cards, exam library grid, and quick dev testcase toolbar.

- [ ] **Step 1: Refactor HomePage in App.tsx**
Update `HomePage` in `frontend/src/App.tsx`:
- Header: Multilingo brand logo with amber icon, `🟢 Backend Connected` badge, language switcher, streak badge `🔥 5 ngày`, user profile pill.
- Hero Section: Headline "Luyện thi chứng chỉ quốc tế thông minh & hiệu quả" with amber highlight. Dual action cards:
  - Mock Test (IELTS Reading): Primary Amber gradient card.
  - Practice Mode: Emerald gradient card.
- 3 Value Proposition feature cards (Phòng thi CBT, Chẩn đoán AI, Sổ tay SRS).
- Exam Library section with filter tabs and cards.
- Quick dev testcases bar preserved for attempt testing.

- [ ] **Step 2: Verify smoke test passes**
Run: `npx vitest run src/features/exam/__tests__/smoke.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**
```bash
git add frontend/src/App.tsx
git commit -m "feat(ui): redesign HomePage with Amber EdTech theme and Exam Portal"
```

---

### Task 4: Redesign Exam Instructions & Setup Page
**Files:**
- Modify: `frontend/src/features/exam/pages/ExamStartPage.tsx`
- Modify: `frontend/src/features/exam/components/ScopeModePicker.tsx`

**Interfaces:**
- Consumes: `createAttempt`, `useParams`, `useNavigate`.
- Produces: Redesigned pre-test setup screen with exam metadata, interactive mode cards, technical checklist, and large start button.

- [ ] **Step 1: Restyle ScopeModePicker with interactive amber cards**
Update `ScopeModePicker.tsx`:
- Render Option 1 (Timed Mock Test) with amber border, soft amber tint, and "Khuyên dùng để cọ xát" badge.
- Render Option 2 (Untimed Practice Mode) with clean border and relaxed study description.

- [ ] **Step 2: Restyle ExamStartPage layout**
Update `ExamStartPage.tsx`:
- Light `#f9fafb` background, centered `max-w-3xl` container.
- Breadcrumb navigation and "← Quay lại thư viện đề thi" link.
- Exam Overview Card with difficulty tag, duration, and question count.
- Exam Rules notice box with amber info icon and autosave reminder.
- High-contrast Amber `Bắt đầu làm bài thi ngay →` button.

- [ ] **Step 3: Verify ScopeModePicker test passes**
Run: `npx vitest run src/features/exam/__tests__/ScopeModePicker.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/features/exam/pages/ExamStartPage.tsx frontend/src/features/exam/components/ScopeModePicker.tsx
git commit -m "feat(ui): redesign ExamStartPage and ScopeModePicker"
```

---

### Task 5: Redesign CBT Mock Test Workspace
**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Modify: `frontend/src/features/exam/components/renderers/QuestionRenderer.tsx` (and sub-renderers if needed)

**Interfaces:**
- Consumes: `useWorkspace`, `useExamTimer`, `useAutosave`, Redux answer store, `autosaveAnswers`, `submitAttempt`.
- Produces: Modern 100vh CBT split-pane exam room with reading passage on left, question form on right, dictionary popup on word selection, and bottom Study4 palette.

- [ ] **Step 1: Add Text Selection & Dictionary Popup logic to WorkspacePage**
Add `onMouseUp` handler to reading passage container that detects selected text and renders a floating AI Dictionary Popup showing word, IPA, definition, and `+ Lưu Flashcard` button.

- [ ] **Step 2: Restyle WorkspacePage split-pane layout**
Update `WorkspacePage.tsx`:
- Header: Multilingo Logo, Exam Title with Passage pill, sticky Timer Display, SaveStatusBadge, and Amber "Nộp bài" button.
- Left Pane (Reading): Clean white card, paragraph labels `[A]`, `[B]`, academic typography.
- Right Pane (Questions): Part switcher tabs with amber underline, question groups, choice pill radio cards with active amber selection.
- Palette dock: Fixed or sticky Study4 palette at bottom right.

- [ ] **Step 3: Verify WorkspacePage unit tests pass**
Run: `npx vitest run src/features/exam/__tests__/WorkspacePage.test.tsx`
Expected: PASS (all 5 tests pass).

- [ ] **Step 4: Commit**
```bash
git add frontend/src/features/exam/pages/WorkspacePage.tsx
git commit -m "feat(ui): redesign WorkspacePage to modern split-pane CBT exam room"
```

---

### Task 6: Redesign Exam Result & AI Diagnostic Report Page
**Files:**
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`

**Interfaces:**
- Consumes: `useParams`, score data (or state from location/api).
- Produces: Comprehensive AI Diagnostic Result report matching Stitch screen `064da81f16d446be9dc3fc6f1e0fe5ca`.

- [ ] **Step 1: Implement Rich Score Banner & Actions**
Update `ExamResultPage.tsx`:
- Prominent circular Band score card (e.g. Band 6.5, Correct 32/40, Time 48:15).
- Action buttons: "Xem lại chi tiết từng câu", "Làm lại đề thi", "Tải báo cáo PDF".

- [ ] **Step 2: Implement 4-Axis Competency Matrix & AI Insights**
- Competency progress bars (Reading Comprehension, Vocabulary, Time Management, Critical Inference).
- 3 AI Feedback Cards: Điểm mạnh (Strengths), Lỗ hổng kiến thức (Weaknesses), and Lộ trình gợi ý luyện tập.
- Question Review Table with filter tabs (Tất cả, Đúng, Sai, Gắn cờ) and explanation callouts.

- [ ] **Step 3: Verify all test suites pass**
Run: `npm test`
Expected: All 13 test files / 75 tests PASS.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/features/exam/pages/ExamResultPage.tsx
git commit -m "feat(ui): redesign ExamResultPage with AI diagnostic report and competency matrix"
```

---

### Task 7: Build Verification & End-to-End Validation
**Files:**
- Check: All modified files

- [ ] **Step 1: Run production build check**
Run: `npm run build` in `frontend`.
Expected: `tsc -b && vite build` succeeds with exit code 0.

- [ ] **Step 2: Run all test suites**
Run: `npm test` in `frontend`.
Expected: 13/13 test files passed, 75/75 tests passed.

- [ ] **Step 3: Final commit and summary**
```bash
git commit -m "chore: complete Amber EdTech design system integration for Multilingo Platform"
```
