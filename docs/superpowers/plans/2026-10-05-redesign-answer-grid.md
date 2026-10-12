# Redesign Answer Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the answer grid section in `ExamResultPage.tsx` to display questions in a 2-column list grouped by passage, using the project's primary amber color scheme and documenting the transition from mock to real data.

**Architecture:** We will modify the existing `ExamResultPage.tsx` functional component. The current flex-wrap button grid in Section 4 ("Bảng đáp án câu hỏi") will be replaced with a `grid-cols-1 sm:grid-cols-2` layout containing list items for each question. 

**Tech Stack:** React, Tailwind CSS, Lucide-react

**Spec:** Redesign "Bảng đáp án câu hỏi" to match the uploaded image layout (Passage Title -> Number Circle -> Correct Answer -> User Answer -> Status Icon -> Details Link), using the primary amber color. Add TODO comments for real data integration.

## Global Constraints

- Must use Tailwind utility classes for styling.
- Primary color should be amber (`amber-100`, `amber-600`, `amber-700`).
- The component must remain responsive.

## Review Focus

- **Data structure mismatch:** The mock data uses `QUESTIONS_DATA` which is a flat array, but the design implies grouping by "Passage". Since the mock data only has one passage, we will render "Passage 1" as a static header but add TODOs explaining how to `groupBy` passage when real data arrives.
- **Empty user answers:** If a user skips a question, the user answer should not crash or look broken. We will render nothing or a dash for the user answer if it's empty, and show a red cross (or minus).

---

### Task 1: Redesign Answer Grid Component

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`

**Interfaces:**
- Consumes: `QUESTIONS_DATA` (mock data array).
- Produces: Updated UI for Section 4.

- [ ] **Step 1: Replace the content of Section 4 in `ExamResultPage.tsx`**

```tsx
      {/* 4. BẢNG ĐÁP ÁN CÂU HỎI MÀ CHÚNG TA ĐÃ CHỌN */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-4">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          Bảng đáp án câu hỏi
        </h2>
        {/* TODO: MOCK DATA NOTE 
            Hiện tại đang sử dụng dữ liệu tĩnh (QUESTIONS_DATA).
            Khi có API hoặc Redux (ví dụ: state.examResult.passages), 
            cần map qua danh sách các passage và group câu hỏi theo từng passage.
            Ví dụ: 
            passages.map(passage => (
               <div key={passage.id}>
                  <h3>{passage.title}</h3>
                  <div className="grid...">...</div>
               </div>
            ))
        */}
        <div className="space-y-4 pt-2">
          {/* Static group header since mock data is all from one passage */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Passage 1</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
              {QUESTIONS_DATA.map((q) => {
                return (
                  <div key={q.id} className="flex items-center gap-2.5 py-2 border-b border-slate-100 last:border-0">
                    {/* Circle Question Number */}
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs shrink-0">
                      {q.id}
                    </span>
                    
                    {/* Correct Answer */}
                    <span className="font-bold text-slate-800 text-sm truncate max-w-[120px]" title={q.correctAnswer}>
                      {q.correctAnswer}:
                    </span>
                    
                    {/* User Answer */}
                    <span className={`text-sm font-medium truncate max-w-[120px] ${!q.isCorrect ? 'text-slate-400 line-through' : 'text-slate-800'}`} title={q.userAnswer}>
                      {q.userAnswer || '-'}
                    </span>
                    
                    {/* Tick or Cross */}
                    <div className="flex-1 flex items-center gap-2">
                      {q.isCorrect ? (
                        <Check size={18} className="text-emerald-500 stroke-[3] shrink-0" />
                      ) : (
                        <X size={18} className="text-rose-500 stroke-[3] shrink-0" />
                      )}
                      
                      {/* Chi tiết link */}
                      <button
                        type="button"
                        onClick={() => setSelectedQuestionId(q.id)}
                        className="ml-auto text-amber-600 hover:text-amber-700 font-semibold text-xs cursor-pointer transition-colors shrink-0"
                      >
                        [Chi tiết]
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
```

- [ ] **Step 2: Commit changes**

Run:
```bash
git add frontend/src/features/exam/pages/ExamResultPage.tsx
git commit -m "style(exam): redesign answer grid to list format with amber colors"
```
