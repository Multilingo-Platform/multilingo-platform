import { examErrorMessage as ee } from '../i18n/examMessages';
import { examMessage as em, useExamLocale } from '../i18n/examMessages';
import React, { useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../app/store';
import { useAttemptResult } from '../hooks/useAttemptResult';
import { useExamReview } from '../hooks/useExamReview';
import { parseResultAttemptId } from '../api/resultContract';
import { PartReviewContent } from '../components/review/PartReviewContent';
import { ReviewPalette } from '../components/review/ReviewPalette';
import { WritingFeedbackPanel } from '../components/result/writing/WritingFeedbackPanel';

const ExamReviewPage: React.FC = () => {
  useExamLocale();
  const params = useParams<{ attemptId: string }>();
  const attemptId = parseResultAttemptId(params.attemptId);
  const ownerId = useSelector((state: RootState) => state.auth?.user?.id ?? null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | number | null>(null);
  const [feedbackIdentity, setFeedbackIdentity] = useState<string | null>(null);

  // Hook 1: Attempt result (provides dynamic reviewParts metadata)
  const result = useAttemptResult(attemptId);
  const reviewParts = result.data?.reviewParts || [];

  // Determine selected Part ID from URL query ?partId=...
  const rawPartIdParam = searchParams.get('partId');
  let selectedPartId: number | null = null;
  let isPartSelectionInvalid = false;

  if (attemptId !== null && result.data && reviewParts.length > 0) {
    if (rawPartIdParam === null) {
      // Truly absent query param selects the first backend-provided part
      selectedPartId = reviewParts[0].id;
    } else {
      const parsedPartId = parseResultAttemptId(rawPartIdParam);
      if (
        parsedPartId !== null &&
        reviewParts.some((p) => p.id === parsedPartId)
      ) {
        selectedPartId = parsedPartId;
      } else {
        isPartSelectionInvalid = true;
        selectedPartId = null;
      }
    }
  }

  // Hook 2: Review data scoped to attemptId and selectedPartId
  const {
    data: reviewData,
    loading: reviewLoading,
    error: reviewError,
    refreshError,
    reload: reloadReview,
  } = useExamReview(attemptId, selectedPartId);

  const scrollToQuestion = (questionId: string | number) => {
    setSelectedQuestionId(questionId);
    const element = document.getElementById(`review-question-${questionId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Case 1: Invalid attemptId in path
  if (attemptId === null) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-lg text-center" role="alert">
        <h2 className="text-xl font-bold text-red-700 mb-2">{em("Mã bài làm không hợp lệ")}</h2>
        <p className="text-gray-600 mb-4">{em("Vui lòng mở lại từ lịch sử làm bài.")}</p>
        <Link
          to="/student/history"
          className="inline-block px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition"
        >
          {em("Lịch sử làm bài")}</Link>
      </div>
    );
  }

  // Case 2: Result loading
  if (result.loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center" role="status" aria-live="polite">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">{em("Đang tải thông tin bài làm...")}</p>
      </div>
    );
  }

  // Case 3: Result error
  if (result.error) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-lg text-center" role="alert">
        <h2 className="text-xl font-bold text-red-700 mb-2">{em("Lỗi khi tải kết quả")}</h2>
        <p className="text-gray-600 mb-4">{ee(result.error.message)}</p>
        <div className="flex justify-center gap-3">
          {result.error.retryable && (
            <button
              type="button"
              onClick={() => void result.reload()}
              className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition"
            >
              {em("Thử lại")}</button>
          )}
          <Link
            to="/student/history"
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-50 transition"
          >
            {em("Lịch sử làm bài")}</Link>
        </div>
      </div>
    );
  }

  // Case 4: Result has empty reviewParts
  if (result.data && reviewParts.length === 0) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-slate-50 border border-slate-200 rounded-lg text-center" role="alert">
        <h2 className="text-xl font-bold text-slate-800 mb-2">{em("Không có phần thi để xem lại")}</h2>
        <p className="text-slate-600 mb-4">{em("Bài thi này không cung cấp dữ liệu xem lại bài làm.")}</p>
        <Link
          to={`/attempts/${attemptId}/result`}
          className="inline-block px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition"
        >
          {em("Quay lại bảng điểm")}</Link>
      </div>
    );
  }

  // Case 5: Invalid part selection in query param
  if (isPartSelectionInvalid && reviewParts.length > 0) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-lg text-center" role="alert">
        <h2 className="text-xl font-bold text-red-700 mb-2">{em("Phần thi không hợp lệ")}</h2>
        <p className="text-slate-600 mb-4">{em("Phần thi được chọn không tồn tại hoặc không thuộc bài làm này.")}</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setSearchParams({ partId: String(reviewParts[0].id) })}
            className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition"
          >
            {em("Chuyển đến")}{' '}{reviewParts[0].label}
          </button>
          <Link
            to={`/attempts/${attemptId}/result`}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-50 transition"
          >
            {em("Quay lại bảng điểm")}</Link>
        </div>
      </div>
    );
  }

  // Case 6: Review data loading
  if (reviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center" role="status" aria-live="polite">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-lg font-medium text-gray-700">{em("Đang tải dữ liệu bài làm và giải thích...")}</p>
      </div>
    );
  }

  // Case 7: Review error
  if (reviewError) {
    return (
      <div className="p-8 max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-lg text-center" role="alert">
        <h2 className="text-xl font-bold text-red-700 mb-2">{em("Lỗi khi tải kết quả ôn tập")}</h2>
        <p className="text-gray-600 mb-4">{reviewError.message || em("Không thể tải dữ liệu ôn tập.")}</p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void reloadReview()}
            className="px-4 py-2 bg-amber-600 text-white font-medium rounded-md hover:bg-amber-700 transition cursor-pointer"
          >
            {em("Thử lại")}</button>
          <Link
            to={`/attempts/${attemptId}/result`}
            className="px-4 py-2 border border-gray-300 bg-white text-gray-700 font-medium rounded-md hover:bg-gray-50 transition"
          >
            {em("Quay lại bảng điểm")}</Link>
        </div>
      </div>
    );
  }

  // Case 8: No reviewData loaded
  if (!reviewData) {
    return (
      <div className="p-8 text-center text-gray-500">
        {em("Không có dữ liệu bài thi để hiển thị.")}</div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6 bg-white rounded-lg shadow-xs border border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 mb-2">
            {em("Chế độ Ôn tập & Phân tích (Review)")}</span>
          <h1 className="text-2xl font-bold text-[#0F172A]">
            {em("Bài thi #")}{attemptId} - Part {selectedPartId}
          </h1>
        </div>

        {/* Dynamic Part Navigation Tabs */}
        <nav aria-label={em("Danh sách phần thi")} className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {reviewParts.map((p) => {
            const isActive = selectedPartId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSearchParams({ partId: String(p.id) })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            to={`/attempts/${attemptId}/result`}
            className="text-sm font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition"
          >
            <span>←</span>
            <span>{em("Quay lại bảng điểm")}</span>
          </Link>
        </div>
      </div>

      {/* Warning on refresh error */}
      {refreshError && (
        <div className="max-w-7xl mx-auto mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm" role="alert">
          {ee(refreshError.message)}
        </div>
      )}

      {/* Main content grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Questions column */}
        <div className="lg:col-span-8">
          {reviewData.questions.some(question => question.type === 'ESSAY') && (
            <div className="mb-6">
              <button type="button" className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium"
                aria-expanded={feedbackIdentity === `${attemptId}:${selectedPartId}`}
                onClick={() => setFeedbackIdentity(current => current === `${attemptId}:${selectedPartId}` ? null : `${attemptId}:${selectedPartId}`)}>
                {em('Nhận xét chi tiết phần thi Writing')}
              </button>
              {feedbackIdentity === `${attemptId}:${selectedPartId}` && selectedPartId !== null && (
                <WritingFeedbackPanel attemptId={attemptId} partId={selectedPartId} />
              )}
            </div>
          )}
          <PartReviewContent
            key={`${ownerId}:${attemptId}:${selectedPartId}`}
            reviewData={reviewData}
            ownerId={ownerId}
            resultSummary={result.data?.resultSummary}
            selectedQuestionId={selectedQuestionId}
            onSelectQuestion={scrollToQuestion}
          />
        </div>

        {/* Sidebar palette column */}
        <div className="lg:col-span-4">
          <div className="sticky top-6">
            <ReviewPalette
              questions={reviewData.questions}
              partId={reviewData.partId}
              resultSummary={result.data?.resultSummary}
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
