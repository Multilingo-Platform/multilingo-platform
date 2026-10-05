import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useExamResult } from '../hooks/useExamResult';
import { getAttemptReview } from '../api/attemptApi';
import type { ExamReviewResponse } from '../types/api.types';

type FilterType = 'ALL' | 'CORRECT' | 'INCORRECT' | 'UNANSWERED' | 'FLAGGED';

interface FormattedQuestion {
  id: string;
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

const ExamResultPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const id = parseInt(attemptId || '0', 10);
  
  const { result, loading, error, isPolling } = useExamResult(id);
  
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedPartId, setSelectedPartId] = useState<number | null>(null);
  
  const [reviewData, setReviewData] = useState<ExamReviewResponse | null>(null);
  const [reviewLoading, setReviewLoading] = useState<boolean>(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Default to first part when result loads
  useEffect(() => {
    if (result?.resultSummary?.objective?.byPart && result.resultSummary.objective.byPart.length > 0) {
      if (selectedPartId === null) {
        setSelectedPartId(result.resultSummary.objective.byPart[0].partId);
      }
    }
  }, [result, selectedPartId]);

  // Fetch review data when part changes
  useEffect(() => {
    if (id && selectedPartId !== null) {
      setReviewLoading(true);
      setReviewError(null);
      getAttemptReview(id, selectedPartId)
        .then(data => {
          setReviewData(data);
          setReviewLoading(false);
        })
        .catch(err => {
          setReviewError(err.message);
          setReviewLoading(false);
        });
    }
  }, [id, selectedPartId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (isPolling) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h2 className="text-lg font-bold text-slate-800">Đang chấm điểm...</h2>
          <p className="text-sm text-slate-500">Hệ thống đang xử lý bài làm của bạn. Vui lòng đợi trong giây lát.</p>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">!</div>
          <p className="text-red-600 font-medium">{error || 'Không tìm thấy kết quả'}</p>
          <Link to="/" className="text-amber-600 hover:underline">Quay lại trang chủ</Link>
        </div>
      </div>
    );
  }

  const objSummary = result.resultSummary?.objective;
  
  // Parse review data robustly
  const parsedQuestions: FormattedQuestion[] = [];
  if (reviewData) {
    const questionsList = reviewData.examData?.questions || [];
    const questionsArray = Array.isArray(questionsList) ? questionsList : Object.values(questionsList);
    
    for (const q of questionsArray as any[]) {
      const qId = String(q.id || q.questionId || Math.random());
      const pResult = reviewData.partResult?.[qId] || {};
      const uAnswer = reviewData.userAnswers?.[qId] || {};
      
      let uAnsString = 'Chưa trả lời';
      if (Array.isArray(uAnswer)) {
         uAnsString = uAnswer.join(', ') || 'Chưa trả lời';
      } else if (typeof uAnswer === 'object' && uAnswer !== null) {
         // handle object shape if needed, e.g. { selectedOption: 'A' }
         uAnsString = JSON.stringify(uAnswer);
      } else if (uAnswer !== undefined && uAnswer !== null) {
         uAnsString = String(uAnswer);
      }
      
      let cAnsString = pResult.correctAnswer || '';
      if (Array.isArray(cAnsString)) cAnsString = cAnsString.join(', ');
      
      parsedQuestions.push({
        id: qId,
        part: selectedPartId || 1,
        type: q.type || 'Unknown',
        questionText: q.text || q.questionText || q.content || 'Câu hỏi',
        userAnswer: uAnsString,
        correctAnswer: cAnsString,
        isCorrect: !!pResult.isCorrect,
        explanation: pResult.explanation || 'Không có giải thích.',
        citation: pResult.citation,
        isFlagged: false // Could be passed in userAnswers/flags if supported
      });
    }
  }

  const filteredQuestions = parsedQuestions.filter((q) => {
    if (filter === 'CORRECT') return q.isCorrect;
    if (filter === 'INCORRECT') return !q.isCorrect;
    if (filter === 'FLAGGED') return q.isFlagged;
    if (filter === 'UNANSWERED') return q.userAnswer === 'Chưa trả lời';
    return true;
  });

  const totalQuestions = objSummary?.total || 0;
  const correctQuestions = objSummary?.correct || 0;
  const accuracy = totalQuestions > 0 ? Math.round((correctQuestions / totalQuestions) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs flex items-center justify-between">
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
            <span className="text-slate-300">•</span>
            <span className="text-slate-900 font-semibold truncate max-w-[200px] sm:max-w-none">
              Kết quả - Attempt #{attemptId}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/exams/1/start`} className="btn-primary text-xs py-1.5 px-3 hidden sm:inline-flex">
            📝 Làm bài mới
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* 2. HERO SCORE BANNER */}
        <section className="bg-gradient-to-br from-amber-50 via-white to-amber-50/40 border border-amber-200/80 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Score Ring */}
            <div className="lg:col-span-4 flex items-center gap-6 border-b lg:border-b-0 lg:border-r border-slate-200 pb-6 lg:pb-0 lg:pr-6">
              <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle className="opacity-20" cx="60" cy="60" fill="transparent" r="50" stroke="#d97706" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" fill="transparent" r="50"
                    stroke="#d97706" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray="314.16" strokeDashoffset={`${314.16 - (314.16 * accuracy) / 100}`}
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="font-heading font-extrabold text-2xl sm:text-3xl text-amber-800 leading-none">
                    {correctQuestions}/{totalQuestions}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                    Tỷ lệ {accuracy}%
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h1 className="font-heading text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
                  KẾT QUẢ
                </h1>
                <p className="text-xs text-slate-500">
                  Mã bài: <strong className="text-slate-700">ATTEMPT-{attemptId}</strong> • Trạng thái: <span className="text-emerald-700 font-semibold">{result.status}</span>
                </p>
                <p className="text-xs text-slate-500">
                  Phạm vi: {result.testScope} • Chế độ: {result.testMode}
                </p>
              </div>
            </div>

            {/* Metrics Chips */}
            <div className="lg:col-span-5 grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Đúng</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{objSummary?.correct || 0}</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Sai</span>
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{objSummary?.incorrect || 0}</div>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Chưa trả lời</span>
                  <span className="w-2 h-2 rounded-full bg-slate-300" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{objSummary?.unanswered || 0}</div>
              </div>
            </div>

            <div className="lg:col-span-3 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-200 pt-6 lg:pt-0 lg:pl-6 gap-2">
               <div className="text-center p-3 bg-slate-100 rounded-lg">
                  <div className="text-xs text-slate-500 mb-1">Thời gian làm bài</div>
                  <div className="font-mono text-lg font-bold text-slate-700">
                    {Math.floor(result.timeSpentSeconds / 60)}:{(result.timeSpentSeconds % 60).toString().padStart(2, '0')}
                  </div>
               </div>
            </div>
          </div>
        </section>

        {/* 4. DETAILED QUESTION-BY-QUESTION REVIEW SECTION */}
        <section id="questions-section" className="ed-card p-6 sm:p-8 space-y-6 bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-heading text-lg font-bold text-slate-900">
                Chi tiết bài làm
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Xem lại đáp án đã chọn, trích dẫn nguyên văn và giải thích chi tiết
              </p>
            </div>
            
            {/* Part selection */}
            {objSummary?.byPart && objSummary.byPart.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {objSummary.byPart.map(part => (
                  <button
                    key={part.partId}
                    onClick={() => setSelectedPartId(part.partId)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedPartId === part.partId ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {part.label || `Part ${part.partId}`}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer ${
                  filter === 'ALL'
                    ? 'bg-white text-amber-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả
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
                Đúng
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
                Sai
              </button>
          </div>

          {reviewLoading ? (
            <div className="text-center py-12">
               <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
               <p className="text-sm text-slate-500 mt-2">Đang tải chi tiết...</p>
            </div>
          ) : reviewError ? (
            <div className="text-center py-12 text-red-500">{reviewError}</div>
          ) : parsedQuestions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Không có dữ liệu chi tiết.</div>
          ) : (
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
                    </div>

                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                      q.isCorrect
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {q.isCorrect ? '✓ Chính xác (+1)' : '✗ Chưa chính xác (0/1)'}
                    </span>
                  </div>

                  <p className="font-heading font-semibold text-slate-900 text-sm sm:text-[15px] mb-3 leading-relaxed"
                     dangerouslySetInnerHTML={{ __html: q.questionText }} 
                  />

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

                  {(q.explanation || q.citation) && (
                    <div className="p-3.5 bg-amber-50/70 rounded-xl border border-amber-200/80 text-xs text-slate-800 space-y-2">
                      <div className="font-heading font-bold text-amber-900 flex items-center gap-1.5">
                        <span>💡</span>
                        <span>Giải thích chi tiết:</span>
                      </div>
                      <p className="leading-relaxed text-slate-700">{q.explanation}</p>
                      {q.citation && (
                        <blockquote className="pt-2 border-t border-amber-200/60 text-slate-600 italic">
                          {q.citation}
                        </blockquote>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default ExamResultPage;
