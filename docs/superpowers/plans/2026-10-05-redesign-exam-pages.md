# Exam Pages UI/UX Redesign Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the UI/UX based on user feedback:
1. Remove the non-functional "Passage" and "Tổng quát" pill buttons from `ExamResultPage.tsx`.
2. Restructure the layout of `ExamStartPage.tsx` so that the two main `ed-card` sections (Exam Overview and Scope/Mode Picker) do not take up excessive vertical space and appear more balanced and user-friendly.

**Architecture:** 
- `ExamResultPage.tsx`: Simply remove the JSX for the tabs.
- `ExamStartPage.tsx`: Change the single-column full-width stacking layout into a balanced two-column Grid layout on desktop (lg breakpoint). The Exam Overview and Rules will be placed in the left column (larger), while the Scope/Mode Picker form will sit in the right column.

**Tech Stack:** React, Tailwind CSS

## Global Constraints

- Preserve all functionality (routing, form submissions, state).
- Keep using `ed-card`, Tailwind utility classes, and inline styles where appropriate, but prefer Tailwind classes for the grid layout to ensure responsive stacking on smaller screens.

---

### Task 1: Remove Redundant Tabs in ExamResultPage

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`

- [ ] **Step 1: Remove `activeTab` state**
Remove `const [activeTab, setActiveTab] = useState<'passage' | 'overall'>('passage');` from `ExamResultPage.tsx`.

- [ ] **Step 2: Remove Tab JSX**
Locate ` {/* Tabs: Passage / Tổng quát */}` and delete the entire `div` wrapper containing the two buttons.

### Task 2: Redesign ExamStartPage Layout

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamStartPage.tsx`

- [ ] **Step 1: Expand Max Width Container**
Change the main `<main>` wrapper from `max-w-3xl` to `max-w-6xl` to allow a two-column layout to fit comfortably. Add `grid grid-cols-1 lg:grid-cols-12 gap-8` to it.

- [ ] **Step 2: Create Left Column (Overview & Rules)**
Wrap the "Exam Overview Banner" (`ed-card`) and the "Important Rules" container in a new `div` with `className="lg:col-span-7 space-y-6"`. (Ensure the rules container is moved up here).

- [ ] **Step 3: Create Right Column (Picker Form)**
Wrap the "Scope and Mode Picker Form" (`ed-card`) in a new `div` with `className="lg:col-span-5"`. Remove the `marginBottom: '2rem'` from the inline styles since `gap-8` and `space-y-6` handle spacing. Optionally, make it sticky using Tailwind classes `sticky top-24`.

- [ ] **Step 4: Commit changes**

Run:
```bash
git add frontend/src/features/exam/pages/ExamResultPage.tsx frontend/src/features/exam/pages/ExamStartPage.tsx
git commit -m "style: redesign ExamStartPage layout and remove redundant tabs from ExamResultPage"
```
