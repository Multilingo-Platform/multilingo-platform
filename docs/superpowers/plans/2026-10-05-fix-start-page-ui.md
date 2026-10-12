# Plan to Fix UI issues in ExamStartPage

**Goal:**
1. Move the "Quay lại Trang chủ" link outside the grid column so that the two columns' cards align perfectly at the top.
2. Fix the `ScopeModePicker` so that the Submit button is always visible without scrolling the whole page when extra options ("Một phần") are expanded.

## Task 1: Re-align ExamStartPage Columns

**File:** `frontend/src/features/exam/pages/ExamStartPage.tsx`

- [ ] Change `<main>` element to `flex flex-col gap-6` instead of `grid`.
- [ ] Move the `Link` element inside the `<main>` but before a new `<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">` wrapper.
- [ ] Move the two columns (`lg:col-span-7` and `lg:col-span-5`) into this new grid wrapper.
- [ ] In the right column (`lg:col-span-5`), modify the `ed-card` inline style: remove `padding: '2rem'` (since `ScopeModePicker` will handle it) and add `maxHeight: 'calc(100vh - 120px)'`, `display: 'flex'`, `flexDirection: 'column'`. Also, make sure it has `overflow: 'hidden'` so the inner scroll works cleanly.

## Task 2: Sticky Footer in ScopeModePicker

**File:** `frontend/src/features/exam/components/ScopeModePicker.tsx`

- [ ] Change the `<form>` wrapper style to `{ display: 'flex', flexDirection: 'column', height: '100%' }`.
- [ ] Wrap the form content (Step 1, Step 2, Error Message) in a `<div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>`.
- [ ] Wrap the Submit Button in a `<div style={{ padding: '1.25rem 2rem', borderTop: '1px solid #e5e7eb', backgroundColor: '#fff', flexShrink: 0 }}>`.

- [ ] Execute `npm run build`
