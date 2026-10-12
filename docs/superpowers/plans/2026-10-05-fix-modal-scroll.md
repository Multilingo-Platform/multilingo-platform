# Modal Positioning Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Đáp án chi tiết" modal in `ExamResultPage.tsx` so that it stays fixed to the viewport when the user scrolls down, rather than scrolling along with the page content or being offset.

**Root Cause Analysis:** The modal is using `fixed inset-0` but is likely nested inside a parent element (such as a page container with animations like `.slide-up`) that applies CSS properties like `transform`, `filter`, or `perspective`. According to the CSS spec, any of these properties on an ancestor cause it to become the containing block for `fixed` positioned descendants, breaking the viewport-fixed behavior.

**Architecture:** We will use React's `createPortal` to render the modal DOM node directly into `document.body` instead of inline within the React tree. This ensures the modal is physically isolated from any ancestor's CSS stacking contexts and `transform` properties, guaranteeing true `fixed` viewport positioning.

**Tech Stack:** React, Tailwind CSS

**Spec:** Refactor the modal JSX in `ExamResultPage.tsx` to be rendered via `createPortal`.

## Global Constraints

- Do not modify the existing modal styles/design.
- Only change how it is injected into the DOM.
- Must ensure that it works on all scroll positions.

## Review Focus

- **React Imports:** Ensure `createPortal` is properly imported from `react-dom`.

---

### Task 1: Refactor Modal using React Portal

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`

**Interfaces:**
- Consumes: `react-dom` `createPortal` API.

- [ ] **Step 1: Import `createPortal`**

Add the import for `createPortal` at the top of the file:
```tsx
import { createPortal } from 'react-dom';
```

- [ ] **Step 2: Wrap Modal in `createPortal`**

Locate the `5. POP-UP / MODAL DAP AN CHI TIET` section in the JSX return. Wrap the modal inside `createPortal(..., document.body)`.

```tsx
      {/* 5. POP-UP / MODAL DAP AN CHI TIET */}
      {selectedQuestion && createPortal(
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
           ... (keep existing modal content) ...
        </div>,
        document.body
      )}
```
*Note: Also increase the `z-index` slightly to `z-[100]` to be absolutely safe.*

- [ ] **Step 3: Add `overflow: hidden` to body (Optional but recommended)**

When the modal opens, we should ideally prevent the body from scrolling. We can do this with an effect, but just using portal fixes the immediate positioning bug. We will just use the portal.

- [ ] **Step 4: Commit changes**

Run:
```bash
git add frontend/src/features/exam/pages/ExamResultPage.tsx
git commit -m "fix(exam): render detail modal via portal to fix scroll positioning"
```
