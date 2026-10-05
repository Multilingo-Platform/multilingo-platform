# Sprint 07 - Exam Review Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng giao diện Review Mode (Read-only) cho phép học viên xem lại bài thi đã nộp, xem câu đúng/sai, và đọc giải thích chi tiết.

**Architecture:** Tái sử dụng layout của không gian làm bài (Workspace) nhưng khóa tương tác. Dữ liệu được fetch qua custom hook `useExamReview` từ API `getAttemptReview`. Các component UI sẽ nhận trực tiếp dữ liệu này để render trạng thái đúng/sai bằng các Semantic Colors.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, DOMPurify (sanitization), Vitest + React Testing Library (TDD).

**Spec:** `docs/superpowers/specs/ndt/2026-10-05-sprint07-exam-review-design.md`

## Global Constraints

- Chỉ đọc (Read-only), không lưu Redux store, không gọi API cập nhật đáp án.
- Tái sử dụng API `getAttemptReview(attemptId, partId)` từ `attemptApi.ts`.
- Mọi chuỗi HTML trả về trong `explanation` phải được render qua `DOMPurify` để phòng chống XSS.

## Review Focus

- Xử lý mượt mà khi đổi `partId` (Component không bị giật lag hoặc hiển thị data cũ). -> Test ở Task 1 (hook reset data).
- `ExplanationBox` không render bậy mã độc HTML (ví dụ `<script>`). -> Test ở Task 2 (kiểm tra DOMPurify).
- `ReviewPalette` tô màu xám cho các câu bỏ trống, đỏ cho câu sai, xanh cho câu đúng, tránh nhầm lẫn logic. -> Test ở Task 3.

---

### Task 1: `useExamReview` Custom Hook

**Files:**
- Create: `frontend/src/features/exam/hooks/useExamReview.ts`
- Test: `frontend/src/features/exam/hooks/__tests__/useExamReview.test.ts`

**Interfaces:**
- Consumes: `attemptApi.getAttemptReview(attemptId, partId)`
- Produces: `useExamReview(attemptId: number, partId: number | null): { data: ExamReviewResponse | null, loading: boolean, error: Error | null }`

- [ ] **Step 1: Write the failing test**
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useExamReview } from '../useExamReview';
import { attemptApi } from '../../api/attemptApi';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../../api/attemptApi');

describe('useExamReview', () => {
  it('should fetch and return review data', async () => {
    const mockData = { attemptId: 1, partId: 1, examSnapshot: {}, userAnswers: {}, isCorrectFlags: {} };
    vi.mocked(attemptApi.getAttemptReview).mockResolvedValue(mockData as any);
    
    const { result } = renderHook(() => useExamReview(1, 1));
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(mockData);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- frontend/src/features/exam/hooks/__tests__/useExamReview.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal implementation**
```typescript
import { useState, useEffect } from 'react';
import { attemptApi } from '../api/attemptApi';
import { ExamReviewResponse } from '../../../core/api/api.types';

export function useExamReview(attemptId: number, partId: number | null) {
  const [data, setData] = useState<ExamReviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!partId) return;
    
    let isMounted = true;
    setLoading(true);
    setData(null); // Clear data when changing part
    
    attemptApi.getAttemptReview(attemptId, partId)
      .then(res => {
        if (isMounted) setData(res);
      })
      .catch(err => {
        if (isMounted) setError(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
      
    return () => { isMounted = false; };
  }, [attemptId, partId]);

  return { data, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- frontend/src/features/exam/hooks/__tests__/useExamReview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/hooks/
git commit -m "feat(frontend): create useExamReview hook"
```

---

### Task 2: `ExplanationBox` Component

**Files:**
- Create: `frontend/src/features/exam/components/review/ExplanationBox.tsx`
- Test: `frontend/src/features/exam/components/review/__tests__/ExplanationBox.test.tsx`

**Interfaces:**
- Consumes: `DOMPurify.sanitize()`
- Produces: `<ExplanationBox htmlContent={string} />`

- [ ] **Step 1: Write the failing test**
```tsx
import { render, screen } from '@testing-library/react';
import { ExplanationBox } from '../ExplanationBox';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

describe('ExplanationBox', () => {
  it('should render sanitized HTML and style classes', () => {
    render(<ExplanationBox htmlContent="<b>Lý do chọn A</b><script>alert(1)</script>" />);
    const box = screen.getByTestId('explanation-box');
    
    expect(box).toBeInTheDocument();
    expect(box).toHaveTextContent('Lý do chọn A');
    expect(box.innerHTML).not.toContain('<script>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- frontend/src/features/exam/components/review/__tests__/ExplanationBox.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```tsx
import React from 'react';
import DOMPurify from 'dompurify';

interface Props {
  htmlContent: string;
}

export const ExplanationBox: React.FC<Props> = ({ htmlContent }) => {
  const cleanHtml = DOMPurify.sanitize(htmlContent);

  return (
    <div 
      data-testid="explanation-box"
      className="mt-4 p-4 bg-[#FFFBEB] border border-[#F59E0B] rounded-md text-sm text-[#0F172A]"
    >
      <div className="font-semibold mb-2 text-[#F59E0B]">💡 Giải thích chi tiết:</div>
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- frontend/src/features/exam/components/review/__tests__/ExplanationBox.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/components/review/
git commit -m "feat(frontend): create ExplanationBox component with sanitization"
```

---

### Task 3: `ReviewPalette` Component

**Files:**
- Create: `frontend/src/features/exam/components/review/ReviewPalette.tsx`
- Test: `frontend/src/features/exam/components/review/__tests__/ReviewPalette.test.tsx`

**Interfaces:**
- Consumes: N/A
- Produces: `<ReviewPalette questions={Array} isCorrectFlags={Record} userAnswers={Record} />`

- [ ] **Step 1: Write the failing test**
```tsx
import { render, screen } from '@testing-library/react';
import { ReviewPalette } from '../ReviewPalette';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom';

describe('ReviewPalette', () => {
  it('should render correct semantic colors', () => {
    const questions = [
      { id: 101, content: 'Q1', options: [] }, // Correct
      { id: 102, content: 'Q2', options: [] }, // Incorrect
      { id: 103, content: 'Q3', options: [] }, // Blank
    ];
    const isCorrectFlags = { '101': true, '102': false };
    const userAnswers = { '101': 1, '102': 2 }; // 103 is blank
    
    render(<ReviewPalette questions={questions as any} isCorrectFlags={isCorrectFlags} userAnswers={userAnswers} />);
    
    const btn1 = screen.getByText('101');
    const btn2 = screen.getByText('102');
    const btn3 = screen.getByText('103');
    
    expect(btn1).toHaveClass('bg-[#16A34A]');
    expect(btn2).toHaveClass('bg-[#DC2626]');
    expect(btn3).toHaveClass('bg-gray-300'); // Or text-gray-500 depending on style
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- frontend/src/features/exam/components/review/__tests__/ReviewPalette.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
```tsx
import React from 'react';

interface Props {
  questions: Array<{ id: number; content: string }>;
  isCorrectFlags: Record<string, boolean>;
  userAnswers: Record<string, any>;
}

export const ReviewPalette: React.FC<Props> = ({ questions, isCorrectFlags, userAnswers }) => {
  return (
    <div className="flex flex-wrap gap-2 p-4 bg-white shadow rounded-lg w-64">
      <h3 className="w-full font-bold mb-2 text-[#0F172A]">Bảng câu hỏi</h3>
      {questions.map((q) => {
        const hasAnswer = userAnswers[q.id.toString()] !== undefined;
        const isCorrect = isCorrectFlags[q.id.toString()];
        
        let bgColor = 'bg-gray-300 text-gray-700'; // Blank
        if (hasAnswer) {
          bgColor = isCorrect ? 'bg-[#16A34A] text-white' : 'bg-[#DC2626] text-white';
        }

        return (
          <button 
            key={q.id}
            className={`w-10 h-10 rounded-md font-medium cursor-pointer ${bgColor}`}
          >
            {q.id}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- frontend/src/features/exam/components/review/__tests__/ReviewPalette.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/features/exam/components/review/
git commit -m "feat(frontend): create ReviewPalette for correct/incorrect visual"
```

---

### Task 4: `ExamReviewPage` & Routing

**Files:**
- Create: `frontend/src/features/exam/pages/ExamReviewPage.tsx`
- Modify: `frontend/src/App.tsx` (Route Registration)
- Test: `frontend/src/features/exam/pages/__tests__/ExamReviewPage.test.tsx`

**Interfaces:**
- Consumes: `useExamReview`, `ReviewPalette`, `ExplanationBox`
- Produces: Connected Page component mapped to `/attempts/:attemptId/review`

- [ ] **Step 1: Write the failing test**
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ExamReviewPage } from '../ExamReviewPage';
import { vi, describe, it, expect } from 'vitest';
import * as reviewHook from '../../hooks/useExamReview';
import '@testing-library/jest-dom';

vi.mock('../../hooks/useExamReview');

describe('ExamReviewPage', () => {
  it('renders loading state initially', () => {
    vi.spyOn(reviewHook, 'useExamReview').mockReturnValue({ data: null, loading: true, error: null });
    
    render(
      <MemoryRouter initialEntries={['/attempts/1/review']}>
        <Routes>
          <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText(/Đang tải dữ liệu/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npm run test -- frontend/src/features/exam/pages/__tests__/ExamReviewPage.test.tsx`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**
`frontend/src/features/exam/pages/ExamReviewPage.tsx`:
```tsx
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useExamReview } from '../hooks/useExamReview';
import { ReviewPalette } from '../components/review/ReviewPalette';
import { ExplanationBox } from '../components/review/ExplanationBox';

export const ExamReviewPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  // For simplicity, default to partId = 1, in reality you map through examSnapshot parts
  const [partId, setPartId] = useState<number>(1);
  const { data, loading, error } = useExamReview(Number(attemptId), partId);

  if (loading) return <div className="p-8 text-center text-lg text-gray-500">Đang tải dữ liệu...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Lỗi khi tải kết quả.</div>;
  if (!data) return <div className="p-8 text-center">Không có dữ liệu</div>;

  return (
    <div className="flex bg-[#F8FAFC] min-h-screen">
      <div className="flex-1 p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-[#0F172A]">Chế độ Ôn tập</h1>
          <Link to={`/attempts/${attemptId}/result`} className="text-[#F59E0B] hover:underline">
            Quay lại bảng điểm
          </Link>
        </div>
        
        {data.examSnapshot.questions.map((q) => {
          const isCorrect = data.isCorrectFlags[q.id.toString()];
          const userAnswer = data.userAnswers[q.id.toString()];
          
          return (
            <div key={q.id} className="bg-white p-6 rounded-lg shadow mb-6 border-l-4 border-[#16A34A]">
              <h4 className="font-semibold text-lg mb-4">{q.content}</h4>
              <div className="space-y-2 mb-4">
                {q.options.map(opt => {
                  const isChecked = userAnswer === opt.id;
                  return (
                    <label key={opt.id} className={`flex items-center p-3 border rounded-md ${isChecked ? 'bg-gray-100' : ''} ${opt.isCorrect ? 'border-[#16A34A] border-2' : ''}`}>
                      <input type="radio" checked={isChecked} disabled className="mr-3" />
                      <span className={opt.isCorrect ? 'font-bold text-[#16A34A]' : ''}>{opt.content}</span>
                      {isChecked && !opt.isCorrect && <span className="ml-2 text-[#DC2626]">❌</span>}
                      {opt.isCorrect && <span className="ml-2 text-[#16A34A]">✅</span>}
                    </label>
                  );
                })}
              </div>
              
              {q.explanation && (
                <ExplanationBox htmlContent={q.explanation} />
              )}
            </div>
          );
        })}
      </div>
      
      <div className="w-80 p-8 border-l bg-white">
        <ReviewPalette 
          questions={data.examSnapshot.questions}
          isCorrectFlags={data.isCorrectFlags}
          userAnswers={data.userAnswers}
        />
      </div>
    </div>
  );
};
```

Update routing in `frontend/src/App.tsx` (or equivalent router file):
```tsx
import { ExamReviewPage } from './features/exam/pages/ExamReviewPage';

// Within Routes:
// <Route path="/attempts/:attemptId/review" element={<ExamReviewPage />} />
```
*(In Step 3, actually insert this route into App.tsx)*

- [ ] **Step 4: Run test to verify it passes**
Run: `npm run test -- frontend/src/features/exam/pages/__tests__/ExamReviewPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add frontend/src/
git commit -m "feat(frontend): create ExamReviewPage and integrate UI components"
```
