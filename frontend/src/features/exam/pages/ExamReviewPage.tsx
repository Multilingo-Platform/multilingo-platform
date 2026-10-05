import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useExamReview } from '../hooks/useExamReview';
import { ReviewPalette } from '../components/review/ReviewPalette';
import { ExplanationBox } from '../components/review/ExplanationBox';

const ExamReviewPage: React.FC = () => {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [partId, setPartId] = useState<number>(1);
  const [selectedQuestionId, setSelectedQuestionId] = useState<number | null>(null);

  const { data, loading, error } = useExamReview(Number(attemptId), partId);

  const scrollToQuestion = (questionId: number) => {
    setSelectedQuestionId(questionId);
    const element = document.getElementById(`review-question-${questionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">Đang tải dữ liệu bài làm và giải thích...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-lg text-center">
        <h2 className="text-xl font-bold text-red-700 mb-2">Lỗi khi tải kết quả</h2>
        <p className="text-gray-600 mb-4">{error.message || 'Không thể tải dữ liệu ôn tập.'}</p>
        <Link
          to={`/attempts/${attemptId}/result`}
          className="inline-block px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition"
        >
          Quay lại bảng điểm
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-gray-500">
        Không có dữ liệu bài thi để hiển thị.
      </div>
    );
  }

  // Support both examData and examSnapshot shapes
  const questions: any[] = data.examData?.questions || (data as any).examSnapshot?.questions || [];
  const userAnswers: Record<string, any> = data.userAnswers || {};
  const isCorrectFlags: Record<string, boolean> = (data as any).isCorrectFlags || {};

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 mb-2">
            Chế độ Ôn tập & Phân tích (Review)
          </span>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            Bài thi #{attemptId} - Part {partId}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to={`/attempts/${attemptId}/result`}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
          >
            <span>←</span>
            <span>Quay lại bảng điểm</span>
          </Link>
        </div>
      </div>

      {/* Main layout */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Questions column */}
        <div className="lg:col-span-8 space-y-6">
          {questions.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border text-center text-gray-500">
              Không có câu hỏi trong phần thi này.
            </div>
          ) : (
            questions.map((q, idx) => {
              const qKey = q.id.toString();
              const hasAnswer = userAnswers[qKey] !== undefined && userAnswers[qKey] !== null && userAnswers[qKey] !== '';
              const isCorrect = isCorrectFlags[qKey] === true;
              const isSelected = selectedQuestionId === q.id;

              return (
                <div
                  key={q.id}
                  id={`review-question-${q.id}`}
                  className={`bg-white rounded-lg border p-6 shadow-sm transition-all ${
                    isSelected
                      ? 'border-amber-500 ring-2 ring-amber-200'
                      : isCorrect
                      ? 'border-green-200'
                      : hasAnswer
                      ? 'border-red-200'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-sm text-gray-500">Câu {idx + 1}</span>
                    {hasAnswer ? (
                      isCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-[#16A34A]">
                          ✓ Chính xác
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-[#DC2626]">
                          ✕ Chưa chính xác
                        </span>
                      )
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
                        Chưa làm
                      </span>
                    )}
                  </div>

                  <div className="text-base font-semibold text-[#0F172A] mb-4">
                    {q.content}
                  </div>

                  {/* Options */}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {q.options.map((opt: any) => {
                        const isUserChoice = userAnswers[qKey] === opt.id || userAnswers[qKey] === opt.content;
                        const isCorrectOption = opt.isCorrect === true;

                        let optionStyle = 'border-gray-200 bg-white text-gray-700';
                        if (isCorrectOption) {
                          optionStyle = 'border-[#16A34A] bg-green-50 text-[#16A34A] font-semibold';
                        } else if (isUserChoice && !isCorrectOption) {
                          optionStyle = 'border-[#DC2626] bg-red-50 text-[#DC2626] line-through';
                        }

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-3 rounded-md border text-sm transition-colors ${optionStyle}`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="radio"
                                checked={isUserChoice}
                                disabled
                                readOnly
                                className="h-4 w-4 text-amber-600 cursor-not-allowed"
                              />
                              <span>{opt.content}</span>
                            </div>
                            <div className="text-xs font-bold">
                              {isCorrectOption && <span className="text-[#16A34A]">Đáp án đúng</span>}
                              {isUserChoice && !isCorrectOption && (
                                <span className="text-[#DC2626]">Lựa chọn của bạn</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Explanation box */}
                  <ExplanationBox htmlContent={q.explanation} />
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <ReviewPalette
              questions={questions}
              isCorrectFlags={isCorrectFlags}
              userAnswers={userAnswers}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={scrollToQuestion}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamReviewPage;
