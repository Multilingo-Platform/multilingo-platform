# Plan to redesign ExamStartPage Step 2

**Goal:**
1. Remove "Thiết lập phòng thi" and "🛡️ Phòng thi bảo mật trực tuyến". Move the back link to the left column.
2. Resize cards in `ScopeModePicker`.

## Task 1: Clean up ExamStartPage

**File:** `frontend/src/features/exam/pages/ExamStartPage.tsx`

- [ ] Remove the Top Bar section (the div with `Breadcrumb / Top Bar` containing the `Link` and the `Phòng thi bảo mật trực tuyến` badge).
- [ ] Add the `Link` "Quay lại Trang chủ" into the `lg:col-span-7 space-y-6` column at the very top. Let's make it look like a secondary ghost button or simple text link with an icon, such as `<Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-amber-600 transition-colors mb-4">` or similar. Since there's `space-y-6`, we don't need `mb-4`.

## Task 2: Resize Cards in ScopeModePicker

**File:** `frontend/src/features/exam/components/ScopeModePicker.tsx`

- [ ] Modify `cardBase`:
  - `padding`: from `1.125rem` to `0.875rem 1rem`.
  - `borderRadius`: from `0.875rem` to `0.75rem`.
- [ ] Modify `SCOPE_OPTIONS` render:
  - Grid template: from `minmax(170px, 1fr)` to `minmax(140px, 1fr)`.
  - Icon font size: from `1.75rem` to `1.5rem`.
  - Title font size: from `0.95rem` to `0.9rem`.
  - Desc font size: from `0.8rem` to `0.75rem`.
- [ ] Modify `MODE_OPTIONS` render:
  - Grid template: from `minmax(220px, 1fr)` to `1fr` (a single column stack) or `repeat(auto-fit, minmax(180px, 1fr))` to make them narrower but taller. Looking at the user's image, they are full-width stacked (one per row). Wait, the image shows "Mock Test" and "Practice" stacked on top of each other. That means `gridTemplateColumns: '1fr'`.
  - Icon font size: `1.75rem` -> `1.5rem`.
  - Title font size: `0.95rem` -> `0.9rem`.
  - Desc font size: `0.8rem` -> `0.75rem`.
  - Mock Test label ("Khuyên dùng"): `fontSize: 0.65rem` is fine.

- [ ] Execute `npm run build`
