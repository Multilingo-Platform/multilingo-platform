# Double Header Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant double header and footer on the `ExamStartPage` by refactoring it to integrate cleanly into the existing `UserLayout`.

**Architecture:** We will modify `frontend/src/features/exam/pages/ExamStartPage.tsx`. The component currently implements its own standalone page layout (with `<header>` and `<footer>`), but it is rendered inside `UserLayout` which already provides a global Header and Footer. We will remove the redundant standalone layout elements and convert the custom `<header>` into a standard breadcrumb inside the page content.

**Tech Stack:** React, Tailwind CSS

**Spec:** Remove `minHeight: 100vh` outer wrapper. Remove custom sticky `<header>` and convert its contents into a breadcrumb `<div>`. Remove custom `<footer>`. Keep functionality intact.

## Global Constraints

- Must not break the `ScopeModePicker` or exam initiation logic.
- Must preserve the breadcrumb navigation ("Quay lại Trang chủ").

## Review Focus

- **Styling conflicts:** Ensure the page background color (`#f9fafb` / `bg-slate-50`) still looks correct within `UserLayout`.

---

### Task 1: Refactor ExamStartPage Layout

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamStartPage.tsx`

**Interfaces:**
- Consumes: `UserLayout` context (implicitly via router).

- [ ] **Step 1: Replace ExamStartPage layout wrappers**

Replace the outer `div`, `header`, and `footer` in `ExamStartPage.tsx` with a standard content container. 

```tsx
  return (
    <div className="w-full bg-slate-50">
      {/* Breadcrumb / Top Bar */}
      <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-amber-600 hover:text-amber-700 text-sm font-semibold transition-colors flex items-center gap-1.5">
            ⬅ Quay lại Trang chủ
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-heading font-semibold text-slate-600 text-sm">
            Thiết lập phòng thi
          </span>
        </div>

        <div className="text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
          🛡️ Phòng thi bảo mật trực tuyến
        </div>
      </div>

      {/* Main Form Container */}
      <main className="max-w-3xl mx-auto px-4 py-6 w-full">
        {/* Exam Overview Banner */}
        <div className="ed-card p-6 sm:p-8 mb-8">
           {/* ... keep existing banner content ... */}
```

Remove the custom `<footer style={{...}}>...</footer>` at the bottom of the file.

- [ ] **Step 2: Commit changes**

Run:
```bash
git add frontend/src/features/exam/pages/ExamStartPage.tsx
git commit -m "fix(exam): remove redundant double header and footer in ExamStartPage"
```
