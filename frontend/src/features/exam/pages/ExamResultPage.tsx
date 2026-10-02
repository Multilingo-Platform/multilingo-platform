import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';

interface ReviewQuestion {
  id: number;
  part: number;
  type: string;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  isFlagged?: boolean;
  citation?: string;
  explanation: string;
}

const SAMPLE_QUESTIONS: ReviewQuestion[] = [
  {
    id: 1,
    part: 1,
    type: 'True / False / Not Given',
    questionText: 'Early cetaceans possessed neocortical structures comparable to modern primates.',
    userAnswer: 'FALSE',
    correctAnswer: 'FALSE',
    isCorrect: true,
    citation: 'Passage 1, Paragraph A: "...Eocene archaeocetes show diminutive, elongated brains. The neocortical convolutions occurred abruptly during Oligocene epoch..."',
    explanation: 'Đáp án FALSE vì đoạn văn chỉ ra não bộ cá voi thời kỳ đầu thuôn nhỏ và chưa có nếp nhăn vỏ não như linh trưởng hiện đại.',
  },
  {
    id: 2,
    part: 1,
    type: 'True / False / Not Given',
    questionText: 'Echolocation evolved simultaneously with complex acoustic communication.',
    userAnswer: 'TRUE',
    correctAnswer: 'TRUE',
    isCorrect: true,
    citation: 'Passage 1, Paragraph B: "...coincident with the emergence of echolocation and intense acoustic specialization across pod interactions..."',
    explanation: 'Đáp án TRUE do hai cơ chế này xuất hiện đồng thời trong kỷ Oligocene theo hóa thạch âm thanh.',
  },
  {
    id: 3,
    part: 1,
    type: 'True / False / Not Given',
    questionText: 'Social pack hunting in orcas requires multi-generational knowledge transfer.',
    userAnswer: 'NOT GIVEN',
    correctAnswer: 'TRUE',
    isCorrect: false,
    isFlagged: true,
    citation: 'Passage 1, Paragraph B: "...juveniles spend up to a decade shadowing adult matrilines before acquiring the precision... demonstrating true cultural transmission across matriarchal lines..."',
    explanation: 'Bạn chọn NOT GIVEN do không nhận diện được cụm từ đồng nghĩa "cultural transmission across matriarchal lines" tương ứng với "multi-generational knowledge transfer".',
  },
  {
    id: 4,
    part: 2,
    type: 'Multiple Choice',
    questionText: 'Which anatomical feature was historically thought to be unique to hominids?',
    userAnswer: 'C. Von Economo neurons',
    correctAnswer: 'C. Von Economo neurons',
    isCorrect: true,
    citation: 'Passage 2, Paragraph B: "...specialized spindle cells, or von Economo neurons (VENs), historically thought to be unique to hominids and great apes."',
    explanation: 'Đáp án chính xác C. Tế bào thần kinh thoi VENs được tìm thấy ở cá voi có răng.',
  },
  {
    id: 5,
    part: 2,
    type: 'Fill in the Blank',
    questionText: 'Synchrotron imaging revealed exponential growth in dolphin ________ density.',
    userAnswer: 'sensory cortex',
    correctAnswer: 'auditory nerve',
    isCorrect: false,
    citation: 'Passage 2, Paragraph C: "...auditory nerve density in ancestral dolphin lineages increased exponentially over a 15-million-year span."',
    explanation: 'Từ cần điền chính xác theo nguyên văn là "auditory nerve", không phải sensory cortex.',
  },
  {
    id: 6,
    part: 3,
    type: 'Matching Headings',
    questionText: 'Select the heading that best captures Section D.',
    userAnswer: 'iv. Coordinated hunting paradigms and matriarchal learning',
    correctAnswer: 'iv. Coordinated hunting paradigms and matriarchal learning',
    isCorrect: true,
    citation: 'Passage 3, Paragraph D: "...intricate pack strategies among modern orcas reveal cooperative social cognition... wave-washing techniques to displace seals..."',
    explanation: 'Tiêu đề iv bao quát chính xác nội dung học hỏi kỹ thuật săn mồi phối hợp từ các con đầu đàn.',
  },
];

type FilterType = 'ALL' | 'CORRECT' | 'INCORRECT' | 'UNANSWERED' | 'FLAGGED';

const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  const filteredQuestions = SAMPLE_QUESTIONS.filter((q) => {
    if (filter === 'CORRECT') return q.isCorrect;
    if (filter === 'INCORRECT') return !q.isCorrect;
    if (filter === 'FLAGGED') return q.isFlagged;
    if (filter === 'UNANSWERED') return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* 1. TOP STICKY APP HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs flex items-center justify-between">
        {/* Left: Brand + Breadcrumbs */}
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 text-decoration-none group">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <span className="font-heading font-bold text-amber-700 text-lg hidden sm:inline">Multilingo</span>
          </Link>

          <span className="text-slate-300">/</span>

          <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-amber-700 transition-colors">Trang chủ</Link>
            <span className="text-slate-300">›</span>
            <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-none">
              Kết quả thi #{attemptId}
            </span>
          </div>
        </div>

        {/* Right: Streak & Actions */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200 text-xs font-bold">
            <span className="text-amber-600">🔥</span>
            <span>5 ngày</span>
          </div>

          <Link
            to="/exams/1/start"
            className="btn-primary text-xs py-1.5 px-3 hidden sm:inline-flex"
          >
            ✨ Làm bài mới
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 2. HERO SCORE BANNER */}
        <section className="bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border border-amber-200/80 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Score Ring (Left 4 cols) */}
            <div className="lg:col-span-4 flex items-center gap-6 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle className="opacity-20" cx="60" cy="60" fill="transparent" r="50" stroke="#d97706" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" fill="transparent" r="50"
                    stroke="#d97706" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="314.16" strokeDashoffset="62.8"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="font-heading font-extrabold text-3xl sm:text-4xl text-amber-800 leading-none">6.5</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">IELTS Band</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="badge-green text-xs">
                  ✓ Đạt mục tiêu ban đầu
                </span>
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  IELTS Academic Reading
                </h1>
                <p className="text-xs text-slate-500">
                  Attempt ID: <strong className="text-slate-700">#{attemptId}</strong> • Trạng thái: <span className="text-emerald-700 font-semibold">COMPLETED</span>
                </p>
              </div>
            </div>

            {/* Metrics Chips (Center 5 cols) */}
            <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Số câu đúng</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-bold text-slate-900">32</span>
                  <span className="text-xs text-slate-400">/40</span>
                  <span className="ml-auto text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">80%</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Thời gian</span>
                  <span className="text-amber-600">⏱</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-heading text-xl font-bold text-slate-900">48:15</span>
                  <span className="text-[11px] text-slate-400">/ 60m</span>
                </div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Mục tiêu</span>
                  <span className="text-emerald-600">📈</span>
                </div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="font-heading text-2xl font-bold text-emerald-600">+0.5</span>
                  <span className="text-xs font-semibold text-emerald-600">Band</span>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-3 p-3 bg-white/80 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <span className="text-amber-600">📊</span>
                  Tỉ lệ theo Passage:
                </span>
                <div className="flex items-center gap-3">
                  <span>Passage 1: <strong className="text-emerald-600">11/13</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Passage 2: <strong className="text-emerald-600">12/13</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>Passage 3: <strong className="text-amber-700">9/14</strong></span>
                </div>
              </div>
            </div>

            {/* CTAs (Right 3 cols) */}
            <div className="lg:col-span-3 flex flex-col gap-2.5 justify-center">
              <a
                href="#questions-section"
                className="btn-primary text-center justify-center text-sm py-2.5"
              >
                Xem lại chi tiết từng câu ↓
              </a>
              <Link
                to="/exams/1/start"
                className="btn-outline text-center justify-center text-sm py-2"
              >
                🔄 Làm lại đề thi
              </Link>
              <Link
                to="/"
                className="text-xs text-slate-500 hover:text-amber-700 text-center py-1 transition-colors"
              >
                ← Trở về Trang chủ
              </Link>
            </div>
          </div>
        </section>

        {/* 3. TWO-COLUMN ANALYTICS & AI INSIGHTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT: 4-Axis Competency Breakdown (7 cols) */}
          <section className="lg:col-span-7 ed-card p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-heading text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-sm">🎯</span>
                  Phân tích năng lực chuyên sâu (Competency Matrix)
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Đánh giá đa trục dựa trên chuẩn khảo thí IELTS quốc tế & mô hình Multilingo AI
                </p>
              </div>
              <span className="badge-orange text-[11px] hidden sm:inline-flex">Standard 2026</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Radar diagram placeholder (5 cols) */}
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="relative w-44 h-44 flex items-center justify-center">
                  <svg className="w-full h-full" viewBox="0 0 200 200">
                    <polygon fill="none" points="100,20 176,64 176,152 100,196 24,152 24,64" stroke="#d1d5db" strokeDasharray="3 3" strokeWidth="1" />
                    <polygon fill="none" points="100,45 155,77 155,140 100,172 45,140 45,77" stroke="#e5e7eb" strokeWidth="1" />
                    <polygon fill="none" points="100,70 134,89 134,127 100,147 66,127 66,89" stroke="#e5e7eb" strokeWidth="1" />
                    <line stroke="#e5e7eb" strokeWidth="1" x1="100" x2="100" y1="20" y2="196" />
                    <line stroke="#e5e7eb" strokeWidth="1" x1="24" x2="176" y1="64" y2="152" />
                    <line stroke="#e5e7eb" strokeWidth="1" x1="24" x2="176" y1="152" y2="64" />
                    <polygon fill="#fef3c7" fillOpacity="0.75" points="100,32 165,72 168,144 100,180 50,145 42,75" stroke="#d97706" strokeWidth="2.5" />
                    <circle cx="100" cy="32" fill="#b45309" r="3.5" />
                    <circle cx="165" cy="72" fill="#b45309" r="3.5" />
                    <circle cx="168" cy="144" fill="#b45309" r="3.5" />
                    <circle cx="100" cy="180" fill="#b45309" r="3.5" />
                    <circle cx="50" cy="145" fill="#b45309" r="3.5" />
                    <circle cx="42" cy="75" fill="#b45309" r="3.5" />
                  </svg>
                </div>
                <span className="text-[11px] font-medium text-slate-500 mt-2">Biểu đồ cân bằng kỹ năng</span>
              </div>

              {/* 4 Dimension Progress Bars (7 cols) */}
              <div className="md:col-span-7 space-y-4">
                {/* 1 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-800">Reading Comprehension</span>
                    <span className="text-emerald-700 font-bold">85% (Rất tốt)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '85%' }} />
                  </div>
                  <span className="text-[11px] text-slate-500">Khả năng đọc hiểu đại ý, cấu trúc mạch văn</span>
                </div>

                {/* 2 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-800">Vocabulary & Lexical Resource</span>
                    <span className="text-amber-700 font-bold">78% (Tốt)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: '78%' }} />
                  </div>
                  <span className="text-[11px] text-slate-500">Vốn từ vựng học thuật & cụm từ đồng nghĩa</span>
                </div>

                {/* 3 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-800">Speed & Time Management</span>
                    <span className="text-emerald-700 font-bold">90% (Xuất sắc)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
                  </div>
                  <span className="text-[11px] text-slate-500">Tốc độ quét thông tin (1.2 phút / câu)</span>
                </div>

                {/* 4 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-slate-800">Critical Inference & Logic</span>
                    <span className="text-red-600 font-bold">65% (Cần cải thiện)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: '65%' }} />
                  </div>
                  <span className="text-[11px] text-slate-500">Tư duy suy luận logic & bẫy False vs Not Given</span>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT: Deep AI Diagnostic & Actionable Advice (5 cols) */}
          <section className="lg:col-span-5 ed-card p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center text-sm shadow-xs">
                  ✨
                </span>
                <h2 className="font-heading text-lg font-bold text-slate-900">
                  AI Diagnostic & Lộ trình đề xuất
                </h2>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Multilingo AI
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Strength card */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div className="space-y-1">
                  <div className="font-heading font-bold text-emerald-900 text-xs uppercase tracking-wide">
                    Điểm mạnh nổi trội
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Tốc độ đọc quét skimming & scanning cực tốt (1.2 phút/câu). Nhận diện chính xác 95% từ đồng nghĩa học thuật trong đoạn văn khoa học.
                  </p>
                </div>
              </div>

              {/* Weakness card */}
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                  !
                </div>
                <div className="space-y-1">
                  <div className="font-heading font-bold text-amber-900 text-xs uppercase tracking-wide">
                    Lỗ hổng kiến thức cần khắc phục
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Thường nhầm lẫn giữa <strong className="text-red-600">FALSE</strong> và <strong className="text-slate-900">NOT GIVEN</strong> ở các câu hỏi suy luận sâu (Paragraph C). Có xu hướng suy đoán thông tin ngoài bài đọc.
                  </p>
                </div>
              </div>

              {/* Action Plan */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>Lộ trình khắc phục đề xuất</span>
                  <span className="badge-orange text-[10px]">Ưu tiên cao</span>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800">1. Luyện 20 câu True/False/Not Given bẫy suy luận</span>
                  <Link to="/exams/1/start" className="text-amber-700 font-bold hover:underline shrink-0">
                    Luyện ngay →
                  </Link>
                </div>

                <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800">2. Ôn bộ 15 từ vựng học thuật trong bài đọc</span>
                  <Link to="/exams/1/start" className="text-slate-600 font-bold hover:text-slate-900 shrink-0">
                    Flashcards →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 4. DETAILED QUESTION-BY-QUESTION REVIEW SECTION */}
        <section id="questions-section" className="ed-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Chi tiết từng câu hỏi ({SAMPLE_QUESTIONS.length} câu)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Xem lại đáp án đã chọn, đối chiếu trích dẫn nguyên văn và phân tích lỗi sai từ Multilingo AI
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                  filter === 'ALL'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả ({SAMPLE_QUESTIONS.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('CORRECT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                  filter === 'CORRECT'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đúng ({SAMPLE_QUESTIONS.filter(q => q.isCorrect).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('INCORRECT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                  filter === 'INCORRECT'
                    ? 'bg-red-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sai ({SAMPLE_QUESTIONS.filter(q => !q.isCorrect).length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('FLAGGED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                  filter === 'FLAGGED'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Gắn cờ ({SAMPLE_QUESTIONS.filter(q => q.isFlagged).length})
              </button>
            </div>
          </div>

          {/* Quick Palette Nav */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 mr-2">Chọn nhanh câu:</span>
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedQuestionId(selectedQuestionId === q.id ? null : q.id)}
                className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer transition-all ${
                  selectedQuestionId === q.id ? 'ring-2 ring-amber-500 ring-offset-1' : ''
                } ${
                  q.isCorrect
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
                }`}
              >
                {q.id}
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="space-y-4">
            {filteredQuestions.map((q) => (
              <article
                key={q.id}
                className={`p-5 rounded-xl border transition-all ${
                  q.isCorrect
                    ? 'border-emerald-200/80 bg-white hover:border-emerald-300'
                    : 'border-red-200 bg-red-50/20 hover:border-red-300'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-7 h-7 rounded-lg font-heading font-bold text-xs flex items-center justify-center text-white ${
                      q.isCorrect ? 'bg-emerald-600' : 'bg-red-600'
                    }`}>
                      {q.id}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      Part {q.part} • {q.type}
                    </span>
                    {q.isFlagged && (
                      <span className="text-[11px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                        🚩 Đã gắn cờ
                      </span>
                    )}
                  </div>

                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    q.isCorrect
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {q.isCorrect ? '✓ Chính xác (+1)' : '✗ Chưa chính xác (0/1)'}
                  </span>
                </div>

                <p className="font-heading font-semibold text-slate-900 text-sm sm:text-[15px] mb-3 leading-relaxed">
                  {q.questionText}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-medium mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Lựa chọn của bạn:</span>
                    <span className={`font-bold px-2 py-0.5 rounded ${
                      q.isCorrect ? 'bg-emerald-100 text-emerald-900' : 'bg-red-100 text-red-900 line-through'
                    }`}>
                      {q.userAnswer}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">Đáp án chính xác:</span>
                    <span className="font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                      {q.correctAnswer}
                    </span>
                  </div>
                </div>

                {/* AI Explanation & Citation */}
                <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-slate-800 space-y-2">
                  <div className="font-heading font-bold text-amber-900 flex items-center gap-1.5">
                    <span>💡</span>
                    <span>Phân tích đáp án từ Multilingo AI:</span>
                  </div>
                  <p className="leading-relaxed text-slate-700">{q.explanation}</p>
                  {q.citation && (
                    <blockquote className="pt-2 border-t border-amber-200/60 text-slate-600 italic">
                      {q.citation}
                    </blockquote>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default ExamResultPage;
