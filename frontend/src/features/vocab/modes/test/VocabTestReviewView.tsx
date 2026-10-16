import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Trophy,
} from 'lucide-react';
import type { VocabTestReviewDetail } from '../../types/vocabTest.types';
import { vocabTestApi } from '../../api/vocabTestApi';
import { SpeakButton } from '../../components/common/SpeakButton';
import { formatSecondsToMmSs } from '../../utils/vocabFormatters';

export interface VocabTestReviewViewProps {
  testToken?: string;
  initialReviewData?: VocabTestReviewDetail | null;
  onRetry: () => void;
  onBackToDeck: () => void;
}

export const VocabTestReviewView: React.FC<VocabTestReviewViewProps> = ({
  testToken,
  initialReviewData,
  onRetry,
  onBackToDeck,
}) => {
  const [review, setReview] = useState<VocabTestReviewDetail | null>(initialReviewData || null);
  const [loading, setLoading] = useState<boolean>(!initialReviewData && !!testToken);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc câu hỏi: Tất cả, Đúng, Sai
  const [filter, setFilter] = useState<'ALL' | 'CORRECT' | 'WRONG'>('ALL');

  useEffect(() => {
    if (!initialReviewData && testToken) {
      setLoading(true);
      setError(null);
      vocabTestApi
        .reviewAnswers(testToken)
        .then((data) => {
          setReview(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err?.response?.data?.message || 'Không thể tải chi tiết bài thi.');
          setLoading(false);
        });
    }
  }, [testToken, initialReviewData]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col items-center justify-center p-4 select-none">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-slate-600 font-semibold text-sm">Đang tải kết quả bài thi...</p>
      </div>
    );
  }

  if (error || !review) {
    return (
      <div className="fixed inset-0 z-[200] bg-slate-100 flex items-center justify-center p-4 select-none">
        <div className="bg-white rounded-md border border-slate-200 p-8 text-center max-w-md w-full shadow-sm animate-in fade-in duration-150">
          <div className="w-12 h-12 rounded-md bg-rose-50 text-rose-500 flex items-center justify-center mb-3 mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">Không thể tải bài thi</h3>
          <p className="text-sm text-slate-500 max-w-md mb-6">{error || 'Không tìm thấy dữ liệu xem lại bài thi.'}</p>
          <button
            type="button"
            onClick={onBackToDeck}
            className="px-4 py-2 bg-slate-800 text-white rounded font-semibold text-sm hover:bg-slate-900 transition-colors cursor-pointer"
          >
            Quay lại bộ thẻ
          </button>
        </div>
      </div>
    );
  }

  const isTimedOut = review.status === 'TIMED_OUT';
  const scoreColor =
    review.score >= 80 ? 'text-emerald-600' : review.score >= 50 ? 'text-amber-600' : 'text-rose-600';

  // Lọc danh sách câu hỏi
  const filteredQuestions = review.reviewItems.filter((item) => {
    if (filter === 'CORRECT') return item.correct;
    if (filter === 'WRONG') return !item.correct;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[200] bg-slate-100 flex flex-col justify-between overflow-y-auto select-none">
      {/* 1. Header Trải Dài Toàn Màn Hình */}
      <header className="w-full bg-white border-b border-slate-200 shadow-2xs shrink-0 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBackToDeck}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay về bộ thẻ</span>
          </button>

          <h1 className="text-base font-bold text-slate-900 truncate">
            Kết quả thi thử từ vựng
          </h1>

          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold shadow-xs transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Thi lại đề khác</span>
          </button>
        </div>
      </header>

      {/* 2. Thân Trang Bố Cục Rộng Rãi Toàn Màn Hình */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Banner Tổng Kết Điểm Số & Thành Tích */}
        <div className="bg-white rounded-md border border-slate-200 p-6 sm:p-7 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-13 h-13 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                <Trophy className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {isTimedOut ? 'Hết giờ làm bài thi thử' : 'Hoàn thành bài thi thử!'}
                  </h2>
                  {isTimedOut ? (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      Hết giờ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Hoàn thành
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-600">
                  Thời gian làm bài: <strong>{formatSecondsToMmSs(review.timeSpentSeconds)}</strong>
                  {review.xpEarned > 0 && <span> • Nhận được <strong>+{review.xpEarned} XP</strong></span>}
                </p>
              </div>
            </div>

            {/* Khối Điểm số */}
            <div className="flex items-baseline gap-2 bg-slate-50 px-5 py-3 rounded-md border border-slate-200 self-start sm:self-auto shrink-0">
              <span className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${scoreColor}`}>
                {review.score}
              </span>
              <span className="text-sm font-semibold text-slate-500">/ 100 điểm</span>
            </div>
          </div>

          {/* Lưới 6 Chỉ số thống kê trải rộng */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5">
            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Tổng số câu</span>
              <span className="text-xl font-bold text-slate-800">{review.totalQuestions}</span>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Độ chính xác</span>
              <span className={`text-xl font-bold ${scoreColor}`}>{review.score}%</span>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Trả lời đúng</span>
              <span className="text-xl font-bold text-emerald-600">{review.correctCount}</span>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Trả lời sai</span>
              <span className="text-xl font-bold text-rose-600">
                {review.totalQuestions - review.correctCount}
              </span>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Kinh nghiệm</span>
              <span className="text-xl font-bold text-amber-600">+{review.xpEarned} XP</span>
            </div>

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200">
              <span className="text-sm text-slate-600 font-medium block mb-1">Chuỗi Streak</span>
              <span className="text-xl font-bold text-orange-600">
                {review.xpEarned > 0 ? 'Duy trì' : 'Chưa đạt'}
              </span>
            </div>
          </div>
        </div>

        {/* Khối Chi Tiết Từng Câu Hỏi */}
        <div className="bg-white rounded-md border border-slate-200 p-6 sm:p-7 shadow-xs space-y-5">
          {/* Header & Tabs lọc */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Chi tiết bài làm từng câu hỏi
              </h3>
              <p className="text-sm text-slate-500 font-medium">
                Đối chiếu các lựa chọn của bạn với đáp án chính xác
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded text-sm font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setFilter('ALL')}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  filter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Tất cả ({review.totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setFilter('CORRECT')}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  filter === 'CORRECT' ? 'bg-emerald-600 text-white shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Đúng ({review.correctCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('WRONG')}
                className={`px-3.5 py-1.5 rounded transition-colors cursor-pointer ${
                  filter === 'WRONG' ? 'bg-rose-600 text-white shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                Sai ({review.totalQuestions - review.correctCount})
              </button>
            </div>
          </div>

          {/* Danh sách các câu hỏi hiển thị rộng rãi, thoáng */}
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              return (
                <div
                  key={q.questionNumber}
                  className={`p-5 rounded-md border transition-colors ${
                    q.correct ? 'border-slate-200 bg-white' : 'border-rose-200 bg-rose-50/15'
                  }`}
                >
                  {/* Hàng 1: Số câu, Từ vựng, IPA và Huy hiệu kết quả */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                          q.correct ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {q.questionNumber}
                      </span>

                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg font-bold text-slate-900">{q.word}</span>
                          <SpeakButton text={q.word} size="sm" />
                          {q.pos && (
                            <span className="text-sm font-serif italic text-slate-500 font-medium">
                              {q.pos}.
                            </span>
                          )}
                        </div>
                        {q.phonetic && (
                          <span className="text-sm font-mono text-slate-500">{q.phonetic}</span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {q.correct ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Trả lời đúng</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{q.selectedKey ? 'Trả lời sai' : 'Chưa làm'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Câu ví dụ ngữ cảnh nếu có */}
                  {q.sentence && (
                    <div className="mb-3 px-3 py-2 rounded bg-slate-50 border border-slate-100 text-sm text-slate-600 italic">
                      &ldquo;{q.sentence}&rdquo;
                    </div>
                  )}

                  {/* Lưới 4 phương án trắc nghiệm hiển thị 2x2 rộng rãi */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {q.options.map((opt) => {
                      const isCorrect = opt.key === q.correctKey;
                      const isSelected = opt.key === q.selectedKey;

                      let optStyle =
                        'flex items-center gap-3 p-3 rounded-md border text-[15px] sm:text-base transition-colors ';

                      if (isCorrect) {
                        optStyle +=
                          'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-semibold shadow-2xs';
                      } else if (isSelected && !isCorrect) {
                        optStyle +=
                          'border-rose-400 bg-rose-50 text-rose-950 font-medium';
                      } else {
                        optStyle +=
                          'border-slate-200 bg-white text-slate-600 opacity-70';
                      }

                      return (
                        <div key={opt.key} className={optStyle}>
                          <span
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : isSelected
                                ? 'bg-rose-500 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {opt.key}
                          </span>
                          <span className="flex-1 leading-normal">{opt.text}</span>

                          {isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          {isSelected && !isCorrect && (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Giải thích chi tiết */}
                  {q.explanation && (
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-start gap-1.5 text-sm text-slate-700">
                      <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-800">Giải thích: </strong>
                        {q.explanation}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Nút hành động chân trang */}
        <div className="flex items-center justify-center gap-4 py-4">
          <button
            type="button"
            onClick={onBackToDeck}
            className="px-6 py-2.5 rounded bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm border border-slate-200 transition-colors cursor-pointer shadow-2xs"
          >
            Quay lại bộ thẻ
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-6 py-2.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs transition-colors cursor-pointer"
          >
            Thi lại đề khác
          </button>
        </div>
      </main>
    </div>
  );
};
