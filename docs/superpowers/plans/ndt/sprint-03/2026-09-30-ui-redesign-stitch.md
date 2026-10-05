# UI Redesign - Stitch-First Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết kế lại toàn bộ giao diện module Exam từ đầu bằng Stitch MCP, sau đó triển khai thành React TSX components hiện đại, thân thiện và không gây khó chịu cho người dùng.

**Architecture:** Design-first workflow — Stitch MCP generate mockup HTML cho từng page, lấy đó làm Visual Spec, code thẳng `.tsx` theo spec. Logic hiện tại (hooks, Redux store, API layer) giữ nguyên 100% — chỉ thay thế phần JSX/styling. Tách Design System Token thành `index.css` + `tailwind.config.js`.

**Tech Stack:** React 18 + TypeScript + Tailwind CSS v3, Google Fonts (Plus Jakarta Sans + Inter), Redux Toolkit, React Router v6, Stitch MCP.

**Spec:** `docs/designs/stitch/screens/` — xem HTML mockup và preview.png từng màn hình được generate bởi Stitch trước khi implement.

## Global Constraints

- Không thay đổi bất kỳ logic, hooks, store, API nào — chỉ sửa JSX và CSS/Tailwind
- Font chính: `Plus Jakarta Sans` (headings, buttons) + `Inter` (body text)
- Màu primary: `#2151DA` | success: `#10B981` | warning: `#F59E0B` | danger: `#EF4444`
- Background: `#0F172A` (slate-900) | surface: `#1E293B` | border: `#334155`
- Tất cả interactive element: `transition-all duration-200` + hover state rõ ràng
- Không dùng `style={{}}` inline — tất cả dùng Tailwind class
- Chạy `npm run dev` tại `frontend/` để verify visual sau mỗi task

## Review Focus

1. **Timer ≤ 5 phút** → màu đỏ + `animate-pulse`, không chỉ thay số
2. **QuestionPalette 3 trạng thái** → chưa làm (gray), đã làm (green), rõ ràng không nhầm
3. **Mobile responsive WorkspacePage** → sidebar ẩn dưới `lg:`, layout dọc
4. **Loading state** → spinner full-screen, không blank white
5. **Submit Modal** → unansweredCount = red badge nổi bật, không ấn nhầm

---

## Task 0: Setup Design Tokens & Global CSS

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/tailwind.config.js`

**Interfaces:**
- Produces: CSS custom properties + Tailwind tokens dùng cho toàn bộ project

- [ ] **Step 1: Cập nhật `frontend/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #2151DA;
  --color-primary-hover: #1a3fb5;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-bg: #0F172A;
  --color-surface: #1E293B;
  --color-surface-2: #263549;
  --color-surface-3: #2d3f55;
  --color-border: #334155;
  --color-border-light: #475569;
  --color-text: #F8FAFC;
  --color-text-muted: #94A3B8;
  --font-heading: 'Plus Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;
}

* { box-sizing: border-box; }

body {
  font-family: var(--font-body);
  background-color: var(--color-bg);
  color: var(--color-text);
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4, h5, h6, button {
  font-family: var(--font-heading);
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-surface); }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: #475569; }
```

- [ ] **Step 2: Cập nhật `frontend/tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2151DA', hover: '#1a3fb5', light: '#3b5fe8' },
        success: { DEFAULT: '#10B981', light: '#d1fae5', dark: '#059669' },
        warning: { DEFAULT: '#F59E0B', light: '#fef3c7' },
        danger: { DEFAULT: '#EF4444', light: '#fee2e2', dark: '#dc2626' },
        surface: { DEFAULT: '#1E293B', '2': '#263549', '3': '#2d3f55' },
        border: { DEFAULT: '#334155', light: '#475569' },
        muted: '#94A3B8',
      },
      fontFamily: {
        heading: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-danger': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Verify font load**

```bash
cd frontend && npm run dev
```

Mở `http://localhost:5173` → DevTools → computed font-family của `body` phải là `Inter`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/index.css frontend/tailwind.config.js
git commit -m "feat(ui): setup design tokens and global CSS for dark-theme redesign"
```

---

## Task 1: Redesign App.tsx — Home Dashboard

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Routes đã có (không đổi)
- Produces: Dashboard đẹp với hero + 2 CTA chính + testcase grid

- [ ] **Step 1: Generate màn Home từ Stitch MCP**

Gọi tool `stitch:generate_screen_from_text` với prompt:
```
Multilingo Exam Platform - Home Dashboard. Dark slate-900 background.
Top nav: logo 'Multilingo' gradient blue text, backend status green dot pill.
Hero: large heading 'Luyện thi IELTS thông minh', subtitle text.
Two CTA cards: 1) Blue gradient 'Mock Test' card with timer icon,
2) Emerald gradient 'Practice Mode' card with book icon.
Below: 6 test-case cards in 2-col grid, each with attempt badge and arrow.
Plus Jakarta Sans font, modern dark UI.
```

Lưu output: `docs/designs/stitch/screens/home-dashboard/screen.html` và `preview.png`

- [ ] **Step 2: Implement App.tsx**

```tsx
// frontend/src/App.tsx
import { useEffect, useState } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import axiosClient from './api/axiosClient';
import ExamStartPage from './features/exam/pages/ExamStartPage';
import WorkspacePage from './features/exam/pages/WorkspacePage';
import ExamResultPage from './features/exam/pages/ExamResultPage';

const TEST_CASES = [
  { id: 1, attemptId: 17, label: 'Mock Test (3h Timer)', route: '/attempts/17', badge: 'MOCK' },
  { id: 2, attemptId: 18, label: 'Practice Mode', route: '/attempts/18', badge: 'PRACTICE' },
  { id: 3, attemptId: 19, label: 'Single Skill Reading', route: '/attempts/19', badge: 'SKILL' },
  { id: 4, attemptId: 20, label: 'Submit Flow Test', route: '/attempts/20', badge: 'MOCK' },
  { id: 5, attemptId: 21, label: 'Completed (Redirect)', route: '/attempts/21', badge: 'DONE' },
];

const BADGE_CLASS: Record<string, string> = {
  MOCK: 'bg-primary/20 text-primary-light border border-primary/30',
  PRACTICE: 'bg-success/20 text-success border border-success/30',
  SKILL: 'bg-primary/20 text-primary-light border border-primary/30',
  DONE: 'bg-surface-2 text-muted border border-border',
};

function HomePage() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  useEffect(() => {
    axiosClient.get('/test/hello').then(() => setStatus('ok')).catch(() => setStatus('error'));
  }, []);

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between sticky top-0 z-10 bg-[#0F172A]/80 backdrop-blur-sm">
        <span className="font-heading font-bold text-xl bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
          Multilingo
        </span>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${
          status === 'ok' ? 'bg-success/10 text-success border-success/30' :
          status === 'error' ? 'bg-danger/10 text-danger border-danger/30' :
          'bg-surface-2 text-muted border-border'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-success animate-pulse' : status === 'error' ? 'bg-danger' : 'bg-muted'}`} />
          {status === 'ok' ? 'Backend Connected' : status === 'error' ? 'Backend Offline' : 'Checking...'}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="font-heading font-extrabold text-4xl sm:text-5xl text-slate-100 mb-4 leading-tight">
            Luyện thi IELTS<br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              thông minh &amp; hiệu quả
            </span>
          </h1>
          <p className="text-muted text-lg max-w-xl mx-auto">
            Hệ thống luyện thi với Timer tự động, Autosave thông minh và báo cáo phân tích chi tiết.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <Link to="/exams/1/start" className="group bg-gradient-to-br from-primary to-blue-700 rounded-2xl p-6 flex flex-col gap-3 hover:from-primary-hover hover:to-blue-800 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-primary/20">
            <div className="text-3xl">⏱️</div>
            <h2 className="font-heading font-bold text-xl text-white">Mock Test (IELTS)</h2>
            <p className="text-blue-100 text-sm">Thi thật với đồng hồ đếm ngược, tự động nộp khi hết giờ.</p>
            <span className="mt-2 text-sm font-semibold text-white/80 group-hover:text-white flex items-center gap-1">
              Bắt đầu thi <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </span>
          </Link>
          <Link to="/exams/2/start" className="group bg-gradient-to-br from-emerald-700 to-teal-800 rounded-2xl p-6 flex flex-col gap-3 hover:from-emerald-800 hover:to-teal-900 transition-all duration-300 hover:scale-[1.02] shadow-lg shadow-emerald-900/30">
            <div className="text-3xl">📖</div>
            <h2 className="font-heading font-bold text-xl text-white">Practice Mode</h2>
            <p className="text-emerald-100 text-sm">Luyện tập không áp lực, không có đồng hồ đếm ngược.</p>
            <span className="mt-2 text-sm font-semibold text-white/80 group-hover:text-white flex items-center gap-1">
              Bắt đầu luyện <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
            </span>
          </Link>
        </div>

        <div>
          <h2 className="font-heading font-semibold text-lg text-slate-300 mb-4">
            📋 Dev Testcases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TEST_CASES.map((tc) => (
              <Link key={tc.id} to={tc.route} className="group bg-surface/60 border border-border/60 rounded-xl p-4 flex flex-col gap-2 hover:bg-surface hover:border-border transition-all duration-200 hover:scale-[1.01]">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-heading font-semibold text-sm text-slate-200 leading-snug">{tc.label}</span>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_CLASS[tc.badge]}`}>{tc.badge}</span>
                </div>
                <span className="text-xs text-muted group-hover:text-slate-400 transition-colors">Attempt #{tc.attemptId} →</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/exams/:examId/start" element={<ExamStartPage />} />
      <Route path="/attempts/:attemptId" element={<WorkspacePage />} />
      <Route path="/attempts/:attemptId/result" element={<ExamResultPage />} />
    </Routes>
  );
}

export default App;
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run dev
```

Kiểm tra: ✅ Gradient hero heading | ✅ 2 CTA cards hover scale | ✅ Backend status pill | ✅ Testcase grid

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(ui): redesign home dashboard with dark theme, gradient hero and CTA cards"
```

---

## Task 2: Redesign ExamStartPage + ScopeModePicker

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamStartPage.tsx`
- Modify: `frontend/src/features/exam/components/ScopeModePicker.tsx`

**Interfaces:**
- Consumes: `onSubmit(req: CreateAttemptRequest)` — giữ nguyên
- Produces: Card-based picker thay thế `<select>` dropdown

- [ ] **Step 1: Redesign ScopeModePicker.tsx**

```tsx
// frontend/src/features/exam/components/ScopeModePicker.tsx
import React, { useState } from 'react';
import type { CreateAttemptRequest, TestMode, TestScope } from '../types/api.types';

interface ScopeModePickerProps {
  examId: number;
  onSubmit: (req: CreateAttemptRequest) => void;
  isLoading: boolean;
  error: string | null;
}

const SCOPE_OPTIONS = [
  { value: 'FULL_EXAM' as TestScope, label: 'Toàn bộ đề', desc: '4 kỹ năng: Reading, Listening, Writing, Speaking', icon: '📋' },
  { value: 'SINGLE_SKILL' as TestScope, label: 'Một kỹ năng', desc: 'Chọn 1 trong 4 kỹ năng để luyện tập', icon: '🎯' },
  { value: 'SINGLE_PART' as TestScope, label: 'Một phần', desc: 'Luyện riêng từng Part trong kỹ năng', icon: '📌' },
];

const MODE_OPTIONS = [
  { value: 'MOCK_TEST' as TestMode, label: 'Mock Test', desc: 'Đồng hồ đếm ngược, tự động nộp khi hết giờ', icon: '⏱️', ring: 'ring-primary border-primary bg-primary/10' },
  { value: 'PRACTICE' as TestMode, label: 'Practice', desc: 'Không giới hạn thời gian, không áp lực', icon: '📖', ring: 'ring-success border-success bg-success/10' },
];

const SECTION_OPTIONS = [
  { value: '1', label: 'Reading' }, { value: '2', label: 'Listening' }, { value: '3', label: 'Writing' },
];
const PART_OPTIONS = [
  { value: '1', label: 'Part 1' }, { value: '2', label: 'Part 2' }, { value: '3', label: 'Part 3' },
];

const ScopeModePicker: React.FC<ScopeModePickerProps> = ({ examId, onSubmit, isLoading, error }) => {
  const [scope, setScope] = useState<TestScope | ''>('');
  const [mode, setMode] = useState<TestMode | ''>('');
  const [sectionId, setSectionId] = useState('');
  const [partId, setPartId] = useState('');

  const needsSection = scope === 'SINGLE_SKILL' || scope === 'SINGLE_PART';
  const needsPart = scope === 'SINGLE_PART';
  const isValid = scope !== '' && mode !== '' && (!needsSection || sectionId !== '') && (!needsPart || partId !== '');

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
    <form onSubmit={handleSubmit} aria-label="Thiết lập phiên thi" className="space-y-8">
      {/* Step 1: Scope */}
      <div>
        <h3 className="font-heading font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">1</span>
          Chọn phạm vi thi
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SCOPE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button"
              onClick={() => { setScope(opt.value); setSectionId(''); setPartId(''); }}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                scope === opt.value
                  ? 'border-primary bg-primary/10 ring-1 ring-primary'
                  : 'border-border bg-surface/50 hover:border-border-light hover:bg-surface'
              }`}>
              <div className="text-2xl mb-2">{opt.icon}</div>
              <div className="font-heading font-semibold text-sm text-slate-200 mb-1">{opt.label}</div>
              <div className="text-xs text-muted leading-relaxed">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Section dropdown */}
      {needsSection && (
        <div className="animate-fade-in">
          <h3 className="font-heading font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3">↳ Chọn kỹ năng</h3>
          <div className="flex flex-wrap gap-2">
            {SECTION_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => { setSectionId(opt.value); setPartId(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  sectionId === opt.value ? 'bg-primary border-primary text-white' : 'bg-surface border-border text-muted hover:text-slate-200 hover:border-border-light'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {needsPart && sectionId && (
        <div className="animate-fade-in">
          <h3 className="font-heading font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3">↳ Chọn phần</h3>
          <div className="flex flex-wrap gap-2">
            {PART_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setPartId(opt.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  partId === opt.value ? 'bg-primary border-primary text-white' : 'bg-surface border-border text-muted hover:text-slate-200 hover:border-border-light'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Mode */}
      <div>
        <h3 className="font-heading font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">2</span>
          Chọn chế độ
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODE_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => setMode(opt.value)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 ${
                mode === opt.value ? `${opt.ring} ring-1` : 'border-border bg-surface/50 hover:border-border-light hover:bg-surface'
              }`}>
              <div className="text-2xl mb-2">{opt.icon}</div>
              <div className="font-heading font-semibold text-sm text-slate-200 mb-1">{opt.label}</div>
              <div className="text-xs text-muted leading-relaxed">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm animate-fade-in">
          <span>⚠️</span> {error}
        </div>
      )}

      <button type="submit" id="btn-start-exam" disabled={!isValid || isLoading}
        className={`w-full py-4 rounded-xl font-heading font-bold text-base transition-all duration-200 ${
          isValid && !isLoading
            ? 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]'
            : 'bg-surface border border-border text-muted cursor-not-allowed'
        }`}>
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Đang tạo phiên thi...
          </span>
        ) : 'Bắt đầu làm bài →'}
      </button>
    </form>
  );
};

export default ScopeModePicker;
```

- [ ] **Step 2: Redesign ExamStartPage.tsx**

```tsx
// frontend/src/features/exam/pages/ExamStartPage.tsx
import React, { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import ScopeModePicker from '../components/ScopeModePicker';
import { createAttempt } from '../api/attemptApi';
import type { CreateAttemptRequest } from '../types/api.types';

const ExamStartPage: React.FC = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (req: CreateAttemptRequest) => {
    setIsLoading(true); setError(null);
    try {
      const workspace = await createAttempt(req);
      navigate(`/attempts/${workspace.attempt_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tạo phiên thi. Vui lòng thử lại.');
    } finally { setIsLoading(false); }
  };

  if (!examId) return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="text-danger font-medium">Exam ID không hợp lệ</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0F172A] text-slate-100">
      <header className="border-b border-border/50 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-muted hover:text-slate-200 transition-colors text-sm flex items-center gap-1">
          ← Trang chủ
        </Link>
        <span className="text-border/60">|</span>
        <span className="font-heading font-semibold text-slate-300 text-sm">Thiết lập phiên thi</span>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full text-primary text-xs font-medium mb-4">
            📝 Exam #{examId}
          </div>
          <h1 className="font-heading font-extrabold text-3xl text-slate-100 mb-2">Thiết lập phiên thi</h1>
          <p className="text-muted text-sm leading-relaxed">
            Chọn phạm vi và chế độ thi phù hợp với mục tiêu luyện tập của bạn.
          </p>
        </div>
        <div className="bg-surface/60 border border-border/60 rounded-2xl p-6 sm:p-8 shadow-xl">
          <ScopeModePicker examId={parseInt(examId, 10)} onSubmit={handleSubmit} isLoading={isLoading} error={error} />
        </div>
      </main>
    </div>
  );
};

export default ExamStartPage;
```

- [ ] **Step 3: Verify**

Mở `http://localhost:5173/exams/1/start`:
- ✅ Scope cards với icon + description, click → viền blue highlight
- ✅ SINGLE_SKILL chọn → Section pills xuất hiện (animate-fade-in)
- ✅ Mode 2 cards: Mock (blue ring) vs Practice (green ring)
- ✅ Submit button disabled khi chưa chọn đủ

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/exam/pages/ExamStartPage.tsx frontend/src/features/exam/components/ScopeModePicker.tsx
git commit -m "feat(ui): redesign ExamStartPage with card-based scope/mode picker"
```

---

## Task 3: Redesign WorkspacePage + TimerDisplay + SaveStatusBadge

**Files:**
- Modify: `frontend/src/features/exam/pages/WorkspacePage.tsx`
- Modify: `frontend/src/features/exam/components/TimerDisplay.tsx`
- Modify: `frontend/src/features/exam/components/SaveStatusBadge.tsx`

**Interfaces:**
- Consumes: `useWorkspace`, `useExamTimer`, `useAutosave` — giữ nguyên tất cả
- Produces: Layout 2-cột dark, header sticky, sidebar timer+palette

- [ ] **Step 1: Redesign TimerDisplay.tsx**

```tsx
// frontend/src/features/exam/components/TimerDisplay.tsx
interface TimerDisplayProps {
  displayTime: string;
  isExpired: boolean;
  isPractice: boolean;
}

function parseToSeconds(time: string): number {
  const parts = time.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export function TimerDisplay({ displayTime, isExpired, isPractice }: TimerDisplayProps) {
  if (isPractice) return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/30 rounded-lg text-success text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      Practice Mode
    </div>
  );

  const seconds = parseToSeconds(displayTime);
  const isWarning = !isExpired && seconds <= 300;
  const isDanger = isExpired || seconds <= 60;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-heading font-bold text-sm tabular-nums transition-all duration-300 ${
        isDanger ? 'bg-danger/10 border border-danger/40 text-danger animate-pulse' :
        isWarning ? 'bg-warning/10 border border-warning/40 text-warning' :
        'bg-surface border border-border text-slate-300'
      }`}
      aria-live="polite"
      aria-label={`Thời gian còn lại: ${displayTime}`}
    >
      <span>{isDanger ? '🔴' : isWarning ? '⚠️' : '⏱'}</span>
      {displayTime}
    </div>
  );
}
```

- [ ] **Step 2: Redesign SaveStatusBadge.tsx**

```tsx
// frontend/src/features/exam/components/SaveStatusBadge.tsx
import { useSelector } from 'react-redux';
import { selectSaveStatus } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

export function SaveStatusBadge() {
  const { isDirty, isSaving } = useSelector((state: RootState) => selectSaveStatus(state));

  if (isSaving) return (
    <span className="flex items-center gap-1.5 text-xs text-warning px-2 py-1 bg-warning/10 border border-warning/20 rounded-full">
      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
      </svg>
      Đang lưu...
    </span>
  );

  if (isDirty) return (
    <span className="flex items-center gap-1.5 text-xs text-muted px-2 py-1 bg-surface border border-border rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-warning" /> Chưa lưu
    </span>
  );

  return (
    <span className="flex items-center gap-1.5 text-xs text-success px-2 py-1 bg-success/10 border border-success/20 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-success" /> Đã lưu
    </span>
  );
}
```

- [ ] **Step 3: Thay phần return() trong WorkspacePage.tsx**

Giữ nguyên toàn bộ phần logic trên (useWorkspace, useExamTimer, useAutosave, handleSubmit, useEffect, memo, allParts, partQuestions, unansweredCount). Chỉ thay các đoạn `if (loading)`, `if (error)`, và `return (...)` ở cuối:

```tsx
// Loading state
if (loading) {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <svg className="animate-spin h-10 w-10 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p className="text-muted text-sm" role="status" aria-live="polite">Đang tải phiên thi...</p>
      </div>
    </div>
  );
}

// Error state
if (error) {
  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-surface border border-border rounded-2xl p-6 text-center" role="alert">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-slate-300 mb-6 text-sm">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={retry} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-semibold transition-colors">
            Thử lại
          </button>
          <button onClick={() => navigate('/')} className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-muted rounded-xl text-sm font-medium border border-border transition-colors">
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}

if (!workspace) return null;
if (workspace.status === 'COMPLETED') { navigate(`/attempts/${attemptId}/result`); return null; }

// Main layout
return (
  <div className="flex flex-col h-screen bg-[#0F172A] overflow-hidden">
    {/* Header */}
    <header className="shrink-0 border-b border-border/50 bg-[#0F172A]/95 backdrop-blur-sm px-4 sm:px-6 py-3 flex items-center justify-between gap-4 z-20">
      <h1 className="font-heading font-bold text-slate-200 text-sm sm:text-base truncate">
        {workspace.exam_snapshot?.title || 'Bài thi'}
      </h1>
      <div className="flex items-center gap-2 shrink-0">
        <SaveStatusBadge />
        <TimerDisplay displayTime={displayTime} isExpired={isExpired} isPractice={isPractice} />
      </div>
    </header>

    {/* Body */}
    <div className="flex flex-1 overflow-hidden">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        {allParts.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {allParts.map((p: any) => {
              const pId = p.part_id ?? p.id;
              const isActive = pId === partId;
              return (
                <button key={pId} type="button" onClick={() => setSelectedPartId(pId)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                    isActive ? 'bg-primary text-white shadow-md shadow-primary/30' :
                    'bg-surface border border-border text-muted hover:text-slate-200 hover:border-border-light'
                  }`}>
                  {p.title || `Part ${pId}`}
                </button>
              );
            })}
          </div>
        )}

        {partQuestions.length > 0 ? (
          <div className="flex flex-col gap-4 max-w-3xl">
            {partQuestions.map((q) => {
              const qId = q.question_id;
              const currentVal = answersState.answers?.[partId]?.[qId] ?? null;
              return (
                <div key={qId} id={`q-${qId}`}
                  className="bg-surface/60 border border-border/60 rounded-2xl p-5 sm:p-6 transition-all duration-200 scroll-mt-4 hover:border-border">
                  <div className="font-heading font-semibold text-slate-200 text-sm mb-4 leading-relaxed flex items-start gap-2">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary/20 text-primary-light rounded-full text-xs font-bold shrink-0">
                      {q.question_number}
                    </span>
                    {q.question_text}
                  </div>
                  <QuestionRenderer question={q} partId={partId} currentAnswer={currentVal}
                    onChange={(val) => dispatch(setAnswer({ partId, questionId: qId, value: val }))} />
                </div>
              );
            })}
          </div>
        ) : (
          <pre className="text-xs text-muted overflow-auto max-h-80 bg-surface rounded-xl p-4 border border-border">
            {JSON.stringify(workspace.exam_snapshot, null, 2)}
          </pre>
        )}
      </main>

      {/* Sidebar */}
      <aside className="hidden lg:flex w-72 shrink-0 flex-col border-l border-border/50 bg-surface/30 overflow-y-auto">
        <div className="p-4 flex-1">
          <h2 className="font-heading font-semibold text-slate-300 text-xs uppercase tracking-wider mb-3">Bảng câu hỏi</h2>
          <QuestionPalette questions={partQuestions} partId={partId}
            onNavigate={(qId) => document.getElementById(`q-${qId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        </div>
        <div className="p-4 border-t border-border/50">
          <button id="btn-submit-exam" disabled={isSubmitting} onClick={() => setShowConfirm(true)}
            className={`w-full py-3 rounded-xl font-heading font-bold text-sm transition-all duration-200 ${
              isSubmitting ? 'bg-surface border border-border text-muted cursor-not-allowed' :
              'bg-danger hover:bg-red-700 text-white shadow-lg shadow-danger/20 hover:scale-[1.01] active:scale-[0.99]'
            }`}>
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang nộp...
              </span>
            ) : '🚀 Nộp bài'}
          </button>
        </div>
      </aside>
    </div>

    <SubmitConfirmModal open={showConfirm} unansweredCount={unansweredCount}
      onConfirm={() => { setShowConfirm(false); setShowOverlay(true); handleSubmit(); }}
      onCancel={() => setShowConfirm(false)} />
    <SubmitOverlay visible={showOverlay} isRetrying={isSubmitting} onRetry={handleSubmit} />
  </div>
);
```

- [ ] **Step 4: Verify**

Mở `http://localhost:5173/attempts/17`:
- ✅ Sticky header với timer pill + save badge
- ✅ Part tabs dạng pill, active = solid blue
- ✅ Question cards dark surface, hover border
- ✅ Sidebar hiển thị trên lg:, ẩn trên mobile
- ✅ Timer đổi màu vàng/đỏ tùy ngưỡng thời gian

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/exam/pages/WorkspacePage.tsx \
        frontend/src/features/exam/components/TimerDisplay.tsx \
        frontend/src/features/exam/components/SaveStatusBadge.tsx
git commit -m "feat(ui): redesign WorkspacePage with dark layout, sticky header, responsive sidebar"
```

---

## Task 4: Redesign QuestionPalette

**Files:**
- Modify: `frontend/src/features/exam/components/QuestionPalette.tsx`

- [ ] **Step 1: Implement**

```tsx
// frontend/src/features/exam/components/QuestionPalette.tsx
import React from 'react';
import { useSelector } from 'react-redux';
import type { Question } from '../types/exam.types';
import { selectAnsweredQuestionIds } from '../store/answerSlice';
import type { RootState } from '../../../store/store';

interface QuestionPaletteProps {
  questions: Question[];
  partId: number;
  onNavigate: (questionId: string) => void;
}

const QuestionPalette: React.FC<QuestionPaletteProps> = ({ questions, partId, onNavigate }) => {
  const answeredIds = useSelector((state: RootState) => selectAnsweredQuestionIds(state, partId));
  const answeredSet = new Set(answeredIds);
  const answeredCount = answeredSet.size;
  const totalCount = questions.length;

  return (
    <nav aria-label="Điều hướng câu hỏi">
      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>Đã làm</span>
          <span className="font-semibold text-slate-300">{answeredCount}/{totalCount}</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(answeredCount / totalCount) * 100}%` : '0%' }} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => {
          const answered = answeredSet.has(q.question_id);
          return (
            <button key={q.question_id} type="button"
              data-testid={`palette-${q.question_id}`}
              data-answered={answered ? 'true' : 'false'}
              aria-label={`Câu ${q.question_number}${answered ? ' (đã trả lời)' : ' (chưa trả lời)'}`}
              onClick={() => onNavigate(q.question_id)}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all duration-200 hover:scale-110 ${
                answered
                  ? 'bg-success text-white border border-success shadow-sm shadow-success/30'
                  : 'bg-surface-2 text-muted border border-border hover:border-border-light hover:text-slate-300'
              }`}>
              {q.question_number}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-3 text-xs text-muted">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-success inline-block" /> Đã làm
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-surface-2 border border-border inline-block" /> Chưa làm
        </span>
      </div>
    </nav>
  );
};

export { QuestionPalette };
export default QuestionPalette;
```

- [ ] **Step 2: Verify**

Mở workspace → sidebar: ✅ Progress bar | ✅ Green = đã làm | ✅ Gray = chưa làm | ✅ Legend

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/exam/components/QuestionPalette.tsx
git commit -m "feat(ui): redesign QuestionPalette with progress bar and clear 2-state colors"
```

---

## Task 5: Redesign SubmitConfirmModal + SubmitOverlay

**Files:**
- Modify: `frontend/src/features/exam/components/SubmitConfirmModal.tsx`
- Modify: `frontend/src/features/exam/components/SubmitOverlay.tsx`

- [ ] **Step 1: Implement SubmitConfirmModal.tsx**

```tsx
// frontend/src/features/exam/components/SubmitConfirmModal.tsx
interface SubmitConfirmModalProps {
  open: boolean;
  unansweredCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmModal({ open, unansweredCount, onConfirm, onCancel }: SubmitConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog" aria-modal="true" aria-labelledby="submit-dialog-title">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-surface border border-border rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl animate-slide-up">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-danger/10 border-2 border-danger/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚀</span>
          </div>
          <h2 id="submit-dialog-title" className="font-heading font-bold text-slate-100 text-xl mb-2">
            Xác nhận nộp bài
          </h2>
          {unansweredCount > 0 ? (
            <p className="text-muted text-sm">
              Bạn còn{' '}
              <span className="inline-flex items-center justify-center min-w-[1.75rem] h-7 bg-danger text-white text-sm font-bold rounded-full px-2">
                {unansweredCount}
              </span>{' '}
              câu chưa trả lời. Sau khi nộp, bạn không thể chỉnh sửa.
            </p>
          ) : (
            <p className="text-muted text-sm">Bạn đã hoàn thành tất cả câu hỏi. Xác nhận nộp bài?</p>
          )}
        </div>
        <div className="flex gap-3">
          <button id="btn-cancel-submit" onClick={onCancel}
            className="flex-1 py-3 rounded-xl font-semibold text-sm text-muted bg-surface-2 hover:bg-surface-3 border border-border transition-all duration-200">
            Làm tiếp
          </button>
          <button id="btn-confirm-submit" onClick={onConfirm}
            className="flex-1 py-3 rounded-xl font-heading font-bold text-sm text-white bg-danger hover:bg-red-700 shadow-lg shadow-danger/20 transition-all duration-200 hover:scale-[1.01]">
            Nộp bài
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement SubmitOverlay.tsx**

```tsx
// frontend/src/features/exam/components/SubmitOverlay.tsx
interface SubmitOverlayProps {
  visible: boolean;
  isRetrying: boolean;
  onRetry: () => void;
}

export function SubmitOverlay({ visible, isRetrying, onRetry }: SubmitOverlayProps) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 bg-[#0F172A]/90 backdrop-blur-md flex items-center justify-center"
      role="status" aria-live="assertive" aria-label="Đang nộp bài">
      <div className="text-center">
        {isRetrying ? (
          <>
            <svg className="animate-spin h-12 w-12 text-primary mx-auto mb-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p className="font-heading font-semibold text-slate-200 text-lg">Đang nộp bài...</p>
            <p className="text-muted text-sm mt-1">Vui lòng không đóng trình duyệt</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⏳</div>
            <p className="font-heading font-semibold text-slate-200 text-lg mb-4">Nộp bài thất bại</p>
            <button onClick={onRetry}
              className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl text-sm transition-all">
              Thử lại
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Mở `http://localhost:5173/attempts/20` → bấm "🚀 Nộp bài":
- ✅ Modal xuất hiện có backdrop blur
- ✅ Số câu chưa làm = red badge nổi bật
- ✅ "Làm tiếp" (gray) vs "Nộp bài" (red) rõ ràng

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/exam/components/SubmitConfirmModal.tsx \
        frontend/src/features/exam/components/SubmitOverlay.tsx
git commit -m "feat(ui): redesign submit modal/overlay with danger states and backdrop blur"
```

---

## Task 6: Redesign ExamResultPage

**Files:**
- Modify: `frontend/src/features/exam/pages/ExamResultPage.tsx`

- [ ] **Step 1: Generate màn ExamResult từ Stitch MCP**

Gọi `stitch:generate_screen_from_text` với projectId `10243514455416787208` và prompt:
```
Exam Result celebration page. Dark slate background.
Center: large green checkmark circle with gradient glow.
Heading 'Nộp bài thành công!' Plus Jakarta Sans bold.
Info card: attempt ID, COMPLETED badge (emerald), note about grading.
Two CTAs: ghost 'Về trang chủ', primary blue 'Làm bài mới'.
Subtle sparkle/confetti decorations.
```

Lưu output: `docs/designs/stitch/screens/exam-result/screen.html`

- [ ] **Step 2: Implement ExamResultPage.tsx**

```tsx
// frontend/src/features/exam/pages/ExamResultPage.tsx
import React from 'react';
import { useParams, Link } from 'react-router-dom';

const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="max-w-lg w-full animate-slide-up">
        <div className="bg-surface/60 border border-border/60 rounded-2xl p-8 text-center shadow-2xl">
          {/* Checkmark */}
          <div className="relative mb-6 inline-block">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-success to-emerald-700 flex items-center justify-center mx-auto shadow-lg shadow-success/30">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 text-xl">✨</span>
            <span className="absolute -bottom-1 -left-1 text-lg">🎉</span>
          </div>

          <h1 className="font-heading font-extrabold text-2xl text-slate-100 mb-2">Nộp bài thành công!</h1>
          <p className="text-muted text-sm mb-8">Phiên thi đã được ghi nhận. Kết quả chi tiết sẽ có sau khi chấm bài.</p>

          {/* Info card */}
          <div className="bg-surface border border-border/60 rounded-xl p-4 text-left mb-8 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Mã phiên thi</span>
              <span className="font-semibold text-slate-200 font-mono">#{attemptId}</span>
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Trạng thái</span>
              <span className="px-2.5 py-1 bg-success/15 text-success border border-success/30 rounded-full text-xs font-bold">COMPLETED</span>
            </div>
            <div className="h-px bg-border/50" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted">Chấm điểm chi tiết</span>
              <span className="text-muted text-xs">Sẽ cập nhật sau</span>
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/"
              className="flex-1 py-3 rounded-xl font-heading font-semibold text-sm text-muted bg-surface-2 hover:bg-surface-3 border border-border transition-all duration-200 text-center">
              ← Trang chủ
            </Link>
            <Link to="/exams/1/start" id="btn-new-exam"
              className="flex-1 py-3 rounded-xl font-heading font-bold text-sm text-white bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-[1.01] text-center">
              Làm bài mới →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResultPage;
```

- [ ] **Step 3: Verify**

Mở `http://localhost:5173/attempts/21/result`:
- ✅ Checkmark xanh lớn + sparkle emoji
- ✅ Info card 3 dòng rõ ràng
- ✅ CTA buttons center-aligned, hover scale

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/exam/pages/ExamResultPage.tsx
git commit -m "feat(ui): redesign ExamResultPage with success celebration and info card"
```

---

## Self-Review

**1. Spec Coverage:**
- ✅ Task 0: Design tokens (index.css + tailwind.config.js)
- ✅ Task 1: Home Dashboard (App.tsx)
- ✅ Task 2: ExamStartPage + ScopeModePicker (card-based picker)
- ✅ Task 3: WorkspacePage (dark layout) + TimerDisplay + SaveStatusBadge
- ✅ Task 4: QuestionPalette (progress bar + 2-state colors)
- ✅ Task 5: SubmitConfirmModal + SubmitOverlay
- ✅ Task 6: ExamResultPage (celebration UI)

**2. Placeholder scan:** Không có TBD, TODO, hoặc "implement later".

**3. Type consistency:**
- `TimerDisplayProps` — nhất quán Tasks 3
- `QuestionPaletteProps.questions: Question[]` — nhất quán Tasks 3, 4
- `SubmitConfirmModal` interface giữ nguyên từ code cũ

**4. Review Focus addressed:**
- Timer pulse/warning: Task 3 TimerDisplay với `parseToSeconds`
- Palette 2 trạng thái rõ: Task 4 color mapping
- Mobile sidebar ẩn: Task 3 `hidden lg:flex` sidebar
- Loading spinner: Task 3 full-screen spinner
- Submit modal danger badge: Task 5 red badge cho `unansweredCount`
